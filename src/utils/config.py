"""Конфигурация GoszakupAI."""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()


def _parse_csv_env(value: str, default: list[str]) -> list[str]:
    """Парсит CSV-строку из окружения в список."""
    items = [item.strip() for item in value.split(",") if item.strip()]
    return items or default

# Пути
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
MODELS_DIR = DATA_DIR / "models"

# API goszakup
GOSZAKUP_TOKEN = os.getenv("GOSZAKUP_TOKEN", "")
GOSZAKUP_BASE_URL = "https://ows.goszakup.gov.kz"
GOSZAKUP_GRAPHQL_URL = f"{GOSZAKUP_BASE_URL}/v3/graphql"

# Безопасность API
API_KEY = os.getenv("API_KEY", "")
CORS_ALLOWED_ORIGINS = _parse_csv_env(
    os.getenv("CORS_ALLOWED_ORIGINS", 
             "http://127.0.0.1:8006,https://*.github.io,https://*.pages.dev,https://afm.software,https://www.afm.software"),
    ["http://127.0.0.1:8006", "http://localhost:8006", "http://localhost:3000", "null"],
)

# Обучение
FORCE_TRAIN = os.getenv("FORCE_TRAIN", "0").strip().lower() in {"1", "true", "yes"}
EXPORT_TRAIN_DATA = os.getenv("EXPORT_TRAIN_DATA", "0").strip().lower() in {"1", "true", "yes"}
LABELS_CSV = os.getenv("LABELS_CSV", "").strip()

# Пороги риска
RISK_THRESHOLDS = {
    "LOW": (0, 25),
    "MEDIUM": (26, 50),
    "HIGH": (51, 75),
    "CRITICAL": (76, 100),
}

# Веса правил
RULE_WEIGHTS = {
    "brand_mention": 35,
    "exclusive_phrase": 40,
    "no_analogs": 40,
    "dealer_requirement": 30,
    "precise_specs": 25,
    "single_participant": 25,
    "short_deadline": 20,
    "repeat_winner": 20,
    "price_anomaly": 20,
    "geo_restriction": 15,
}

# NLP
EMBEDDING_MODEL = "sentence-transformers/LaBSE"
SIMILARITY_COPYPASTE_THRESHOLD = 0.95
SIMILARITY_UNIQUE_THRESHOLD = 0.30

# ML
CATBOOST_ITERATIONS = 500
CATBOOST_DEPTH = 6
CATBOOST_LR = 0.1

# API
API_HOST = "0.0.0.0"
API_PORT = 8000


def get_risk_level(score: float) -> str:
    """Преобразует числовой балл в уровень риска."""
    for level, (lo, hi) in RISK_THRESHOLDS.items():
        if lo <= score <= hi:
            return level
    return "CRITICAL" if score > 75 else "LOW"


def _update_env_file(key: str, value: str, env_path: Path) -> None:
    """Обновляет или добавляет ключ в файле .env."""
    if env_path.exists():
        content = env_path.read_text(encoding="utf-8").splitlines()
    else:
        content = []

    updated = False
    new_lines = []
    for line in content:
        if line.strip().startswith(f"{key}="):
            new_lines.append(f"{key}={value}")
            updated = True
        else:
            new_lines.append(line)

    if not updated:
        new_lines.append(f"{key}={value}")

    env_path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")


def set_goszakup_token(token: str, persist: bool = True) -> None:
    """Устанавливает GOSZAKUP_TOKEN и при необходимости пишет в .env."""
    global GOSZAKUP_TOKEN
    token = token.strip()
    GOSZAKUP_TOKEN = token
    os.environ["GOSZAKUP_TOKEN"] = token

    if persist:
        env_path = BASE_DIR / ".env"
        _update_env_file("GOSZAKUP_TOKEN", token, env_path)