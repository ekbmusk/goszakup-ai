"""Движок правил v2.1 (индикаторы риска Datanomix)."""
import re
from dataclasses import dataclass, field, asdict
from src.preprocessing.ner_extractor import NERExtractor
from src.preprocessing.text_cleaner import clean_text

@dataclass
class RuleMatch:
    rule_id: str
    datanomix_code: str
    rule_name_ru: str
    category: str
    weight: float
    raw_score: float
    explanation_ru: str
    evidence: str
    severity: str
    law_reference: str = ""
    def to_dict(self): return asdict(self)

@dataclass
class AnalysisResult:
    lot_id: str
    risk_score: float = 0.0
    risk_level: str = "LOW"
    rules_triggered: list = field(default_factory=list)
    rules_passed: list = field(default_factory=list)
    total_rules_checked: int = 0
    summary_ru: str = ""
    highlights: list = field(default_factory=list)
    datanomix_codes: list = field(default_factory=list)
    def to_dict(self):
        return {
            "lot_id": self.lot_id,
            "risk_score": round(self.risk_score, 1),
            "risk_level": self.risk_level,
            "rules_triggered": [r.to_dict() for r in self.rules_triggered],
            "rules_passed_count": len(self.rules_passed),
            "total_rules_checked": self.total_rules_checked,
            "summary_ru": self.summary_ru,
            "highlights": self.highlights,
            "datanomix_codes": self.datanomix_codes,
        }

_EQUIV = [re.compile(p, re.I) for p in [
    r"или\s+(?:его\s+)?эквивалент", r"или\s+аналог", r"либо\s+эквивалент",
    r"либо\s+аналог", r"допускается\s+(?:предложение\s+)?аналог",
    r"допускаются\s+эквивалент", r"рассматриваются\s+аналог",
]]
_NO_ANALOG = [re.compile(p, re.I) for p in [
    r"аналоги?\s+не\s+допуска", r"эквивалент\w*\s+не\s+допуска",
    r"аналоги?\s+не\s+рассматрива", r"эквивалент\w*\s+не\s+рассматрива",
    r"категорически\s+не\s+допуска", r"замена\s+не\s+допуска",
    r"только\s+оригинальн", r"без\s+(?:права\s+)?замен",
    r"исключительно\s+данн\w+\s+(?:модел|марк|бренд)",
    r"сублицензирование\s+не\s+допуска",
]]
_PROPRIETARY = {
    "Liquid Retina","ProMotion","Retina XDR","M1","M2","M3","M4",
    "M1 Pro","M1 Max","M2 Pro","M2 Max","M3 Pro","M3 Max",
    "Apple Silicon","MagSafe","MAGNETOM","syngo","BioMatrix","Tim 4G",
    "nSIGHT","EPIQ","IntelliVue","Anatomical Intelligence",
    "OpenLab CDS","InfinityLab","Multi-Terrain Select","Crawl Control",
    "E-Four","Mark Levinson","Lexus CoDrive","IOS-XE","Meraki","Catalyst",
    "AMOLED","One UI","Knox","nSIGHT Imaging","Thunderbolt",
}
_CATALOG = re.compile(r"\b[A-Z]{1,3}\d{3,}[A-Z]?\b|\b\d{2,3}-[A-Z]{2,}\d*\b|\b[A-Z]{2,}\d{2,}-\d+\b", re.I)
_PREC_EXACT = re.compile(r"(?:именно|ровно|составляет|равна?)\s+([\d.,]+)\s*(?:кг|г|мм|см|м|кВт|Вт|МГц|ГГц|Тл|л\.?\s?с\.?|нит|кв\.?\s*м|мТл|дБ)", re.I)
_PREC_DEC = re.compile(r"\b(\d+[.,]\d{3,})\s*(?:кг|мм|см|м|кВт|л|мТл)", re.I)
_LUXURY = [re.compile(p, re.I) for p in [
    r"представительск\w+\s+(?:класс|автомобил)", r"премиум[\s-]?класс",
    r"бизнес[\s-]?класс", r"люкс", r"топ[\s-]?(?:класс|верси|комплектаци)",
    r"максимальн\w+\s+комплектаци", r"массаж\w+\s+(?:сиден|кресл)",
    r"шумоподавлен", r"перфорированн\w+\s+кож",
]]

class RuleEngine:
    def __init__(self):
        self.ner = NERExtractor()

    def analyze(self, lot, features=None, history=None):
        desc = clean_text(lot.get("desc_ru","") + " " + lot.get("extra_desc_ru",""))
        ner = self.ner.extract(desc)
        h = history or {}
        M, P, HL = [], [], []
        total = 0

        def add(rid, dnx, name, cat, w, raw, expl, ev, sev, law=""):
            M.append(RuleMatch(rid, dnx, name, cat, w, raw, expl, ev, sev, law))
        def skip(rid, name):
            P.append({"rule_id": rid, "rule_name_ru": name})
        def ev(kw, ctx=80):
            if not kw or not desc: return ""
            i = desc.lower().find(kw.lower())
            if i == -1: return ""
            s,e = max(0,i-ctx), min(len(desc),i+len(kw)+ctx)
            return ("..." if s>0 else "") + desc[s:e] + ("..." if e<len(desc) else "")

        has_brand = len(ner.brands) > 0
        has_eq = any(p.search(desc) for p in _EQUIV)
        has_noanalog = any(p.search(desc) for p in _NO_ANALOG)

        # R01 -> SS-8: бренд без «или эквивалент»
        total += 1
        if has_brand and not has_eq:
            bn = list(set(e.value for e in ner.brands))[:5]
            sev = "critical" if has_noanalog else "danger"
            expl = f"В ТЗ указан бренд ({', '.join(bn)}) без пометки «или эквивалент». По ст. 21 Закона о госзакупках, указание бренда допускается только с разрешением эквивалентов."
            if has_noanalog: expl += " Более того, аналоги прямо запрещены."
            for e2 in ner.brands: HL.append({"start":e2.start,"end":e2.end,"type":"brand"})
            add("R01","SS-8","Бренд без «или эквивалент»","brand", 0.95 if has_noanalog else 0.75, 35, expl, ev(bn[0]), sev, "ст. 21 Закона о госзакупках РК")
        elif has_brand and has_eq:
            skip("R01","Бренд указан с «или эквивалент» — допустимо")
        else:
            skip("R01","Бренды не обнаружены")

        # R02 -> SS-8: каталожные номера
        total += 1
        cats = [m for m in _CATALOG.findall(desc) if not re.match(r"^(ГОСТ|ISO|IEC|СТ|ТУ|MIL)",m,re.I) and len(m)>=4]
        if len(cats) >= 2:
            add("R02","SS-8","Каталожные номера производителя","specificity", 0.70, 25, f"Артикулы: {', '.join(cats[:5])}. Эквивалентно указанию конкретной модели.", ", ".join(cats[:5]), "danger", "ст. 21 п. 4")
        else: skip("R02","Каталожные номера не найдены")

        # R03 -> SS-8: проприетарные технологии
        total += 1
        dl = desc.lower()
        fp = [t for t in _PROPRIETARY if t.lower() in dl]
        for t in fp:
            i = dl.find(t.lower())
            HL.append({"start":i,"end":i+len(t),"type":"proprietary"})
        if fp:
            add("R03","SS-8","Проприетарные технологии производителя","specificity", 0.65, 20, f"Запатентованные названия: {', '.join(fp[:5])}. Принадлежат конкретному производителю.", ", ".join(fp[:5]), "warning")
        else: skip("R03","Проприетарные технологии не найдены")

        # R04 -> SS-8: чрезмерная точность параметров
        total += 1
        ex = _PREC_EXACT.findall(desc); dc = _PREC_DEC.findall(desc)
        ptotal = len(ex)+len(dc)
        if ptotal >= 2:
            for p in [_PREC_EXACT,_PREC_DEC]:
                for m in p.finditer(desc): HL.append({"start":m.start(),"end":m.end(),"type":"precision"})
            add("R04","SS-8","Подозрительно точные параметры","specificity", 0.50, 15, f"{ptotal} параметров с необычной точностью. Нормальная спецификация использует диапазоны.", ev(ex[0] if ex else ""), "warning")
        elif ptotal == 1:
            add("R04","SS-8","Точный параметр (единичный)","specificity", 0.25, 8, "Один точный параметр. В сочетании с другими — подозрителен.", "", "info")
        else: skip("R04","Точных параметров нет")

        # R05 -> SS-8: запрет аналогов
        total += 1
        naf = []
        for pat in _NO_ANALOG:
            for m in pat.finditer(desc):
                naf.append(m.group()); HL.append({"start":m.start(),"end":m.end(),"type":"no_analog"})
        if naf:
            add("R05","SS-8","Прямой запрет аналогов и эквивалентов","restriction", 1.0, 40, f"Запрещающая формулировка: «{naf[0]}». Прямое нарушение принципа конкуренции.", ev(naf[0]), "critical", "ст. 21 п. 6, ст. 5")
        else: skip("R05","Запрет аналогов не обнаружен")

        # R06 -> SS-14: требования к поставщику
        total += 1
        if ner.legal_markers:
            cc = lot.get("category_code","")
            med = cc.startswith("33") if cc else False
            lt = [e2.value for e2 in ner.legal_markers]
            expl = f"Требуется: «{lt[0]}». Требование авторизации не связано с предметом закупки."
            if med: expl += " Для медоборудования частично обосновано."
            add("R06","SS-14","Незаконные требования к поставщику","restriction", 0.45 if med else 0.70, 20, expl, ev(lt[0]), "warning" if med else "danger", "ст. 21 п. 10")
        else: skip("R06","Требований авторизации нет")

        # R07 -> SS-1: гео-ограничения
        total += 1
        if ner.geo_restrictions:
            gt = [e2.value for e2 in ner.geo_restrictions]
            add("R07","SS-1","Избыточное требование (гео-ограничение)","restriction", 0.40, 12, f"«{gt[0]}». Географические ограничения допустимы только при объективной необходимости.", ev(gt[0]), "info", "ст. 21 п. 5")
        else: skip("R07","Гео-ограничений нет")

        # R08 -> PP-6: сжатые сроки
        total += 1
        dd = lot.get("deadline_days",0)
        if dd and 0 < dd <= 2:
            add("R08","PP-6","Критически сжатые сроки подачи","procedure", 0.80, 25, f"Срок: {dd} {'день' if dd==1 else 'дня'}. Минимум по закону — 5 р.д. (конкурс), 3 дн. (ЗЦП). Только компания с инсайдом успеет.", f"Срок: {dd} дн.", "critical", "ст. 38 п. 2")
        elif dd and dd <= 4:
            add("R08","PP-6","Сжатые сроки подачи","procedure", 0.50, 15, f"Срок {dd} дней — на грани допустимого.", f"Срок: {dd} дн.", "warning", "ст. 38")
        else: skip("R08","Сроки в норме")

        # R09 -> SS-12: один участник
        total += 1
        pp = lot.get("participants_count",0)
        if pp == 1:
            add("R09","SS-12","Имитация конкуренции (1 участник)","competition", 0.65, 20, "Подана 1 заявка. С ограничительным ТЗ — признак заточки.", f"Участников: {pp}", "danger")
        elif pp == 2:
            add("R09","SS-12","Минимальная конкуренция","competition", 0.30, 10, "2 участника. Возможна имитация — «свой» + аффилированная компания.", f"Участников: {pp}", "info")
        else: skip("R09",f"Участников: {pp}")

        # R10 -> SS-16: повторяемость побед
        total += 1
        ww = h.get("winner_wins_count",0)
        if ww >= 10:
            add("R10","SS-16","Систематическое предпочтение одному поставщику","competition", 0.75, 25, f"Поставщик побеждал {ww} раз. SS-16: доминирующая доля в закупках.", f"Побед: {ww}", "danger")
        elif ww >= 5:
            add("R10","SS-16","Повторные победы поставщика","competition", 0.50, 15, f"Побеждал {ww} раз — выше нормы.", f"Побед: {ww}", "warning")
        else: skip("R10","Повторных побед нет")

        # R11 -> PP-5: завышение цены
        total += 1
        mb = h.get("category_median_budget",0)  # This is now median unit price
        
        # Calculate effective unit price for this lot
        unit_price = lot.get("unit_price", 0) or 0
        budget = lot.get("budget", 0) or 0
        quantity = lot.get("quantity", 0) or 0
        
        if unit_price > 0:
            lot_price = unit_price
        elif budget > 0 and quantity > 0:
            lot_price = budget / quantity
        elif budget > 0:
            lot_price = budget
        else:
            lot_price = 0
        
        if mb and lot_price:
            r = lot_price / mb
            if r > 5.0: add("R11","PP-5","Критическое завышение цены","price", 0.80, 25, f"Цена в {r:.1f}× выше медианы.", f"Цена: {lot_price:,.0f} ₸, медиана: {mb:,.0f} ₸", "critical")
            elif r > 3.0: add("R11","PP-5","Завышение цены","price", 0.55, 18, f"Цена в {r:.1f}× выше медианы.", f"Коэфф: {r:.1f}×", "danger")
            elif r > 2.0: add("R11","PP-5","Повышенная цена","price", 0.30, 10, f"Цена в {r:.1f}× выше медианы.", f"Коэфф: {r:.1f}×", "warning")
            else: skip("R11","Цена в норме")
        else: skip("R11","Нет данных")

        # R12 -> SS-12: отсутствие снижения цены
        total += 1
        budget = lot.get("budget", 0)
        cs = lot.get("contract_sum",0)
        if budget and cs:
            pr = cs / budget
            if pr > 0.98 and pp <= 2:
                add("R12","SS-12","Нет конкурентного снижения цены","price", 0.55, 15, f"Контракт = {pr:.1%} от бюджета при {pp} участнике(ах). SS-12: цена победителя ≈ начальная.", f"Контракт/бюджет: {pr:.1%}", "warning")
            else: skip("R12","Снижение цены есть")
        else: skip("R12","Нет данных")

        # R13 -> SS-8: аномальная детализация
        total += 1
        al = h.get("category_avg_text_length",0); sl = h.get("category_std_text_length",0)
        tl = len(desc)
        if al and sl and sl > 20:
            z = (tl - al) / sl
            if z > 3.0:
                add("R13","SS-8","Аномально подробное ТЗ (copy-paste из каталога)","text_anomaly", 0.55, 18, f"Длина ({tl}) в {z:.1f}σ выше среднего ({al:.0f}). Вероятно — копия из каталога.", f"z-score: {z:.1f}", "warning")
            elif z > 2.0:
                add("R13","SS-8","Повышенная детализация ТЗ","text_anomaly", 0.30, 10, f"ТЗ длиннее на {z:.1f}σ.", f"z: {z:.1f}", "info")
            else: skip("R13","Длина в норме")
        else: skip("R13","Нет данных по категории")

        # R14 -> PP-4.3: дробление закупок
        total += 1
        sl30 = h.get("same_customer_ktru_lots_30d",0)
        if sl30 >= 3:
            add("R14","PP-4.3","Дробление закупки","procedure", 0.60, 20, f"{sl30} закупок по тому же КТРУ за 30 дней. PP-4.3: обход порога конкурса.", f"Закупок: {sl30}", "danger", "ст. 7 п. 15")
        else: skip("R14","Дробления нет")

        # R15 -> SS-8: комбинация уникальных требований
        total += 1
        uniq = len(ner.brands) + len(fp) + ptotal + len(cats)
        if uniq >= 5:
            add("R15","SS-8","Комплексная заточка","specificity", 0.85, 30, f"{uniq} уникальных требований. Каждое допустимо, но совокупность = одна модель.", f"Уникальных: {uniq}", "danger")
        elif uniq >= 3:
            add("R15","SS-8","Повышенная специфичность","specificity", 0.45, 12, f"{uniq} специфичных требований.", "", "warning")
        else: skip("R15","Специфичность в норме")

        # R16 -> SS-7: подмена кириллицы латиницей
        total += 1
        mixed = []
        for m in re.finditer(r"\b\S{3,}\b", desc):
            w = m.group()
            if re.search(r"[а-яёА-ЯЁ]",w) and re.search(r"[a-zA-Z]",w) and not re.match(r"^[A-Za-z0-9\-]+$",w):
                mixed.append((w, m.start()))
                HL.append({"start":m.start(),"end":m.end(),"type":"homoglyph"})
        if mixed:
            ws = ", ".join(f"«{w}»" for w,_ in mixed[:5])
            add("R16","SS-7","Подмена кириллицы латиницей","text_anomaly", 0.60, 20, f"Слова со смешанными символами: {ws}. SS-7: затрудняет поиск объявления.", ws, "danger")
        else: skip("R16","Подмена не обнаружена")

        # R17 -> SS-10: несоответствие названия
        total += 1
        nm = lot.get("name_ru",""); cn = lot.get("category_name","")
        if nm and cn and desc:
            cw = [w for w in cn.lower().split() if len(w)>4]
            if cw and not any(w in desc.lower() for w in cw):
                add("R17","SS-10","Несоответствие названия предмету закупки","text_anomaly", 0.35, 12, f"SS-10: категория «{cn}» не упоминается в ТЗ. Затрудняет поиск.", f"Категория: {cn}", "info")
            else: skip("R17","Название соответствует")
        else: skip("R17","Недостаточно данных")

        # R18 -> PP-3: избыточный класс товара
        total += 1
        lux = []
        for pat in _LUXURY:
            m = pat.search(desc)
            if m: lux.append(m.group()); HL.append({"start":m.start(),"end":m.end(),"type":"luxury"})
        if lux:
            add("R18","PP-3","Избыточный класс товара","specificity", 0.50, 15, f"Маркеры: {', '.join(lux[:3])}. PP-3: характеристики избыточны для заказчика.", ", ".join(lux[:3]), "warning")
        else: skip("R18","Избыточного класса нет")

        # R19 -> SS-3: объединение несвязанных товаров/услуг
        total += 1
        hg = bool(re.search(r"поставк\w+|товар\w*|оборудован\w+|компьютер|ноутбук|автомобил", desc, re.I))
        hs = bool(re.search(r"(?:услуг\w+\s+(?:по\s+)?(?:монтаж|настройк|обучен|внедрен|разработк|создан|обслуживан))|(?:работ\w+\s+по\s+(?:монтаж|установк|пуско-наладк))", desc, re.I))
        if hg and hs and tl > 400:
            add("R19","SS-3","Объединение товаров и услуг в один лот","restriction", 0.45, 15, "SS-3: объединение несвязанных товаров/услуг ограничивает участников.", "", "warning")
        else: skip("R19","Объединения нет")

        # R20 -> PP-4: необоснованный единственный источник
        total += 1
        meth = lot.get("trade_method","")
        if meth and "из одного источника" in meth.lower() and bu and bu > 4000*3450:
            add("R20","PP-4","Необоснованная закупка из одного источника","procedure", 0.70, 22, f"Из одного источника при бюджете {bu:,.0f} ₸ (выше порога). PP-4: неконкурентный способ.", f"Метод: {meth}", "danger", "ст. 39")
        else: skip("R20","Конкурентный способ")

        # === SCORING ===
        if not M:
            score = 0.0
        else:
            ws2 = sum(m.weight * m.raw_score for m in M)
            score = min(100.0, ws2 / 1.8)
            if len(M) >= 4: score = min(100.0, score * 1.15)
            if len(M) >= 6: score = min(100.0, score * 1.10)

        lev = "CRITICAL" if score>=75 else "HIGH" if score>=50 else "MEDIUM" if score>=25 else "LOW"
        dnx = list(set(m.datanomix_code for m in M))
        icons = {"CRITICAL":"⛔","HIGH":"🔴","MEDIUM":"🟡","LOW":"🟢"}
        labels2 = {"CRITICAL":"КРИТИЧЕСКИЙ","HIGH":"ВЫСОКИЙ","MEDIUM":"СРЕДНИЙ","LOW":"НИЗКИЙ"}

        if not M:
            summary = "✅ Признаков манипулятивной спецификации не обнаружено."
        else:
            cats2 = set(m.category for m in M)
            issues = []
            if "brand" in cats2 or "specificity" in cats2: issues.append("заточка")
            if "restriction" in cats2: issues.append("ограничение конкуренции")
            if "procedure" in cats2: issues.append("процедурные нарушения")
            if "competition" in cats2: issues.append("имитация конкуренции")
            if "price" in cats2: issues.append("ценовые аномалии")
            if "text_anomaly" in cats2: issues.append("аномалии текста")
            summary = f"{icons.get(lev,'')} {labels2.get(lev,'')} РИСК. {len(M)} правил: {', '.join(issues)}. Коды: {', '.join(sorted(dnx))}. Балл: {score:.0f}/100."

        return AnalysisResult(lot_id=lot.get("lot_id",""), risk_score=score, risk_level=lev, rules_triggered=M, rules_passed=P, total_rules_checked=total, summary_ru=summary, highlights=HL, datanomix_codes=dnx)