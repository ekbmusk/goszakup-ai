"""Извлечение сущностей из технических спецификаций."""
import re
from dataclasses import dataclass, field


@dataclass
class Entity:
    """Одна найденная сущность."""
    type: str
    value: str
    start: int
    end: int
    confidence: float = 1.0
    metadata: dict = field(default_factory=dict)


@dataclass
class NERResult:
    """Набор найденных сущностей."""
    brands: list[Entity] = field(default_factory=list)
    standards: list[Entity] = field(default_factory=list)
    spec_params: list[Entity] = field(default_factory=list)
    legal_markers: list[Entity] = field(default_factory=list)
    geo_restrictions: list[Entity] = field(default_factory=list)
    exclusive_phrases: list[Entity] = field(default_factory=list)

    @property
    def all_entities(self) -> list[Entity]:
        return (
            self.brands + self.standards + self.spec_params +
            self.legal_markers + self.geo_restrictions + self.exclusive_phrases
        )

    def to_dict(self) -> dict:
        return {
            "brands": [{"value": e.value, "start": e.start, "end": e.end} for e in self.brands],
            "standards": [{"value": e.value, "start": e.start, "end": e.end} for e in self.standards],
            "spec_params": [{"value": e.value, "start": e.start, "end": e.end} for e in self.spec_params],
            "legal_markers": [{"value": e.value, "start": e.start, "end": e.end} for e in self.legal_markers],
            "geo_restrictions": [{"value": e.value, "start": e.start, "end": e.end} for e in self.geo_restrictions],
            "exclusive_phrases": [{"value": e.value, "start": e.start, "end": e.end} for e in self.exclusive_phrases],
        }


# === Словарь брендов ===
# ИТ / электроника
_IT_BRANDS = [
    "Apple", "MacBook", "iPhone", "iPad", "iMac",
    "Dell", "Latitude", "OptiPlex", "Inspiron", "XPS",
    "HP", "EliteBook", "ProBook", "ProDesk", "ZBook", "LaserJet",
    "Lenovo", "ThinkPad", "ThinkCentre", "IdeaPad", "Legion",
    "Samsung", "Galaxy",
    "Asus", "ROG", "ZenBook",
    "Acer", "Aspire",
    "Microsoft", "Surface",
    "Canon", "imageRUNNER",
    "Xerox", "VersaLink", "AltaLink",
    "Epson",
    "Cisco", "Catalyst", "Meraki",
    "Huawei", "MateBook",
    "Intel Core",
    "AMD Ryzen",
]

# ПО
_SW_BRANDS = [
    "Microsoft Office", "Windows", "Azure",
    "Kaspersky", "ESET NOD32",
    "1C:Предприятие", "1С:Предприятие", "1C:Бухгалтерия",
    "SAP", "Oracle",
    "Autodesk", "AutoCAD",
    "Adobe", "Photoshop",
    "VMware", "vSphere",
]

# Авто
_AUTO_BRANDS = [
    "Toyota", "Land Cruiser", "Camry", "Corolla", "Hilux", "RAV4", "Prado",
    "Lexus", "LX", "RX", "NX", "ES", "LS",
    "Hyundai", "Sonata", "Tucson", "Santa Fe", "Palisade",
    "Kia", "K5", "K7", "Sportage", "Sorento", "Carnival",
    "Chevrolet", "Tahoe", "Traverse",
    "BMW",
    "Mercedes-Benz", "Mercedes",
    "Audi",
    "Volkswagen", "Passat", "Tiguan",
    "Mitsubishi", "Pajero", "Outlander",
    "Nissan", "Patrol", "X-Trail",
    "Ford", "Explorer",
]

# Медицинское
_MED_BRANDS = [
    "Siemens", "Healthineers", "MAGNETOM",
    "Philips", "IntelliVue", "EPIQ",
    "GE Healthcare",
    "Mindray",
    "Dräger", "Drager",
    "Olympus",
    "Medtronic",
    "Stryker",
    "Roche",
]

# Лабораторное / промышленное
_LAB_BRANDS = [
    "Thermo Fisher", "Scientific",
    "Agilent", "Technologies",
    "Shimadzu",
    "Bruker",
    "Waters",
    "PerkinElmer",
    "Mettler Toledo",
]

ALL_BRANDS = _IT_BRANDS + _SW_BRANDS + _AUTO_BRANDS + _MED_BRANDS + _LAB_BRANDS

# Шаблоны брендов (без учета регистра, по границам слов)
_BRAND_PATTERNS = []
for brand in sorted(ALL_BRANDS, key=len, reverse=True):
    escaped = re.escape(brand)
    pattern = re.compile(r"\b" + escaped + r"\b", re.IGNORECASE)
    _BRAND_PATTERNS.append((brand, pattern))


# === Ограничительные формулировки ===
_EXCLUSIVE_PATTERNS = [
    (re.compile(r"аналоги\s+не\s+допуска(?:ю|е)тся", re.IGNORECASE), "аналоги не допускаются"),
    (re.compile(r"эквивалент\w*\s+не\s+(?:допуска|рассматрива)", re.IGNORECASE), "эквиваленты не допускаются"),
    (re.compile(r"аналоги\s+и\s+эквивалент\w*\s+не\s+допуска", re.IGNORECASE), "аналоги и эквиваленты не допускаются"),
    (re.compile(r"эквивалент\w*\s+не\s+рассматрива", re.IGNORECASE), "эквиваленты не рассматриваются"),
    (re.compile(r"аналоги\s+не\s+рассматрива", re.IGNORECASE), "аналоги не рассматриваются"),
    (re.compile(r"эксклюзивн\w+\s+постав", re.IGNORECASE), "эксклюзивный поставщик"),
    (re.compile(r"только\s+(?:от\s+)?(?:прям\w+\s+)?постав\w+\s+от", re.IGNORECASE), "только поставки от"),
    (re.compile(r"категорически\s+не\s+допуска", re.IGNORECASE), "категорически не допускаются"),
    (re.compile(r"сублицензирование\s+не\s+допуска", re.IGNORECASE), "сублицензирование не допускается"),
    (re.compile(r"только\s+оригинальн\w+", re.IGNORECASE), "только оригинальное"),
    (re.compile(r"только\s+прямые\s+поставки", re.IGNORECASE), "только прямые поставки"),
]

# === Юридические/дилерские маркеры ===
_LEGAL_PATTERNS = [
    (re.compile(r"авторизованн\w+\s+(?:дилер|партн[её]р|реселлер|представител)", re.IGNORECASE), "авторизованный дилер/партнёр"),
    (re.compile(r"официальн\w+\s+(?:дилер|партн[её]р|представител|поставщик)", re.IGNORECASE), "официальный дилер/партнёр"),
    (re.compile(r"подтвердить\s+письмом\s+от", re.IGNORECASE), "подтверждение письмом от производителя"),
    (re.compile(r"статус\w*\s+(?:авторизованн|сертифицированн)", re.IGNORECASE), "требование статуса"),
    (re.compile(r"сертификат\w*\s+(?:дилер|партн[её]р)", re.IGNORECASE), "сертификат дилера"),
    (re.compile(r"опыт\s+(?:поставок|установки|внедрения)\s+.*?не\s+менее\s+\d+", re.IGNORECASE), "требование опыта"),
]

# === Гео-ограничения ===
_GEO_PATTERNS = [
    (re.compile(r"(?:склад|офис|сервисн\w+\s+центр)\s+в\s+(?:г\.?\s*)?(?:Астан|Алмат|Шымкент|Караганд|Акто|Атыра|Павлодар)", re.IGNORECASE), "географическое ограничение (город)"),
    (re.compile(r"в\s+(?:радиусе|пределах)\s+\d+\s*(?:км|километр)", re.IGNORECASE), "ограничение по радиусу"),
    (re.compile(r"собственн\w+\s+склад\w*\s+.*?площад\w+\s+не\s+менее", re.IGNORECASE), "требование к складу"),
    (re.compile(r"на\s+территории\s+(?:Республики\s+)?Казахстан", re.IGNORECASE), "ограничение территорией РК"),
    (re.compile(r"сервисн\w+\s+центр\w*\s+.*?в\s+(?:радиусе|пределах|г\.?)", re.IGNORECASE), "требование сервисного центра"),
]

# === Стандарты ===
_STANDARD_PATTERNS = [
    (re.compile(r"ГОСТ\s*(?:Р\s*)?(?:ИСО\s*)?\d[\d.\-]*", re.IGNORECASE), "ГОСТ"),
    (re.compile(r"СТ\s+РК\s+\d[\d.\-]*", re.IGNORECASE), "СТ РК"),
    (re.compile(r"ISO\s+\d[\d.\-:]*", re.IGNORECASE), "ISO"),
    (re.compile(r"MIL-STD-\d+\w*", re.IGNORECASE), "MIL-STD"),
    (re.compile(r"ТУ\s+\d[\d.\-]*", re.IGNORECASE), "ТУ"),
    (re.compile(r"IEC\s+\d[\d.\-]*", re.IGNORECASE), "IEC"),
]

# === Подозрительно точные параметры ===
_PRECISE_PATTERNS = [
    (re.compile(r"именно\s+[\d.,]+\s*\w+", re.IGNORECASE), "именно N"),
    (re.compile(r"ровно\s+[\d.,]+\s*\w+", re.IGNORECASE), "ровно N"),
    (re.compile(r"\b\d+\.\d{3,}\s*(?:кг|г|мм|см|м|кВт|Вт|МГц|ГГц|Тл|л\.?\s?с\.?|нит|кв\.?\s*м)", re.IGNORECASE), "precise decimal"),
    (re.compile(r"(?:ровно|именно|составляет)\s+\d{4,}", re.IGNORECASE), "precise large number"),
    (re.compile(r"\(код\s+\w{2,5}\)", re.IGNORECASE), "color/model code"),
    (re.compile(r"(?:модель|артикул|каталожный\s+номер)\s+[A-Z]\d{3,}\w*", re.IGNORECASE), "exact model number"),
]


class NERExtractor:
    """Извлекает сущности из текста ТЗ."""

    def extract(self, text: str) -> NERResult:
        """Полный проход извлечения сущностей."""
        result = NERResult()

        if not text:
            return result

        result.brands = self._extract_brands(text)
        result.standards = self._extract_standards(text)
        result.spec_params = self._extract_precise_specs(text)
        result.legal_markers = self._extract_legal(text)
        result.geo_restrictions = self._extract_geo(text)
        result.exclusive_phrases = self._extract_exclusive(text)

        return result

    def _extract_brands(self, text: str) -> list[Entity]:
        """Ищет упоминания брендов."""
        found = []
        seen_positions = set()

        for brand_name, pattern in _BRAND_PATTERNS:
            for match in pattern.finditer(text):
                pos = (match.start(), match.end())
                if any(s <= match.start() < e or s < match.end() <= e for s, e in seen_positions):
                    continue

                found.append(Entity(
                    type="brand",
                    value=match.group(),
                    start=match.start(),
                    end=match.end(),
                    metadata={"canonical": brand_name},
                ))
                seen_positions.add(pos)

        return found

    def _extract_standards(self, text: str) -> list[Entity]:
        """Ищет ссылки на стандарты (ГОСТ, ISO и т.п.)."""
        found = []
        for pattern, std_type in _STANDARD_PATTERNS:
            for match in pattern.finditer(text):
                found.append(Entity(
                    type="standard",
                    value=match.group(),
                    start=match.start(),
                    end=match.end(),
                    metadata={"standard_type": std_type},
                ))
        return found

    def _extract_precise_specs(self, text: str) -> list[Entity]:
        """Ищет подозрительно точные параметры."""
        found = []
        for pattern, spec_type in _PRECISE_PATTERNS:
            for match in pattern.finditer(text):
                found.append(Entity(
                    type="spec_param",
                    value=match.group(),
                    start=match.start(),
                    end=match.end(),
                    metadata={"precision_type": spec_type},
                ))
        return found

    def _extract_legal(self, text: str) -> list[Entity]:
        """Find dealer/partner requirements."""
        found = []
        for pattern, marker_type in _LEGAL_PATTERNS:
            for match in pattern.finditer(text):
                found.append(Entity(
                    type="legal",
                    value=match.group(),
                    start=match.start(),
                    end=match.end(),
                    metadata={"marker_type": marker_type},
                ))
        return found

    def _extract_geo(self, text: str) -> list[Entity]:
        """Find geographical restrictions."""
        found = []
        for pattern, geo_type in _GEO_PATTERNS:
            for match in pattern.finditer(text):
                found.append(Entity(
                    type="geo",
                    value=match.group(),
                    start=match.start(),
                    end=match.end(),
                    metadata={"geo_type": geo_type},
                ))
        return found

    def _extract_exclusive(self, text: str) -> list[Entity]:
        """Find exclusive/restrictive phrases."""
        found = []
        for pattern, phrase_type in _EXCLUSIVE_PATTERNS:
            for match in pattern.finditer(text):
                found.append(Entity(
                    type="exclusive",
                    value=match.group(),
                    start=match.start(),
                    end=match.end(),
                    metadata={"phrase_type": phrase_type},
                ))
        return found