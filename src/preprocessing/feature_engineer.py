"""Извлечение признаков из лотов для ML."""
from dataclasses import dataclass, field, asdict
from collections import Counter
from datetime import datetime, timedelta

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
        self._category_budgets: dict[str, list[float]] = {}  # stores unit_price with fallback to budget
        self._customer_winner_counts: Counter = Counter()  # (customer, winner) pairs - TOTAL count
        self._pair_counts: Counter = Counter()
        self._category_text_stats: dict[str, dict] = {}
        self._customer_ktru_history: dict[tuple, list[dict]] = {}  # (customer, ktru) -> [{"date": str, "lot_id": str}]
        self._customer_winner_history: dict[tuple, list[dict]] = {}  # (customer, winner) -> [{"date": str, "lot_id": str}]

    def fit_history(self, lots: list[dict]):
        """Считает исторические статистики для относительных признаков."""
        self._category_budgets.clear()
        self._customer_winner_counts.clear()
        self._pair_counts.clear()
        self._customer_ktru_history.clear()
        self._customer_winner_history.clear()
        category_text_lengths: dict[str, list[int]] = {}

        for lot in lots:
            cat = lot.get("category_code", "")
            
            # Use unit_price if available and > 0, otherwise fallback to budget
            unit_price = lot.get("unit_price", 0) or 0
            budget = lot.get("budget", 0) or 0
            quantity = lot.get("quantity", 0) or 0
            
            # Calculate effective price
            if unit_price > 0:
                price = unit_price
            elif budget > 0 and quantity > 0:
                price = budget / quantity  # Calculate unit price from budget
            elif budget > 0:
                price = budget  # Fallback to total budget
            else:
                price = 0
            
            if cat and price > 0:
                self._category_budgets.setdefault(cat, []).append(price)

            winner = lot.get("winner_bin", "")
            customer = lot.get("customer_bin", "")
            lot_id = lot.get("lot_id", "")
            publish_date = lot.get("publish_date", "")
            
            # Count per (customer, winner) pair for collusion detection
            if winner and customer:
                self._customer_winner_counts[(customer, winner)] += 1
                self._pair_counts[(customer, winner)] += 1

            desc = clean_text(lot.get("desc_ru", "") + " " + lot.get("extra_desc_ru", ""))
            if cat and desc:
                category_text_lengths.setdefault(cat, []).append(len(desc))

            # Store dates for temporal window calculation - for same customer KTRU in 30 days
            if customer and cat:
                if publish_date:
                    self._customer_ktru_history.setdefault((customer, cat), []).append({
                        "date": publish_date.split()[0],  # Extract just the date part YYYY-MM-DD
                        "lot_id": lot_id
                    })
            
            # Store dates for winner repeat history - for same customer winner in 30 days
            if customer and winner:
                if publish_date:
                    self._customer_winner_history.setdefault((customer, winner), []).append({
                        "date": publish_date.split()[0],  # Extract just the date part YYYY-MM-DD
                        "lot_id": lot_id
                    })

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
        
        # Calculate 30-day window for customer-ktru repeats
        same_ktru_count = 0
        publish_date = lot.get("publish_date", "")
        if publish_date and customer and category:
            try:
                current_date = datetime.strptime(publish_date.split()[0], "%Y-%m-%d")
                dates_history = self._customer_ktru_history.get((customer, category), [])
                for hist_record in dates_history:
                    try:
                        hist_date = datetime.strptime(hist_record["date"], "%Y-%m-%d")
                        # Count lots within 30 days BEFORE current lot (exclude current lot itself)
                        diff = (current_date - hist_date).days
                        if 0 <= diff <= 30:
                            # Don't count the same lot twice
                            if hist_record["lot_id"] != lot.get("lot_id", ""):
                                same_ktru_count += 1
                    except (ValueError, KeyError):
                        continue
            except (ValueError, IndexError):
                # Fallback to simple count if date parsing fails
                same_ktru_count = len(self._customer_ktru_history.get((customer, category), []))
        
        # Calculate 30-day window for winner repeats (CRITICAL FIX!)
        # This affects R10 rule (systematic preference detection)
        winner_repeat_30d = 0
        if publish_date and customer and winner:
            try:
                current_date = datetime.strptime(publish_date.split()[0], "%Y-%m-%d")
                winner_history = self._customer_winner_history.get((customer, winner), [])
                for hist_record in winner_history:
                    try:
                        hist_date = datetime.strptime(hist_record["date"], "%Y-%m-%d")
                        # Count lots within 30 days BEFORE current lot (exclude current lot itself)
                        diff = (current_date - hist_date).days
                        if 0 <= diff <= 30:
                            # Don't count the same lot twice
                            if hist_record["lot_id"] != lot.get("lot_id", ""):
                                winner_repeat_30d += 1
                    except (ValueError, KeyError):
                        continue
            except (ValueError, IndexError):
                # Fallback to total count if date parsing fails (preserves historical behavior)
                winner_repeat_30d = self._customer_winner_counts.get((customer, winner), 0)
        
        return {
            # Use 30-day windowed count for winner wins (fixes noisy R10 rule)
            "winner_wins_count": winner_repeat_30d,
            # Keep total count for reference if needed
            "winner_wins_count_total": self._customer_winner_counts.get((customer, winner), 0),
            "category_median_budget": self._get_median_budget(category),
            "category_avg_text_length": text_stats.get("avg", 0),
            "category_std_text_length": text_stats.get("std", 0),
            "same_customer_ktru_lots_30d": same_ktru_count,
        }

    def _get_median_budget(self, category_code: str) -> float:
        """Медианная цена за единицу по категории (или budget если unit_price недоступна)."""
        budgets = self._category_budgets.get(category_code, [])
        if not budgets:
            return 0.0
        sorted_b = sorted(budgets)
        n = len(sorted_b)
        if n % 2 == 0:
            return (sorted_b[n // 2 - 1] + sorted_b[n // 2]) / 2
        return sorted_b[n // 2]

    def get_category_price_stats(self, category_code: str) -> dict | None:
        """Полная статистика цен за единицу по категории."""
        budgets = self._category_budgets.get(category_code, [])
        if not budgets:
            return None
        
        sorted_b = sorted(budgets)
        n = len(sorted_b)
        
        # Median
        if n % 2 == 0:
            median = (sorted_b[n // 2 - 1] + sorted_b[n // 2]) / 2
        else:
            median = sorted_b[n // 2]
        
        # Mean and std dev
        mean = sum(sorted_b) / n
        variance = sum((x - mean) ** 2 for x in sorted_b) / n
        std_dev = variance ** 0.5
        
        # Percentiles
        p25_idx = max(0, int(n * 0.25) - 1)
        p75_idx = min(n - 1, int(n * 0.75))
        
        return {
            "count": n,
            "median": median,
            "min": sorted_b[0],
            "max": sorted_b[-1],
            "mean": mean,
            "std_dev": std_dev,
            "percentile_25": sorted_b[p25_idx],
            "percentile_75": sorted_b[p75_idx],
        }

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
        
        # Use 30-day windowed counts instead of total counts (THIS IS THE FIX!)
        publish_date = lot.get("publish_date", "")
        lot_id = lot.get("lot_id", "")
        
        # Calculate winner_repeat_count as 30-day window
        features.winner_repeat_count = self._calculate_winner_repeat_30d(
            customer, winner, publish_date, lot_id
        )
        
        # Calculate same_customer_ktru_lots_30d
        features.customer_winner_pair_count = self._calculate_same_customer_ktru_30d(
            customer, features.category_code, publish_date, lot_id
        )

        return features
    
    def _calculate_winner_repeat_30d(self, customer: str, winner: str, publish_date: str, lot_id: str) -> int:
        """Рассчитывает количество побед того же поставщика у заказчика в течение 30 дней."""
        if not publish_date or not customer or not winner:
            return 0
        
        try:
            current_date = datetime.strptime(publish_date.split()[0], "%Y-%m-%d")
            winner_history = self._customer_winner_history.get((customer, winner), [])
            count = 0
            for hist_record in winner_history:
                try:
                    hist_date = datetime.strptime(hist_record["date"], "%Y-%m-%d")
                    diff = (current_date - hist_date).days
                    if 0 <= diff <= 30:
                        # Don't count the same lot twice
                        if hist_record["lot_id"] != lot_id:
                            count += 1
                except (ValueError, KeyError):
                    continue
            return count
        except (ValueError, IndexError):
            # Fallback to total count if date parsing fails
            return self._customer_winner_counts.get((customer, winner), 0)
    
    def _calculate_same_customer_ktru_30d(self, customer: str, category: str, publish_date: str, lot_id: str) -> int:
        """Рассчитывает количество лотов у заказчика в одной категории в течение 30 дней."""
        if not publish_date or not customer or not category:
            return 0
        
        try:
            current_date = datetime.strptime(publish_date.split()[0], "%Y-%m-%d")
            ktru_history = self._customer_ktru_history.get((customer, category), [])
            count = 0
            for hist_record in ktru_history:
                try:
                    hist_date = datetime.strptime(hist_record["date"], "%Y-%m-%d")
                    diff = (current_date - hist_date).days
                    if 0 <= diff <= 30:
                        # Don't count the same lot twice
                        if hist_record["lot_id"] != lot_id:
                            count += 1
                except (ValueError, KeyError):
                    continue
            return count
        except (ValueError, IndexError):
            # Fallback to simple count if date parsing fails
            return len(self._customer_ktru_history.get((customer, category), []))

    def extract_batch(self, lots: list[dict]) -> list[LotFeatures]:
        """Извлекает признаки для набора лотов."""
        return [self.extract_features(lot) for lot in lots]