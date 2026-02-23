"""Извлечение признаков из лотов для ML."""
from dataclasses import dataclass, field, asdict
from collections import Counter

import numpy as np

from src.preprocessing.text_cleaner import clean_text
from src.preprocessing.ner_extractor import NERExtractor, NERResult


@dataclass
class LotFeatures:
    """Вектор признаков одного лота."""
    lot_id: str = ""

    has_brand: bool = False
    brand_count: int = 0
    brand_names: list[str] = field(default_factory=list)

    has_exclusive_phrase: bool = False
    exclusive_count: int = 0

    has_no_analogs: bool = False

    dealer_requirement: bool = False
    legal_marker_count: int = 0

    spec_precision_score: float = 0.0
    precise_param_count: int = 0

    geo_restriction: bool = False
    geo_count: int = 0

    standard_count: int = 0

    text_length: int = 0
    language: str = "ru"

    participants_count: int = 0
    deadline_days: int = 0
    budget: float = 0.0
    contract_sum: float = 0.0
    budget_ratio: float = 1.0  # budget / median for category

    winner_repeat_count: int = 0
    customer_winner_pair_count: int = 0

    max_similarity: float = 0.0
    is_copypaste: bool = False
    is_unique: bool = False

    category_code: str = ""

    def to_dict(self) -> dict:
        d = asdict(self)
        for k, v in d.items():
            if isinstance(v, (np.bool_, np.integer)):
                d[k] = int(v)
            elif isinstance(v, np.floating):
                d[k] = float(v)
        return d

    def to_feature_vector(self) -> list[float]:
        """Преобразует признаки в числовой вектор."""
        return [
            float(self.has_brand),
            float(self.brand_count),
            float(self.has_exclusive_phrase),
            float(self.exclusive_count),
            float(self.has_no_analogs),
            float(self.dealer_requirement),
            float(self.legal_marker_count),
            self.spec_precision_score,
            float(self.precise_param_count),
            float(self.geo_restriction),
            float(self.geo_count),
            float(self.standard_count),
            float(self.text_length),
            float(self.participants_count),
            float(self.deadline_days),
            self.budget_ratio,
            float(self.winner_repeat_count),
            float(self.customer_winner_pair_count),
            self.max_similarity,
            float(self.is_copypaste),
            float(self.is_unique),
        ]

    @staticmethod
    def feature_names() -> list[str]:
        return [
            "has_brand", "brand_count", "has_exclusive_phrase",
            "exclusive_count", "has_no_analogs", "dealer_requirement",
            "legal_marker_count", "spec_precision_score", "precise_param_count",
            "geo_restriction", "geo_count", "standard_count",
            "text_length", "participants_count", "deadline_days",
            "budget_ratio", "winner_repeat_count", "customer_winner_pair_count",
            "max_similarity", "is_copypaste", "is_unique",
        ]


class FeatureEngineer:
    """Извлекает признаки из лотов с помощью NER и чисел."""

    def __init__(self):
        self.ner = NERExtractor()
        self._category_budgets: dict[str, list[float]] = {}
        self._winner_counts: Counter = Counter()
        self._pair_counts: Counter = Counter()
        self._category_text_stats: dict[str, dict] = {}
        self._customer_ktru_counts: Counter = Counter()

    def fit_history(self, lots: list[dict]):
        """Считает исторические статистики для относительных признаков."""
        self._category_budgets.clear()
        self._winner_counts.clear()
        self._pair_counts.clear()
        self._customer_ktru_counts.clear()
        category_text_lengths: dict[str, list[int]] = {}

        for lot in lots:
            cat = lot.get("category_code", "")
            budget = lot.get("budget", 0)
            if cat and budget:
                self._category_budgets.setdefault(cat, []).append(budget)

            winner = lot.get("winner_bin", "")
            if winner:
                self._winner_counts[winner] += 1

            customer = lot.get("customer_bin", "")
            if winner and customer:
                self._pair_counts[(customer, winner)] += 1

            desc = clean_text(lot.get("desc_ru", "") + " " + lot.get("extra_desc_ru", ""))
            if cat and desc:
                category_text_lengths.setdefault(cat, []).append(len(desc))

            if customer and cat:
                self._customer_ktru_counts[(customer, cat)] += 1

        self._category_text_stats.clear()
        for cat, lengths in category_text_lengths.items():
            if len(lengths) >= 2:
                avg = sum(lengths) / len(lengths)
                variance = sum((x - avg) ** 2 for x in lengths) / len(lengths)
                self._category_text_stats[cat] = {
                    "avg": avg,
                    "std": variance ** 0.5,
                }

    def get_history_for_lot(self, lot: dict) -> dict:
        """Формирует словарь истории для RuleEngine.analyze()."""
        winner = lot.get("winner_bin", "")
        customer = lot.get("customer_bin", "")
        category = lot.get("category_code", "")
        text_stats = self._category_text_stats.get(category, {})
        return {
            "winner_wins_count": self._winner_counts.get(winner, 0),
            "category_median_budget": self._get_median_budget(category),
            "category_avg_text_length": text_stats.get("avg", 0),
            "category_std_text_length": text_stats.get("std", 0),
            "same_customer_ktru_lots_30d": self._customer_ktru_counts.get((customer, category), 0),
        }

    def _get_median_budget(self, category_code: str) -> float:
        """Медианный бюджет по категории."""
        budgets = self._category_budgets.get(category_code, [])
        if not budgets:
            return 0.0
        sorted_b = sorted(budgets)
        n = len(sorted_b)
        if n % 2 == 0:
            return (sorted_b[n // 2 - 1] + sorted_b[n // 2]) / 2
        return sorted_b[n // 2]

    def extract_features(self, lot: dict) -> LotFeatures:
        """Извлекает полный набор признаков из лота."""
        desc = clean_text(lot.get("desc_ru", "") + " " + lot.get("extra_desc_ru", ""))
        ner_result = self.ner.extract(desc)

        features = LotFeatures(lot_id=lot.get("lot_id", ""))

        features.has_brand = len(ner_result.brands) > 0
        features.brand_count = len(ner_result.brands)
        features.brand_names = [e.value for e in ner_result.brands]

        features.has_exclusive_phrase = len(ner_result.exclusive_phrases) > 0
        features.exclusive_count = len(ner_result.exclusive_phrases)
        features.has_no_analogs = any(
            "аналог" in e.value.lower() or "эквивалент" in e.value.lower()
            for e in ner_result.exclusive_phrases
        )

        features.dealer_requirement = len(ner_result.legal_markers) > 0
        features.legal_marker_count = len(ner_result.legal_markers)

        features.precise_param_count = len(ner_result.spec_params)
        features.spec_precision_score = min(1.0, len(ner_result.spec_params) / 5.0)

        features.geo_restriction = len(ner_result.geo_restrictions) > 0
        features.geo_count = len(ner_result.geo_restrictions)

        features.standard_count = len(ner_result.standards)

        features.text_length = len(desc)

        from src.preprocessing.text_cleaner import detect_language
        features.language = detect_language(desc)

        features.participants_count = lot.get("participants_count", 0)
        features.deadline_days = lot.get("deadline_days", 0)
        features.budget = lot.get("budget", 0)
        features.contract_sum = lot.get("contract_sum", 0)
        features.category_code = lot.get("category_code", "")

        median = self._get_median_budget(features.category_code)
        if median > 0:
            features.budget_ratio = features.budget / median
        else:
            features.budget_ratio = 1.0

        winner = lot.get("winner_bin", "")
        customer = lot.get("customer_bin", "")
        features.winner_repeat_count = self._winner_counts.get(winner, 0)
        features.customer_winner_pair_count = self._pair_counts.get(
            (customer, winner), 0
        )

        return features

    def extract_batch(self, lots: list[dict]) -> list[LotFeatures]:
        """Извлекает признаки для набора лотов."""
        return [self.extract_features(lot) for lot in lots]