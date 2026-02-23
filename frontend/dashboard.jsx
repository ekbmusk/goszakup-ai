import { useState, useMemo } from "react";

// ─── Demo Data (from actual analysis results) ──────────────────────────
const DEMO_LOTS = [
  {
    id: "LOT-10045", name: "Закупка: Ноутбуки", cat: "Ноутбуки", budget: 780000, parts: 1, days: 5, city: "Алматы", score: 65.5, level: "HIGH",
    rules: [{ name: "Указание конкретного бренда", score: 35, expl: 'В ТЗ указан конкретный бренд: Dell, Latitude. Это сужает круг потенциальных поставщиков.', evidence: '...Dell Latitude 5540 с процессором Intel Core i7-1365U...', sev: "danger" },
    { name: "Запрет аналогов", score: 40, expl: 'Обнаружена ограничительная фраза: «Эксклюзивный поставщик».', evidence: '...Эксклюзивный поставщик. Срок гарантии — 60 месяцев...', sev: "critical" },
    { name: "Подозрительно точные параметры", score: 25, expl: 'Найдены параметры: «именно 1.80 ГГц», «масса не более 1.534 кг».', evidence: '...частотой именно 1.80 ГГц, 12 ядер), ОЗУ DDR5...', sev: "warning" },
    { name: "Повторный победитель", score: 20, expl: 'Поставщик побеждал 18 раз.', evidence: 'Побед у поставщика: 18', sev: "danger" }],
    similar: [{ lot_id: "LOT-10033", similarity: 0.87, name_ru: "Закупка: Ноутбуки" }], net_flags: ["Повторяющееся сотрудничество (14 контрактов) с БИН ...0111"], explanation: ["Правила: 100/100", "Copy-Paste: обнаружено совпадение ТЗ на 95%"]
  },
  {
    id: "LOT-10060", name: "Закупка: Легковые автомобили", cat: "Легковые автомобили", budget: 60000000, parts: 1, days: 1, city: "Астана", score: 65.5, level: "HIGH",
    rules: [{ name: "Указание конкретного бренда", score: 35, expl: 'В ТЗ указаны бренды: Lexus, LS. Это сужает круг поставщиков.', evidence: '...Lexus LS 500h Executive в комплектации...', sev: "danger" },
    { name: "Запрет аналогов", score: 40, expl: 'Обнаружено: «Аналоги и эквиваленты не допускаются».', evidence: '...Аналоги и эквиваленты не допускаются...', sev: "critical" },
    { name: "Авторизованный дилер", score: 30, expl: 'Требуется статус официального дилера Lexus.', evidence: '...официального дилера Lexus с сервисным центром в г. Астана...', sev: "warning" },
    { name: "Единственный участник", score: 25, expl: 'В тендере подана только одна заявка.', evidence: 'Количество участников: 1', sev: "danger" },
    { name: "Сжатые сроки", score: 20, expl: 'Срок подачи 1 день — нереалистично мало.', evidence: 'Срок подачи: 1 дн.', sev: "danger" },
    { name: "Повторный победитель", score: 20, expl: 'Поставщик побеждал 22 раза.', evidence: 'Побед: 22', sev: "danger" },
    { name: "Завышенная цена", score: 20, expl: 'Бюджет в 3.8× выше медианы по категории.', evidence: 'Бюджет: 60,000,000 ₸', sev: "warning" },
    { name: "Географическое ограничение", score: 15, expl: 'Требуется сервисный центр в г. Астана.', evidence: '...сервисным центром в г. Астана.', sev: "info" }],
    similar: [], net_flags: ["Повторяющееся сотрудничество (14 контрактов)", "Входит в крупную группу связанных организаций"], explanation: ["Правила: 100/100", "Сеть: аффилированность"]
  },
  {
    id: "LOT-10061", name: "Закупка: Медицинское оборудование", cat: "Медицинское оборудование", budget: 224000000, parts: 1, days: 3, city: "Астана", score: 65.5, level: "HIGH",
    rules: [{ name: "Указание конкретного бренда", score: 35, expl: 'Бренды: Siemens, MAGNETOM, Healthineers.', evidence: '...Siemens MAGNETOM Vida 3T...', sev: "danger" },
    { name: "Запрет аналогов", score: 40, expl: '«Аналоги категорически не допускаются».', evidence: '...категорически не допускаются...', sev: "critical" },
    { name: "Авторизованный дилер", score: 30, expl: 'Требуется статус Siemens Healthineers Advanced Partner.', evidence: '...Siemens Healthineers Advanced Partner...', sev: "warning" },
    { name: "Точные параметры", score: 25, expl: '«Ровно 60 мТл/м», «ровно 163 см».', evidence: '...ровно 60 мТл/м, скоростью...', sev: "warning" },
    { name: "Единственный участник", score: 25, expl: 'Только одна заявка.', evidence: 'Участников: 1', sev: "danger" },
    { name: "Повторный победитель", score: 20, expl: 'Побеждал 22 раза.', evidence: 'Побед: 22', sev: "danger" }],
    similar: [], net_flags: ["Повторяющееся сотрудничество (14 контрактов)"], explanation: ["Правила: 100/100"]
  },
  {
    id: "LOT-10005", name: "Закупка: Программное обеспечение", cat: "Программное обеспечение", budget: 5100000, parts: 1, days: 4, city: "Караганда", score: 65.5, level: "HIGH",
    rules: [{ name: "Указание бренда", score: 35, expl: 'В ТЗ указан Kaspersky.', evidence: '...Kaspersky Endpoint Security для бизнеса...', sev: "danger" },
    { name: "Запрет аналогов", score: 40, expl: '«Сублицензирование не допускается».', evidence: '...только прямые поставки...', sev: "critical" },
    { name: "Единственный участник", score: 25, expl: 'Одна заявка.', evidence: 'Участников: 1', sev: "danger" },
    { name: "Повторный победитель", score: 20, expl: 'Поставщик побеждал 18 раз.', evidence: 'Побед: 18', sev: "danger" }],
    similar: [{ lot_id: "LOT-10019", similarity: 0.92, name_ru: "Закупка: ПО" }], net_flags: [], explanation: ["Правила: 100/100"]
  },
  { id: "LOT-10002", name: "Закупка: Ноутбуки", cat: "Ноутбуки", budget: 490000, parts: 5, days: 12, city: "Шымкент", score: 10.0, level: "LOW", rules: [{ name: "Повторный победитель", score: 20, expl: 'Поставщик побеждал 6 раз.', evidence: 'Побед: 6', sev: "warning" }], similar: [], net_flags: [], explanation: ["Правила: 20/100"] },
  { id: "LOT-10010", name: "Закупка: Офисная мебель", cat: "Офисная мебель", budget: 2300000, parts: 7, days: 10, city: "Алматы", score: 0, level: "LOW", rules: [], similar: [], net_flags: [], explanation: ["Признаков заточки не обнаружено"] },
  { id: "LOT-10015", name: "Закупка: Настольные компьютеры", cat: "Настольные компьютеры", budget: 380000, parts: 4, days: 8, city: "Астана", score: 0, level: "LOW", rules: [], similar: [], net_flags: [], explanation: ["Признаков заточки не обнаружено"] },
  {
    id: "LOT-10022", name: "Закупка: Легковые автомобили", cat: "Легковые автомобили", budget: 18500000, parts: 3, days: 6, city: "Караганда", score: 47.5, level: "MEDIUM",
    rules: [{ name: "Указание бренда", score: 35, expl: 'Бренд: Toyota Land Cruiser.', evidence: '...Toyota Land Cruiser 300 GR Sport...', sev: "danger" },
    { name: "Запрет аналогов", score: 40, expl: '«Аналоги не рассматриваются».', evidence: '...Аналоги не рассматриваются.', sev: "critical" },
    { name: "Точные параметры", score: 25, expl: 'Код цвета: (код 070).', evidence: '...(код 070)...', sev: "warning" }],
    similar: [], net_flags: [], explanation: ["Правила: 100/100"]
  },
  { id: "LOT-10030", name: "Закупка: Медицинское оборудование", cat: "Медицинское оборудование", budget: 32000000, parts: 8, days: 14, city: "Павлодар", score: 0, level: "LOW", rules: [], similar: [], net_flags: [], explanation: ["Чистая закупка"] },
  {
    id: "LOT-10038", name: "Закупка: Лабораторное оборудование", cat: "Лабораторное оборудование", budget: 28000000, parts: 2, days: 5, city: "Алматы", score: 55.5, level: "HIGH",
    rules: [{ name: "Указание бренда", score: 35, expl: 'Бренд: Agilent.', evidence: '...Agilent 1260 Infinity II LC...', sev: "danger" },
    { name: "Запрет аналогов", score: 40, expl: '«Аналоги не допускаются».', evidence: '...Аналоги не допускаются...', sev: "critical" },
    { name: "Точная модель", score: 25, expl: 'Указаны модели: G7117C, G7129A, G7116A.', evidence: '...модель G7117C...', sev: "warning" }],
    similar: [], net_flags: [], explanation: ["Правила: 100/100"]
  },
];

const LEVEL_CONFIG = {
  LOW: { color: "#22c55e", bg: "#052e16", label: "Низкий" },
  MEDIUM: { color: "#eab308", bg: "#422006", label: "Средний" },
  HIGH: { color: "#ef4444", bg: "#450a0a", label: "Высокий" },
  CRITICAL: { color: "#dc2626", bg: "#7f1d1d", label: "Критический" },
};
const SEV_COLORS = { critical: "#dc2626", danger: "#ef4444", warning: "#eab308", info: "#3b82f6" };

const fmt = (n) => new Intl.NumberFormat("ru-RU").format(n);

// ─── Components ────────────────────────────────────────────────────────
const RiskBadge = ({ level, score }) => {
  const cfg = LEVEL_CONFIG[level] || LEVEL_CONFIG.LOW;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 6,
      background: cfg.bg, color: cfg.color, fontWeight: 700, fontSize: 12, letterSpacing: "0.5px",
      border: `1px solid ${cfg.color}33`,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.color }} />
      {score !== undefined ? `${score.toFixed(0)}` : cfg.label}
    </span>
  );
};

const GaugeChart = ({ score, size = 180 }) => {
  const level = score >= 76 ? "CRITICAL" : score >= 51 ? "HIGH" : score >= 26 ? "MEDIUM" : "LOW";
  const cfg = LEVEL_CONFIG[level];
  const pct = score / 100;
  const r = size / 2 - 14;
  const circumference = Math.PI * r;
  const dashOffset = circumference * (1 - pct);
  return (
    <svg width={size} height={size / 2 + 30} viewBox={`0 0 ${size} ${size / 2 + 30}`}>
      <path d={`M 14,${size / 2} A ${r},${r} 0 0 1 ${size - 14},${size / 2}`}
        fill="none" stroke="#1e293b" strokeWidth={10} strokeLinecap="round" />
      <path d={`M 14,${size / 2} A ${r},${r} 0 0 1 ${size - 14},${size / 2}`}
        fill="none" stroke={cfg.color} strokeWidth={10} strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={dashOffset}
        style={{ transition: "stroke-dashoffset 1s ease-out" }} />
      <text x={size / 2} y={size / 2 - 8} textAnchor="middle" fill={cfg.color}
        style={{ fontSize: 36, fontWeight: 800, fontFamily: "monospace" }}>
        {score.toFixed(0)}
      </text>
      <text x={size / 2} y={size / 2 + 18} textAnchor="middle" fill="#94a3b8" style={{ fontSize: 12 }}>
        из 100
      </text>
    </svg>
  );
};

const RuleCard = ({ rule }) => (
  <div style={{
    padding: "12px 16px", borderRadius: 8, marginBottom: 8,
    background: "#0f172a", border: `1px solid ${SEV_COLORS[rule.sev]}22`,
    borderLeft: `3px solid ${SEV_COLORS[rule.sev]}`,
  }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
      <span style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 14 }}>{rule.name}</span>
      <span style={{
        padding: "2px 8px", borderRadius: 4, fontSize: 12, fontWeight: 800,
        background: SEV_COLORS[rule.sev] + "22", color: SEV_COLORS[rule.sev],
      }}>+{rule.score}</span>
    </div>
    <p style={{ color: "#94a3b8", fontSize: 13, margin: "4px 0 0", lineHeight: 1.5 }}>{rule.expl}</p>
    {rule.evidence && (
      <div style={{
        marginTop: 6, padding: "6px 10px", borderRadius: 4, background: "#1e293b",
        fontFamily: "monospace", fontSize: 12, color: "#64748b", whiteSpace: "pre-wrap",
      }}>📌 {rule.evidence}</div>
    )}
  </div>
);

const BarSegment = ({ data, total }) => (
  <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", height: 10 }}>
    {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map(l => {
      const pct = (data[l] || 0) / total * 100;
      if (!pct) return null;
      return <div key={l} style={{ width: `${pct}%`, background: LEVEL_CONFIG[l].color, minWidth: pct > 0 ? 4 : 0 }} />;
    })}
  </div>
);

// ─── Pages ─────────────────────────────────────────────────────────────
const DashboardPage = ({ lots, onSelectLot }) => {
  const stats = useMemo(() => {
    const byLevel = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    const byCat = {};
    let totalBudget = 0;
    lots.forEach(l => {
      byLevel[l.level]++;
      totalBudget += l.budget;
      if (!byCat[l.cat]) byCat[l.cat] = { count: 0, high: 0, sum: 0 };
      byCat[l.cat].count++;
      if (l.level === "HIGH" || l.level === "CRITICAL") byCat[l.cat].high++;
      byCat[l.cat].sum += l.budget;
    });
    return { byLevel, byCat, totalBudget, avgScore: lots.reduce((s, l) => s + l.score, 0) / lots.length };
  }, [lots]);

  const topRisks = useMemo(() =>
    [...lots].sort((a, b) => b.score - a.score).slice(0, 5),
    [lots]);

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Всего лотов", value: lots.length, sub: `бюджет ${fmt(stats.totalBudget)} ₸` },
          { label: "Высокий риск", value: stats.byLevel.HIGH + stats.byLevel.CRITICAL, sub: `${((stats.byLevel.HIGH + stats.byLevel.CRITICAL) / lots.length * 100).toFixed(0)}% от общего`, color: "#ef4444" },
          { label: "Средний балл", value: stats.avgScore.toFixed(1), sub: "по всем лотам" },
          { label: "Чистые", value: stats.byLevel.LOW, sub: "без нарушений", color: "#22c55e" },
        ].map((kpi, i) => (
          <div key={i} style={{ padding: 20, borderRadius: 12, background: "#0f172a", border: "1px solid #1e293b" }}>
            <div style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{kpi.label}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: kpi.color || "#e2e8f0", fontFamily: "monospace" }}>{kpi.value}</div>
            <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Risk Distribution */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ padding: 20, borderRadius: 12, background: "#0f172a", border: "1px solid #1e293b" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, color: "#94a3b8" }}>Распределение рисков</h3>
          <BarSegment data={stats.byLevel} total={lots.length} />
          <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
            {Object.entries(LEVEL_CONFIG).map(([key, cfg]) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: cfg.color }} />
                <span style={{ fontSize: 12, color: "#94a3b8" }}>{cfg.label}: {stats.byLevel[key]}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: 20, borderRadius: 12, background: "#0f172a", border: "1px solid #1e293b" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, color: "#94a3b8" }}>По категориям</h3>
          {Object.entries(stats.byCat).sort((a, b) => b[1].high - a[1].high).slice(0, 5).map(([cat, d]) => (
            <div key={cat} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #1e293b" }}>
              <span style={{ fontSize: 13, color: "#cbd5e1" }}>{cat}</span>
              <span style={{ fontSize: 12, color: d.high > 0 ? "#ef4444" : "#64748b" }}>
                {d.high > 0 ? `⚠ ${d.high}/${d.count}` : `${d.count} лотов`}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Risky Lots */}
      <div style={{ padding: 20, borderRadius: 12, background: "#0f172a", border: "1px solid #1e293b" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 14, color: "#94a3b8" }}>🔝 Топ-5 подозрительных лотов</h3>
        {topRisks.map(lot => (
          <div key={lot.id} onClick={() => onSelectLot(lot)} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "12px 16px", borderRadius: 8, marginBottom: 6, cursor: "pointer",
            background: "#1e293b", transition: "all 0.15s",
          }}
            onMouseOver={e => e.currentTarget.style.background = "#334155"}
            onMouseOut={e => e.currentTarget.style.background = "#1e293b"}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>{lot.name}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{lot.city} • {fmt(lot.budget)} ₸ • {lot.rules.length} правил</div>
            </div>
            <RiskBadge level={lot.level} score={lot.score} />
          </div>
        ))}
      </div>
    </div>
  );
};

const LotsListPage = ({ lots, onSelectLot }) => {
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let result = lots;
    if (filter !== "ALL") result = result.filter(l => l.level === filter);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(l => l.name.toLowerCase().includes(s) || l.cat.toLowerCase().includes(s) || l.city.toLowerCase().includes(s));
    }
    return result.sort((a, b) => b.score - a.score);
  }, [lots, filter, search]);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по названию, категории, городу..."
          style={{ flex: 1, minWidth: 200, padding: "10px 14px", borderRadius: 8, border: "1px solid #334155", background: "#0f172a", color: "#e2e8f0", fontSize: 14, outline: "none" }} />
        {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map(level => (
          <button key={level} onClick={() => setFilter(level)}
            style={{
              padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 600, letterSpacing: "0.5px",
              background: filter === level ? (level === "ALL" ? "#3b82f6" : LEVEL_CONFIG[level]?.color || "#3b82f6") : "#1e293b",
              color: filter === level ? "#fff" : "#94a3b8",
            }}>
            {level === "ALL" ? "ВСЕ" : LEVEL_CONFIG[level]?.label || level}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>Найдено: {filtered.length}</div>

      <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #1e293b" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#0f172a" }}>
              {["Лот", "Категория", "Бюджет, ₸", "Участн.", "Срок", "Город", "Риск"].map(h => (
                <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: "#64748b", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(lot => (
              <tr key={lot.id} onClick={() => onSelectLot(lot)} style={{ cursor: "pointer", borderTop: "1px solid #1e293b" }}
                onMouseOver={e => e.currentTarget.style.background = "#1e293b22"}
                onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                <td style={{ padding: "10px 12px" }}>
                  <div style={{ fontWeight: 600, color: "#e2e8f0" }}>{lot.name}</div>
                  <div style={{ fontSize: 11, color: "#475569" }}>{lot.id}</div>
                </td>
                <td style={{ padding: "10px 12px", color: "#94a3b8" }}>{lot.cat}</td>
                <td style={{ padding: "10px 12px", color: "#cbd5e1", fontFamily: "monospace" }}>{fmt(lot.budget)}</td>
                <td style={{ padding: "10px 12px", color: lot.parts <= 1 ? "#ef4444" : lot.parts <= 2 ? "#eab308" : "#94a3b8", textAlign: "center", fontWeight: lot.parts <= 1 ? 700 : 400 }}>{lot.parts}</td>
                <td style={{ padding: "10px 12px", color: lot.days <= 3 ? "#ef4444" : "#94a3b8", textAlign: "center" }}>{lot.days} дн.</td>
                <td style={{ padding: "10px 12px", color: "#94a3b8" }}>{lot.city}</td>
                <td style={{ padding: "10px 12px" }}><RiskBadge level={lot.level} score={lot.score} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const LotDetailPage = ({ lot, onBack }) => {
  if (!lot) return null;
  return (
    <div>
      <button onClick={onBack} style={{
        display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px",
        borderRadius: 8, border: "1px solid #334155", background: "transparent",
        color: "#94a3b8", cursor: "pointer", marginBottom: 16, fontSize: 13,
      }}>← Назад к списку</button>

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 24 }}>
        {/* Score Gauge */}
        <div style={{ padding: 24, borderRadius: 12, background: "#0f172a", border: "1px solid #1e293b", textAlign: "center" }}>
          <GaugeChart score={lot.score} />
          <div style={{ marginTop: 8 }}><RiskBadge level={lot.level} /></div>
          <div style={{ marginTop: 16, textAlign: "left", fontSize: 12, color: "#64748b" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1e293b" }}>
              <span>Бюджет</span><span style={{ color: "#cbd5e1", fontFamily: "monospace" }}>{fmt(lot.budget)} ₸</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1e293b" }}>
              <span>Участники</span><span style={{ color: lot.parts <= 1 ? "#ef4444" : "#cbd5e1" }}>{lot.parts}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1e293b" }}>
              <span>Срок подачи</span><span style={{ color: lot.days <= 3 ? "#ef4444" : "#cbd5e1" }}>{lot.days} дн.</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
              <span>Город</span><span style={{ color: "#cbd5e1" }}>{lot.city}</span>
            </div>
          </div>
        </div>

        {/* Rules */}
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "#e2e8f0" }}>{lot.name}</h2>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>{lot.id} • {lot.cat}</div>

          {lot.rules.length > 0 ? (
            <>
              <h3 style={{ fontSize: 14, color: "#94a3b8", marginBottom: 12 }}>
                Сработавшие правила ({lot.rules.length})
              </h3>
              {lot.rules.map((r, i) => <RuleCard key={i} rule={r} />)}
            </>
          ) : (
            <div style={{ padding: 32, textAlign: "center", borderRadius: 12, background: "#052e16", border: "1px solid #22c55e33" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
              <div style={{ color: "#22c55e", fontSize: 16, fontWeight: 600 }}>Признаков заточки не обнаружено</div>
            </div>
          )}

          {lot.net_flags.length > 0 && (
            <div style={{ marginTop: 16, padding: 16, borderRadius: 8, background: "#1e1b4b", border: "1px solid #4338ca33" }}>
              <h4 style={{ margin: "0 0 8px", fontSize: 13, color: "#a5b4fc" }}>🔗 Сетевой анализ</h4>
              {lot.net_flags.map((f, i) => (
                <div key={i} style={{ fontSize: 13, color: "#c7d2fe", marginBottom: 4 }}>• {f}</div>
              ))}
            </div>
          )}

          {lot.similar.length > 0 && (
            <div style={{ marginTop: 16, padding: 16, borderRadius: 8, background: "#0f172a", border: "1px solid #1e293b" }}>
              <h4 style={{ margin: "0 0 8px", fontSize: 13, color: "#94a3b8" }}>📋 Похожие ТЗ</h4>
              {lot.similar.map((s, i) => (
                <div key={i} style={{ fontSize: 13, color: "#cbd5e1", marginBottom: 4 }}>
                  {s.name_ru} — совпадение {(s.similarity * 100).toFixed(0)}%
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ManualAnalysisPage = () => {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);

  const analyze = () => {
    if (!text.trim()) return;
    // Client-side rule matching (mirrors backend logic)
    const rules = [];
    const brands = ["Apple", "MacBook", "Dell", "HP", "Lenovo", "Samsung", "Toyota", "Lexus", "Hyundai", "Kia", "Siemens", "Philips", "Cisco", "Canon", "Xerox", "Agilent", "Kaspersky", "BMW", "Mercedes", "Audi"];
    brands.forEach(b => { if (text.match(new RegExp(`\\b${b}\\b`, "i"))) rules.push({ name: "Указание конкретного бренда", score: 35, expl: `Обнаружен бренд: ${b}`, evidence: "", sev: "danger" }); });
    if (rules.filter(r => r.name.includes("бренд")).length > 1) rules.splice(1, rules.filter(r => r.name.includes("бренд")).length - 1);
    if (text.match(/аналоги?\s+не\s+допуск/i) || text.match(/эквивалент\w*\s+не\s+допуск/i)) rules.push({ name: "Запрет аналогов", score: 40, expl: "Обнаружена фраза, запрещающая аналоги/эквиваленты.", evidence: "", sev: "critical" });
    if (text.match(/авторизованн\w+\s+(дилер|партн)/i) || text.match(/официальн\w+\s+дилер/i)) rules.push({ name: "Требование дилера", score: 30, expl: "Требуется статус авторизованного дилера.", evidence: "", sev: "warning" });
    if (text.match(/именно\s+[\d.,]+/i) || text.match(/ровно\s+[\d.,]+/i)) rules.push({ name: "Точные параметры", score: 25, expl: "Подозрительно точные параметры.", evidence: "", sev: "warning" });
    if (text.match(/эксклюзивн/i)) rules.push({ name: "Эксклюзивность", score: 40, expl: "Эксклюзивные условия.", evidence: "", sev: "critical" });

    const score = Math.min(100, rules.reduce((s, r) => s + r.score, 0));
    const level = score >= 76 ? "CRITICAL" : score >= 51 ? "HIGH" : score >= 26 ? "MEDIUM" : "LOW";
    setResult({ score, level, rules });
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 16px", fontSize: 18, color: "#e2e8f0" }}>Ручной анализ ТЗ</h2>
      <textarea value={text} onChange={e => setText(e.target.value)}
        placeholder="Вставьте текст технической спецификации для анализа..."
        style={{ width: "100%", height: 200, padding: 16, borderRadius: 12, border: "1px solid #334155", background: "#0f172a", color: "#e2e8f0", fontSize: 14, resize: "vertical", fontFamily: "inherit", lineHeight: 1.6, outline: "none", boxSizing: "border-box" }} />
      <button onClick={analyze} style={{
        marginTop: 12, padding: "12px 32px", borderRadius: 8, border: "none",
        background: "#3b82f6", color: "#fff", fontWeight: 700, fontSize: 14,
        cursor: "pointer", letterSpacing: "0.5px",
      }}>Анализировать</button>

      {result && (
        <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "200px 1fr", gap: 24 }}>
          <div style={{ textAlign: "center", padding: 20, borderRadius: 12, background: "#0f172a", border: "1px solid #1e293b" }}>
            <GaugeChart score={result.score} size={160} />
            <RiskBadge level={result.level} />
          </div>
          <div>
            {result.rules.length > 0 ? result.rules.map((r, i) => <RuleCard key={i} rule={r} />) : (
              <div style={{ padding: 32, textAlign: "center", borderRadius: 12, background: "#052e16", border: "1px solid #22c55e33", color: "#22c55e" }}>
                ✅ Признаков заточки не обнаружено
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main App ──────────────────────────────────────────────────────────
export default function GoszakupAIDashboard() {
  const [page, setPage] = useState("dashboard");
  const [selectedLot, setSelectedLot] = useState(null);

  const nav = [
    { id: "dashboard", icon: "📊", label: "Обзор" },
    { id: "lots", icon: "📋", label: "Лоты" },
    { id: "analyze", icon: "🔍", label: "Анализ" },
  ];

  const openLot = (lot) => { setSelectedLot(lot); setPage("detail"); };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#020617", color: "#e2e8f0", fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif" }}>
      {/* Sidebar */}
      <nav style={{ width: 220, background: "#0f172a", borderRight: "1px solid #1e293b", padding: "24px 0", flexShrink: 0 }}>
        <div style={{ padding: "0 20px 24px", borderBottom: "1px solid #1e293b" }}>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.5px" }}>
            <span style={{ color: "#3b82f6" }}>Goszakup</span>
            <span style={{ color: "#ef4444" }}>AI</span>
          </div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>Анализ рисков госзакупок РК</div>
        </div>
        <div style={{ padding: "16px 12px" }}>
          {nav.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "10px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                marginBottom: 4, fontSize: 14, textAlign: "left",
                background: page === n.id || (page === "detail" && n.id === "lots") ? "#1e293b" : "transparent",
                color: page === n.id || (page === "detail" && n.id === "lots") ? "#e2e8f0" : "#64748b",
              }}>
              <span>{n.icon}</span>{n.label}
            </button>
          ))}
        </div>
        <div style={{ position: "absolute", bottom: 20, left: 0, width: 220, padding: "0 20px" }}>
          <div style={{ fontSize: 10, color: "#334155", borderTop: "1px solid #1e293b", paddingTop: 12 }}>
            Хакатон 2026 • v0.1
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main style={{ flex: 1, padding: 32, overflowY: "auto", maxHeight: "100vh" }}>
        {page === "dashboard" && <DashboardPage lots={DEMO_LOTS} onSelectLot={openLot} />}
        {page === "lots" && <LotsListPage lots={DEMO_LOTS} onSelectLot={openLot} />}
        {page === "detail" && <LotDetailPage lot={selectedLot} onBack={() => setPage("lots")} />}
        {page === "analyze" && <ManualAnalysisPage />}
      </main>
    </div>
  );
}
