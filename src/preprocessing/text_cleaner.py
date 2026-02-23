"""Очистка и нормализация текстов ТЗ."""
import re
import unicodedata


def clean_text(text: str) -> str:
    """Полная очистка текста ТЗ."""
    if not text:
        return ""

    text = re.sub(r"<[^>]+>", " ", text)

    text = unicodedata.normalize("NFKC", text)

    text = text.replace("\xa0", " ").replace("\t", " ")

    text = re.sub(r"\s+", " ", text).strip()

    text = re.sub(r"[\u200b\u200c\u200d\ufeff]", "", text)

    return text


def detect_language(text: str) -> str:
    """Определяет язык текста: kz, ru или mixed."""
    if not text:
        return "ru"

    kz_chars = set("ӘәҒғҚқҢңӨөҰұҮүҺһІі")
    kz_count = sum(1 for c in text if c in kz_chars)

    ru_only = set("ЁёЭэЪъ")
    ru_count = sum(1 for c in text if c in ru_only)

    total_cyrillic = sum(1 for c in text if "\u0400" <= c <= "\u04ff")

    if total_cyrillic == 0:
        return "ru"

    kz_ratio = kz_count / total_cyrillic if total_cyrillic else 0

    if kz_ratio > 0.05:
        return "kz" if kz_ratio > 0.15 else "mixed"
    return "ru"


def extract_sentences(text: str) -> list[str]:
    """Делит текст на предложения."""
    if not text:
        return []

    sentences = re.split(r"(?<=[.!?;])\s+", text)
    return [s.strip() for s in sentences if s.strip()]


def normalize_numbers(text: str) -> str:
    """Нормализует числовые форматы."""
    text = re.sub(r"(\d),(\d{1,3})(?!\d)", r"\1.\2", text)
    return text