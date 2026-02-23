"""Основной анализатор GoszakupAI."""
import logging
import json
import csv
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Optional

from src.ingestion.goszakup_client import GoszakupClient
from src.preprocessing.feature_engineer import FeatureEngineer, LotFeatures
from src.model.rules import RuleEngine, AnalysisResult
from src.model.vectorizer import Vectorizer, VectorizerResult
from src.model.scorer import RiskScorer
from src.model.network import NetworkAnalyzer, NetworkAnalysisResult
from src.utils.config import get_risk_level, FORCE_TRAIN, EXPORT_TRAIN_DATA, LABELS_CSV, PROCESSED_DIR

logger = logging.getLogger(__name__)


@dataclass
class FullAnalysis:
    """Итог анализа, объединяющий все модули."""
    lot_id: str
    lot_data: dict = field(default_factory=dict)

    rule_analysis: Optional[AnalysisResult] = None

    features: Optional[LotFeatures] = None

    vectorizer_result: Optional[VectorizerResult] = None

    ml_prediction: dict = field(default_factory=dict)

    network_result: Optional[NetworkAnalysisResult] = None

    final_score: float = 0.0
    final_level: str = "LOW"
    explanation: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        """Преобразует результат анализа в словарь."""
        ml_pred = {}
        if self.ml_prediction:
            ml_pred = self.ml_prediction.copy()
            if "isolation_anomaly" in ml_pred:
                ml_pred["isolation_anomaly"] = bool(ml_pred["isolation_anomaly"])
            if "isolation_score" in ml_pred:
                ml_pred["isolation_score"] = float(ml_pred["isolation_score"])
            if "catboost_proba" in ml_pred:
                ml_pred["catboost_proba"] = float(ml_pred["catboost_proba"])
        
        return {
            "lot_id": self.lot_id,
            "lot_data": {
                "name_ru": self.lot_data.get("name_ru", ""),
                "category_code": self.lot_data.get("category_code", ""),
                "category_name": self.lot_data.get("category_name", ""),
                "budget": self.lot_data.get("budget", 0),
                "participants_count": self.lot_data.get("participants_count", 0),
                "deadline_days": self.lot_data.get("deadline_days", 0),
                "city": self.lot_data.get("city", ""),
            },
            "final_score": round(self.final_score, 1),
            "final_level": self.final_level,
            "rule_analysis": self.rule_analysis.to_dict() if self.rule_analysis else None,
            "features": self.features.to_dict() if self.features else None,
            "similar_lots": [
                {"lot_id": s.lot_id, "similarity": s.similarity, "name_ru": s.name_ru}
                for s in (self.vectorizer_result.similar_lots if self.vectorizer_result else [])
            ],
            "ml_prediction": ml_pred,
            "network_flags": (
                self.network_result.flags if self.network_result else []
            ),
            "explanation": self.explanation,
        }


class GoszakupAnalyzer:
    """Основной конвейер анализа."""

    def __init__(self, use_transformers: bool = False):
        self.client = GoszakupClient()
        self.feature_engineer = FeatureEngineer()
        self.rule_engine = RuleEngine()
        self.vectorizer = Vectorizer(use_transformers=use_transformers)
        self.scorer = RiskScorer()
        self.network = NetworkAnalyzer()

        self._lots: list[dict] = []
        self._features_cache: dict[str, LotFeatures] = {}
        self._analysis_cache: Optional[list] = None
        self._initialized = False
        self._ml_training_source: str | None = None
        self._ml_label_counts: dict[str, int] = {}

    def initialize(self, lots: Optional[list[dict]] = None):
        """Загружает данные и строит индексы."""
        self._analysis_cache = None

        if lots is not None:
            self._lots = lots
        else:
            self._lots = self.client.collect_all_lots()

        logger.info(f"[Analyzer] Loaded {len(self._lots)} lots")

        self.feature_engineer.fit_history(self._lots)

        all_features = []
        for lot in self._lots:
            f = self.feature_engineer.extract_features(lot)
            self._features_cache[lot.get("lot_id", "")] = f
            all_features.append(f)

        logger.info(f"[Analyzer] Extracted features for {len(all_features)} lots")

        self.vectorizer.build_index(self._lots)

        self.network.build_graph(self._lots)

        if FORCE_TRAIN:
            logger.info("[Analyzer] FORCE_TRAIN enabled — retraining scorer")
        else:
            self.scorer.load()

        if FORCE_TRAIN or not self.scorer.is_fitted:
            rule_scores = []
            for lot in self._lots:
                features = self._features_cache.get(lot.get("lot_id", ""))
                if features:
                    history = self.feature_engineer.get_history_for_lot(lot)
                    result = self.rule_engine.analyze(lot, features, history=history)
                    rule_scores.append(result.risk_score)
                else:
                    rule_scores.append(0.0)

            labels = self._load_labels_csv()
            if labels:
                label_values = list(labels.values())
                positives = sum(1 for v in label_values if v == 1)
                self._ml_label_counts = {
                    "positive": positives,
                    "negative": len(label_values) - positives,
                    "total": len(label_values),
                }
                self._ml_training_source = "labels_csv"
                logger.info(
                    "[Analyzer] Training with CSV labels: "
                    f"{self._ml_label_counts['positive']} positive, "
                    f"{self._ml_label_counts['negative']} negative"
                )
            else:
                self._ml_training_source = "rule_pseudo"

            if EXPORT_TRAIN_DATA:
                try:
                    train_records = []
                    for lot, features, score in zip(self._lots, all_features, rule_scores):
                        label = 1 if score >= 50.0 else 0
                        train_records.append({
                            "lot_id": lot.get("lot_id", ""),
                            "rule_score": score,
                            "label": label,
                            "features": features.to_dict(),
                            "feature_vector": features.to_feature_vector(),
                        })

                    export_path = PROCESSED_DIR / "catboost_train.json"
                    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
                    with open(export_path, "w", encoding="utf-8") as f:
                        json.dump(
                            {
                                "feature_names": all_features[0].feature_names() if all_features else [],
                                "records": train_records,
                            },
                            f,
                            ensure_ascii=True,
                        )
                    logger.info(f"[Analyzer] Exported CatBoost training data to {export_path}")

                    compact_path = PROCESSED_DIR / "catboost_train_vectors.json"
                    with open(compact_path, "w", encoding="utf-8") as f:
                        json.dump(
                            {
                                "feature_names": all_features[0].feature_names() if all_features else [],
                                "records": [
                                    {
                                        "lot_id": r["lot_id"],
                                        "label": r["label"],
                                        "rule_score": r["rule_score"],
                                        "feature_vector": r["feature_vector"],
                                    }
                                    for r in train_records
                                ],
                            },
                            f,
                            ensure_ascii=True,
                        )
                    logger.info(f"[Analyzer] Exported CatBoost vectors to {compact_path}")

                    csv_path = PROCESSED_DIR / "catboost_train.csv"
                    feature_names = all_features[0].feature_names() if all_features else []
                    with open(csv_path, "w", encoding="utf-8", newline="") as f:
                        writer = csv.writer(f)
                        writer.writerow(["lot_id", "label", "rule_score", *feature_names])
                        for r in train_records:
                            writer.writerow([
                                r["lot_id"],
                                r["label"],
                                r["rule_score"],
                                *r["feature_vector"],
                            ])
                    logger.info(f"[Analyzer] Exported CatBoost CSV to {csv_path}")
                except Exception as e:
                    logger.warning(f"[Analyzer] Failed to export training data: {e}")

            if labels:
                label_list = [labels.get(lot.get("lot_id", "")) for lot in self._lots]
                label_list = [
                    v if v in (0, 1) else (1 if score >= 50.0 else 0)
                    for v, score in zip(label_list, rule_scores)
                ]
                self.scorer.fit(all_features, labels=label_list)
            else:
                self.scorer.fit(all_features, rule_scores=rule_scores)
            self.scorer.save()
        else:
            self._ml_training_source = "loaded"
            logger.info("[Analyzer] Scorer loaded from disk — skipping training")

        self._initialized = True
        logger.info("[Analyzer] Initialization complete")

    def analyze_lot(self, lot_id: str) -> FullAnalysis:
        """Полный анализ выбранного лота."""
        lot = self.client.get_lot_by_id(lot_id)
        if not lot:
            return FullAnalysis(lot_id=lot_id)

        return self._analyze(lot)

    def analyze_text(self, text: str, metadata: Optional[dict] = None) -> FullAnalysis:
        """Анализ произвольного текста ТЗ."""
        lot = {
            "lot_id": "MANUAL",
            "desc_ru": text,
            "extra_desc_ru": "",
            "name_ru": "Ручной анализ",
            "budget": (metadata or {}).get("budget", 0),
            "participants_count": (metadata or {}).get("participants_count", 0),
            "deadline_days": (metadata or {}).get("deadline_days", 0),
            "category_code": (metadata or {}).get("category_code", ""),
            "winner_bin": "",
            "customer_bin": "",
        }
        return self._analyze(lot)

    def _analyze(self, lot: dict) -> FullAnalysis:
        """Внутренний запуск всех стадий анализа."""
        lot_id = lot.get("lot_id", "")
        analysis = FullAnalysis(lot_id=lot_id, lot_data=lot)

        if lot_id in self._features_cache:
            features = self._features_cache[lot_id]
        else:
            features = self.feature_engineer.extract_features(lot)
        analysis.features = features

        history = self.feature_engineer.get_history_for_lot(lot)
        rule_result = self.rule_engine.analyze(lot, features, history=history)
        analysis.rule_analysis = rule_result

        vec_result = self.vectorizer.find_similar(lot)
        analysis.vectorizer_result = vec_result

        features.max_similarity = vec_result.max_similarity
        features.is_copypaste = vec_result.is_copypaste
        features.is_unique = vec_result.is_unique

        if self.scorer.is_fitted:
            analysis.ml_prediction = self.scorer.predict(features)

        customer_bin = lot.get("customer_bin", "")
        winner_bin = lot.get("winner_bin", "")
        if customer_bin:
            analysis.network_result = self.network.analyze_bin(customer_bin)

        analysis.final_score, analysis.final_level, analysis.explanation = (
            self._compute_final_score(analysis)
        )

        return analysis

    def _compute_final_score(self, analysis: FullAnalysis) -> tuple[float, str, list[str]]:
        """Комбинирует правила, ML, семантику и сеть в итоговый балл."""
        explanation = []

        rule_score = analysis.rule_analysis.risk_score if analysis.rule_analysis else 0.0
        explanation.append(f"Правила: {rule_score:.0f}/100")

        ml_proba = analysis.ml_prediction.get("catboost_proba", 0.0)
        iso_anomaly = bool(analysis.ml_prediction.get("isolation_anomaly", False))
        iso_component = 100.0 if iso_anomaly else 0.0
        ml_score = (ml_proba * 100.0) * 0.8 + iso_component * 0.2
        analysis.ml_prediction["ml_score"] = float(ml_score)
        if ml_score > 10:
            explanation.append(
                f"ML модель: {ml_score:.0f}/100 (CatBoost {ml_proba:.1%}, "
                f"Anomaly {'да' if iso_anomaly else 'нет'})"
            )

        semantic_score = 0.0
        if analysis.vectorizer_result:
            if analysis.vectorizer_result.is_copypaste:
                semantic_score = 80.0
                explanation.append(
                    f"Copy-Paste: обнаружено совпадение ТЗ на {analysis.vectorizer_result.max_similarity:.0%}"
                )
            elif analysis.vectorizer_result.is_unique:
                semantic_score = 40.0
                explanation.append("Уникальное ТЗ: нет аналогов в базе")

        network_score = 0.0
        if analysis.network_result and analysis.network_result.flags:
            network_score = min(100.0, len(analysis.network_result.flags) * 25.0)
            for flag in analysis.network_result.flags[:3]:
                explanation.append(f"Сеть: {flag}")

        final = (
            rule_score * 0.30 +
            ml_score * 0.50 +
            semantic_score * 0.10 +
            network_score * 0.10
        )
        final = min(100.0, max(0.0, final))
        level = get_risk_level(final)

        return final, level, explanation

    def _load_labels_csv(self) -> dict[str, int]:
        """Загружает метки из CSV (столбцы: lot_id,label)."""
        if not LABELS_CSV:
            return {}
        try:
            path = Path(LABELS_CSV)
            if not path.exists():
                logger.warning(f"[Analyzer] LABELS_CSV not found: {path}")
                return {}
            with open(path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                labels = {}
                for row in reader:
                    lot_id = str(row.get("lot_id", "")).strip()
                    label_raw = str(row.get("label", "")).strip()
                    if not lot_id:
                        continue
                    if label_raw not in {"0", "1"}:
                        continue
                    labels[lot_id] = int(label_raw)
                return labels
        except Exception as exc:
            logger.warning(f"[Analyzer] Failed to read LABELS_CSV: {exc}")
            return {}

    def analyze_all(self) -> list[FullAnalysis]:
        """Анализирует все лоты и кэширует результат."""
        if self._analysis_cache is not None:
            return self._analysis_cache
        results = []
        for lot in self._lots:
            result = self._analyze(lot)
            results.append(result)
        logger.info(f"[Analyzer] Analyzed {len(results)} lots")
        self._analysis_cache = results
        return results

    def get_dashboard_stats(self) -> dict:
        """Возвращает агрегированные метрики для дашборда."""
        results = self.analyze_all()

        by_level = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
        by_category = {}
        total_budget = 0
        scores = []

        for r in results:
            by_level[r.final_level] = by_level.get(r.final_level, 0) + 1
            scores.append(r.final_score)
            total_budget += r.lot_data.get("budget", 0)

            cat = r.lot_data.get("category_name", "Другое")
            if cat not in by_category:
                by_category[cat] = {"count": 0, "high_risk": 0, "avg_score": 0, "scores": []}
            by_category[cat]["count"] += 1
            by_category[cat]["scores"].append(r.final_score)
            if r.final_level in ("HIGH", "CRITICAL"):
                by_category[cat]["high_risk"] += 1

        for cat in by_category:
            s = by_category[cat]["scores"]
            by_category[cat]["avg_score"] = round(sum(s) / len(s), 1) if s else 0
            del by_category[cat]["scores"]

        return {
            "total_lots": len(results),
            "by_level": by_level,
            "avg_score": round(sum(scores) / len(scores), 1) if scores else 0,
            "total_budget": total_budget,
            "by_category": by_category,
            "top_risks": [
                r.to_dict() for r in sorted(results, key=lambda x: x.final_score, reverse=True)[:10]
            ],
        }