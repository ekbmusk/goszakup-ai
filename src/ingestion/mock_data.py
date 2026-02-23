"""
GoszakupAI — Mock Data Generator
Генерирует реалистичные лоты госзакупок РК для разработки и тестирования.
"""
import json
import random
import uuid
from datetime import datetime, timedelta
from pathlib import Path


# === Справочники ===

KTRU_CATEGORIES = {
    "30213100-6": "Ноутбуки",
    "30213300-8": "Настольные компьютеры",
    "30232110-8": "Принтеры",
    "48000000-8": "Программное обеспечение",
    "34110000-1": "Легковые автомобили",
    "39130000-2": "Офисная мебель",
    "33100000-1": "Медицинское оборудование",
    "45000000-7": "Строительные работы",
    "55300000-3": "Услуги питания",
    "64200000-8": "Услуги связи",
    "50000000-5": "Услуги по ремонту",
    "22000000-0": "Полиграфическая продукция",
    "31000000-6": "Электрическое оборудование",
    "42000000-6": "Промышленное оборудование",
    "38000000-5": "Лабораторное оборудование",
}

BRANDS_BY_CATEGORY = {
    "30213100-6": ["Apple MacBook Pro", "Dell Latitude", "HP EliteBook", "Lenovo ThinkPad"],
    "30213300-8": ["Dell OptiPlex", "HP ProDesk", "Lenovo ThinkCentre"],
    "30232110-8": ["HP LaserJet Pro", "Canon imageRUNNER", "Xerox VersaLink"],
    "48000000-8": ["Microsoft Office 365", "Kaspersky Endpoint Security", "1C:Предприятие"],
    "34110000-1": ["Toyota Camry", "Lexus LX 570", "Hyundai Sonata", "Kia K5"],
    "33100000-1": ["Siemens Healthineers", "Philips IntelliVue", "GE Healthcare"],
    "38000000-5": ["Thermo Fisher Scientific", "Agilent Technologies"],
}

CUSTOMER_BINS = [
    "010140000151", "010140000284", "010140003077", "010140003521",
    "020140001872", "030140002155", "040140000613", "050140001790",
    "060140000344", "070140000877", "080140001234", "090140002567",
    "100140003890", "110140004123", "150140005456",
]

SUPPLIER_BINS = [
    "180340000111", "180340000222", "180340000333", "180340000444",
    "180340000555", "180340000666", "180340000777", "180340000888",
    "180340000999", "180340001010", "180340001111", "180340001212",
    "180340001313", "180340001414", "180340001515", "180340001616",
    "180340001717", "180340001818", "180340001919", "180340002020",
]

# Шаблоны ТЗ — чистые
CLEAN_SPECS = {
    "30213100-6": [
        "Поставка портативных компьютеров (ноутбуков) для нужд организации. "
        "Требования: процессор не ниже Intel Core i5 10-го поколения или аналог, "
        "оперативная память не менее 8 ГБ, SSD не менее 256 ГБ, "
        "экран не менее 14 дюймов, ОС с поддержкой казахского языка. "
        "Гарантия не менее 36 месяцев.",

        "Закупка ноутбуков для сотрудников. Характеристики: процессор с тактовой "
        "частотой не ниже 2.0 ГГц, ОЗУ от 16 ГБ, накопитель SSD от 512 ГБ, "
        "наличие USB-C, HDMI. Допускаются эквивалентные предложения.",
    ],
    "34110000-1": [
        "Приобретение служебного автомобиля категории B. Требования: двигатель "
        "бензиновый, объём от 2.0 до 3.0 литров, автоматическая коробка передач, "
        "полный привод, год выпуска не ранее 2024. Допускается любой производитель.",

        "Закупка легкового автомобиля. Мощность двигателя не менее 150 л.с., "
        "кондиционер, подушки безопасности не менее 6 шт., камера заднего вида, "
        "пробег 0 км (новый). Цвет: чёрный или белый.",
    ],
    "39130000-2": [
        "Приобретение офисной мебели: столы рабочие — 20 шт., кресла офисные — 20 шт., "
        "шкафы для документов — 10 шт. Материал стола: ЛДСП толщиной не менее 16 мм, "
        "размеры стола: ширина 1200±100 мм, глубина 600±50 мм.",
    ],
    "33100000-1": [
        "Закупка медицинского оборудования для поликлиники: аппарат УЗИ с конвексным "
        "и линейным датчиками, глубина сканирования не менее 30 см, "
        "экран не менее 15 дюймов, возможность сохранения изображений на USB. "
        "Соответствие ГОСТ Р ИСО 13485.",
    ],
}

# Шаблоны ТЗ — подозрительные (с заточкой)
SUSPICIOUS_SPECS = {
    "30213100-6": [
        "Поставка ноутбуков Apple MacBook Pro 16 M3 Max с оперативной памятью "
        "именно 36 ГБ унифицированной памяти, SSD 1 ТБ, экран Liquid Retina XDR. "
        "Аналоги не допускаются. Поставщик должен быть авторизованным дилером Apple "
        "на территории Республики Казахстан с наличием склада в г. Астана.",

        "Закупка ноутбуков Dell Latitude 5540 с процессором Intel Core i7-1365U "
        "(тактовая частота именно 1.80 ГГц, 12 ядер), ОЗУ DDR5 16 ГБ 4800 МГц, "
        "SSD M.2 PCIe NVMe 512 ГБ, масса устройства не более 1.534 кг. "
        "Эксклюзивный поставщик. Срок гарантии — 60 месяцев.",

        "Требуется поставка 50 единиц HP EliteBook 860 G10 с процессором "
        "Intel Core i7-1370P, дисплей 16 дюймов WUXGA IPS с антибликовым покрытием, "
        "вес ровно 1.81 кг. Обязательно наличие сертификата MIL-STD-810H. "
        "Поставщик обязан иметь сервисный центр HP в радиусе 30 км от г. Астана.",
    ],
    "34110000-1": [
        "Приобретение автомобиля Toyota Land Cruiser 300 GR Sport в комплектации "
        "с двигателем V6 3.3 л дизель (309 л.с.), полный привод, АКПП 10 ступеней, "
        "система Multi-Terrain Select, 20-дюймовые литые диски. "
        "Цвет: Precious White Pearl (код 070). Аналоги не рассматриваются.",

        "Закупка автомобиля Lexus LX 600 F Sport в чёрном цвете (код 223), "
        "двигатель V6 3.5 Twin-Turbo ровно 409 л.с., гидропневматическая "
        "подвеска AHC, система Mark Levinson Premium Surround Sound 25 динамиков. "
        "Поставщик — официальный дилер Lexus в РК.",
    ],
    "33100000-1": [
        "Закупка ультразвукового аппарата Philips EPIQ Elite с количеством "
        "каналов приёма ровно 200704, технология nSIGHT Imaging, датчик eL18-4 "
        "с частотой именно 18 МГц. Наличие модуля Anatomical Intelligence. "
        "Аналоги не допускаются. Поставщик должен иметь статус авторизованного "
        "партнёра Philips Healthcare в Казахстане.",
    ],
    "48000000-8": [
        "Поставка лицензий Kaspersky Endpoint Security для бизнеса Расширенный, "
        "версия именно 12.3, с поддержкой EDR Optimum и Sandbox. "
        "Только прямые поставки от Kaspersky Lab. Сублицензирование не допускается.",
    ],
    "38000000-5": [
        "Закупка хроматографа Agilent 1260 Infinity II LC с детектором DAD "
        "(модель G7117C), автосамплером G7129A, термостатом колонок G7116A. "
        "Программное обеспечение OpenLab CDS версии 2.7. "
        "Аналоги не допускаются. Поставщик обязан пройти обучение в Agilent.",
    ],
}

# Шаблоны ТЗ — критические (несколько красных флагов сразу)
CRITICAL_SPECS = [
    (
        "30213100-6",
        "Срочная закупка 100 единиц Apple MacBook Pro 14 M3 Pro с процессором "
        "Apple M3 Pro (12-ядерный CPU, 18-ядерный GPU), унифицированная память "
        "ровно 18 ГБ, SSD 512 ГБ, масса ровно 1.60 кг, экран Liquid Retina XDR "
        "3024×1964 пикселей, яркость SDR именно 600 нит. Адаптер питания USB-C "
        "мощностью 70 Вт. Аналоги не допускаются. Эквиваленты не рассматриваются. "
        "Поставщик должен быть авторизованным реселлером Apple (подтвердить "
        "письмом от Apple Kazakhstan), иметь собственный склад в г. Астана "
        "площадью не менее 200 кв.м., опыт поставок аналогичного оборудования "
        "государственным органам РК не менее 3 лет.",
        {"deadline_days": 2, "participants_count": 1, "budget_multiplier": 3.5},
    ),
    (
        "34110000-1",
        "Приобретение представительского автомобиля Lexus LS 500h Executive "
        "в комплектации с двигателем V6 3.5 л + электромотор (354 л.с.), "
        "полный привод E-Four, массажные сиденья, 28-дюймовый задний дисплей, "
        "система Lexus CoDrive, шумоподавление Active Noise Control. "
        "Цвет: Sonic Iridium (код 1L2). Кожа: Semi-aniline перфорированная "
        "цвет Chateau. Аналоги и эквиваленты не допускаются. "
        "Только от официального дилера Lexus с сервисным центром в г. Астана.",
        {"deadline_days": 1, "participants_count": 1, "budget_multiplier": 4.0},
    ),
    (
        "33100000-1",
        "Закупка МРТ-аппарата Siemens MAGNETOM Vida 3T с мощностью градиентов "
        "ровно 60 мТл/м, скоростью нарастания 200 Тл/м/с, технология BioMatrix, "
        "Tim 4G (204 канала), туннель длиной ровно 163 см, диаметром 70 см. "
        "Программное обеспечение syngo MR XA51. Аналоги категорически "
        "не допускаются. Поставщик обязан иметь статус Siemens Healthineers "
        "Advanced Partner, опыт установки МРТ 3T в РК не менее 5 объектов, "
        "наличие сертифицированных инженеров (не менее 3-х).",
        {"deadline_days": 3, "participants_count": 1, "budget_multiplier": 2.8},
    ),
]

CITIES = ["Астана", "Алматы", "Шымкент", "Караганда", "Актобе", "Атырау",
          "Павлодар", "Усть-Каменогорск", "Семей", "Костанай", "Тараз"]

CUSTOMER_NAMES = [
    "ГУ «Управление образования города Астаны»",
    "РГП «Казахский национальный университет»",
    "АО «Национальный центр нейрохирургии»",
    "ГУ «Управление здравоохранения Алматинской области»",
    "РГП «Казахстанский институт метрологии»",
    "ГУ «Департамент полиции города Астаны»",
    "АО «Казахтелеком»",
    "ГУ «Управление строительства Карагандинской области»",
    "ТОО «National Information Technologies»",
    "РГП «Республиканская клиническая больница»",
    "ГУ «Аппарат акима Шымкента»",
    "АО «Национальный медицинский холдинг»",
    "ГУ «Управление цифровизации города Алматы»",
    "РГП «Национальный центр экспертизы»",
    "ГУ «Управление финансов Атырауской области»",
]


def _random_date(start_days_ago=90, end_days_ago=1):
    """Random date within range."""
    delta = random.randint(end_days_ago, start_days_ago)
    return datetime.now() - timedelta(days=delta)


def _generate_clean_lot(idx: int) -> dict:
    """Generate a normal (clean) lot."""
    cat_code = random.choice(list(CLEAN_SPECS.keys()))
    spec = random.choice(CLEAN_SPECS[cat_code])
    cat_name = KTRU_CATEGORIES[cat_code]

    base_prices = {
        "30213100-6": 450_000, "34110000-1": 15_000_000,
        "39130000-2": 2_500_000, "33100000-1": 25_000_000,
    }
    base = base_prices.get(cat_code, 5_000_000)
    budget = int(base * random.uniform(0.8, 1.3))

    publish_date = _random_date()
    deadline_days = random.randint(5, 15)
    end_date = publish_date + timedelta(days=deadline_days)
    participants = random.randint(3, 12)

    customer_bin = random.choice(CUSTOMER_BINS)
    winner_bin = random.choice(SUPPLIER_BINS)

    return {
        "lot_id": f"LOT-{10000 + idx}",
        "trd_buy_id": f"TRD-{20000 + idx}",
        "name_ru": f"Закупка: {cat_name}",
        "desc_ru": spec,
        "extra_desc_ru": "",
        "category_code": cat_code,
        "category_name": cat_name,
        "budget": budget,
        "contract_sum": int(budget * random.uniform(0.85, 0.99)),
        "publish_date": publish_date.isoformat(),
        "end_date": end_date.isoformat(),
        "deadline_days": deadline_days,
        "participants_count": participants,
        "customer_bin": customer_bin,
        "customer_name": random.choice(CUSTOMER_NAMES),
        "winner_bin": winner_bin,
        "city": random.choice(CITIES),
        "status": "PUBLISHED",
        "label": "clean",
    }


def _generate_suspicious_lot(idx: int) -> dict:
    """Generate a suspicious lot with brand/exclusive markers."""
    cat_code = random.choice(list(SUSPICIOUS_SPECS.keys()))
    spec = random.choice(SUSPICIOUS_SPECS[cat_code])
    cat_name = KTRU_CATEGORIES[cat_code]

    base_prices = {
        "30213100-6": 450_000, "34110000-1": 15_000_000,
        "33100000-1": 25_000_000, "48000000-8": 3_000_000,
        "38000000-5": 20_000_000,
    }
    base = base_prices.get(cat_code, 5_000_000)
    budget = int(base * random.uniform(1.3, 2.0))

    publish_date = _random_date()
    deadline_days = random.randint(3, 7)
    end_date = publish_date + timedelta(days=deadline_days)
    participants = random.randint(1, 3)

    # Повторяющийся победитель
    winner_bin = random.choice(SUPPLIER_BINS[:5])
    customer_bin = random.choice(CUSTOMER_BINS[:5])

    return {
        "lot_id": f"LOT-{10000 + idx}",
        "trd_buy_id": f"TRD-{20000 + idx}",
        "name_ru": f"Закупка: {cat_name}",
        "desc_ru": spec,
        "extra_desc_ru": "",
        "category_code": cat_code,
        "category_name": cat_name,
        "budget": budget,
        "contract_sum": int(budget * random.uniform(0.95, 1.0)),
        "publish_date": publish_date.isoformat(),
        "end_date": end_date.isoformat(),
        "deadline_days": deadline_days,
        "participants_count": participants,
        "customer_bin": customer_bin,
        "customer_name": random.choice(CUSTOMER_NAMES),
        "winner_bin": winner_bin,
        "city": random.choice(CITIES[:3]),
        "status": "PUBLISHED",
        "label": "suspicious",
    }


def _generate_critical_lot(idx: int, template: tuple) -> dict:
    """Generate a critical lot from template."""
    cat_code, spec, params = template
    cat_name = KTRU_CATEGORIES[cat_code]

    base_prices = {
        "30213100-6": 450_000, "34110000-1": 15_000_000,
        "33100000-1": 80_000_000,
    }
    base = base_prices.get(cat_code, 10_000_000)
    multiplier = params.get("budget_multiplier", 3.0)
    budget = int(base * multiplier)

    publish_date = _random_date(30, 5)
    deadline_days = params.get("deadline_days", 2)
    end_date = publish_date + timedelta(days=deadline_days)

    # Один и тот же победитель и заказчик — аффилированность
    winner_bin = SUPPLIER_BINS[0]
    customer_bin = CUSTOMER_BINS[0]

    return {
        "lot_id": f"LOT-{10000 + idx}",
        "trd_buy_id": f"TRD-{20000 + idx}",
        "name_ru": f"Закупка: {cat_name}",
        "desc_ru": spec,
        "extra_desc_ru": "",
        "category_code": cat_code,
        "category_name": cat_name,
        "budget": budget,
        "contract_sum": int(budget * 0.99),
        "publish_date": publish_date.isoformat(),
        "end_date": end_date.isoformat(),
        "deadline_days": deadline_days,
        "participants_count": params.get("participants_count", 1),
        "customer_bin": customer_bin,
        "customer_name": CUSTOMER_NAMES[0],
        "winner_bin": winner_bin,
        "city": "Астана",
        "status": "PUBLISHED",
        "label": "critical",
    }


def generate_mock_dataset(
    n_clean: int = 40,
    n_suspicious: int = 25,
) -> list[dict]:
    """Generate full mock dataset."""
    lots = []
    idx = 0

    # Clean lots
    for i in range(n_clean):
        lots.append(_generate_clean_lot(idx))
        idx += 1

    # Suspicious lots
    for i in range(n_suspicious):
        lots.append(_generate_suspicious_lot(idx))
        idx += 1

    # Critical lots
    for template in CRITICAL_SPECS:
        lots.append(_generate_critical_lot(idx, template))
        idx += 1

    # Make some suppliers repeat winners (for repeat_winner detection)
    repeat_winner = SUPPLIER_BINS[0]
    repeat_customer = CUSTOMER_BINS[0]
    for lot in lots:
        if lot["label"] in ("suspicious", "critical"):
            if random.random() < 0.6:
                lot["winner_bin"] = repeat_winner
            if random.random() < 0.4:
                lot["customer_bin"] = repeat_customer

    random.shuffle(lots)
    return lots


def save_mock_data(output_path: str | Path | None = None) -> list[dict]:
    """Generate and save mock data to JSON."""
    from src.utils.config import RAW_DIR

    if output_path is None:
        output_path = RAW_DIR / "mock_lots.json"

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    lots = generate_mock_dataset()

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(lots, f, ensure_ascii=False, indent=2)

    print(f"[MockData] Generated {len(lots)} lots -> {output_path}")
    stats = {}
    for lot in lots:
        label = lot["label"]
        stats[label] = stats.get(label, 0) + 1
    for label, count in stats.items():
        print(f"  {label}: {count}")

    return lots


if __name__ == "__main__":
    save_mock_data()