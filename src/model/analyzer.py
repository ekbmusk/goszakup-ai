"""Основной анализатор GoszakupAI."""
import logging
import json
import threading
import time
import json
import csv
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Optional

from src.ingestion.goszakup_client import GoszakupClient
from src.preprocessing.feature_engineer import FeatureEngineer, LotFeatures
from src.model.rules import RuleEngine, AnalysisResult, RuleMatch
from src.model.vectorizer import Vectorizer, VectorizerResult
from src.model.scorer import RiskScorer
from src.model.network import NetworkAnalyzer, NetworkAnalysisResult
from src.utils.config import (
    get_risk_level,
    FORCE_TRAIN,
    EXPORT_TRAIN_DATA,
    LABELS_CSV,
    PROCESSED_DIR,
    RAW_DIR,
)

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

    def __init__(self, use_transformers: bool = False, token: str | None = None):
        self.client = GoszakupClient(token=token)
        self.feature_engineer = FeatureEngineer()
        self.rule_engine = RuleEngine()
        self.vectorizer = Vectorizer(use_transformers=use_transformers)
        self.scorer = RiskScorer()
        self.network = NetworkAnalyzer()

        self._lots: list[dict] = []
        self._features_cache: dict[str, LotFeatures] = {}
        self._analysis_cache: list[FullAnalysis] = []
        self._analysis_progress = 0
        self._analysis_lock = threading.Lock()
        self._analysis_thread: Optional[threading.Thread] = None
        self._analysis_cache_path = PROCESSED_DIR / "analysis_cache.json"
        self._initialized = False
        self._ml_training_source: str | None = None
        self._ml_label_counts: dict[str, int] = {}

    def initialize(self, lots: Optional[list[dict]] = None):
        """Загружает данные и строит индексы."""
        self._analysis_cache = []
        self._analysis_progress = 0

        if lots is not None:
            self._lots = lots
        else:
            # Load all available lots (increase max_pages for real data)
            # With page_size=50, max_pages=210 = 10,500 lots
            self._lots = self.client.collect_all_lots(max_pages=210, page_size=50)

        logger.info(f"[Analyzer] 📊 Loaded {len(self._lots)} lots")

        self.feature_engineer.fit_history(self._lots)

        all_features = []
        for lot in self._lots:
            f = self.feature_engineer.extract_features(lot)
            self._features_cache[lot.get("lot_id", "")] = f
            all_features.append(f)

        logger.info(f"[Analyzer] 🔧 Extracted features for {len(all_features)} lots")

        self.vectorizer.build_index(self._lots)
        self.network.build_graph(self._lots)
        self._load_analysis_cache()
        has_real_data = len(self._lots) > 100
        
        should_retrain = FORCE_TRAIN or has_real_data or not self.scorer.is_fitted
        
        if not should_retrain:
            logger.info("[Analyzer] Loading saved scorer from disk")
            self.scorer.load()
        
        if should_retrain:
            logger.info(f"[Analyzer] 🤖 Training ML models... (real_data={has_real_data}, force_train={FORCE_TRAIN})")
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

            logger.info(f"[Analyzer] 📈 Fitting scorer with {len(all_features)} samples, {len(rule_scores)} scores")
            if labels:
                label_list = [labels.get(lot.get("lot_id", "")) for lot in self._lots]
                label_list = [
                    v if v in (0, 1) else (1 if score >= 50.0 else 0)
                    for v, score in zip(label_list, rule_scores)
                ]
                logger.info(f"[Analyzer] Using {len(label_list)} labeled samples")
                self.scorer.fit(all_features, labels=label_list)
            else:
                logger.info(f"[Analyzer] Using {len(rule_scores)} rule-based pseudo-labels")
                self.scorer.fit(all_features, rule_scores=rule_scores)
            logger.info("[Analyzer] 💾 Saving trained models")
            self.scorer.save()
        else:
            self._ml_training_source = "loaded"
            logger.info("[Analyzer] Scorer loaded from disk — skipping training")

        self._initialized = True
        logger.info(f"[Analyzer] ✅ Initialization complete (source: {self._ml_training_source})")

    def _analysis_result_from_cache(self, data: dict) -> AnalysisResult:
        rules = []
        for item in data.get("rules_triggered", []) or []:
            rules.append(
                RuleMatch(
                    rule_id=item.get("rule_id", ""),
                    datanomix_code=item.get("datanomix_code", ""),
                    rule_name_ru=item.get("rule_name_ru", item.get("rule_name", "")),
                    category=item.get("category", ""),
                    weight=float(item.get("weight", 0.0) or 0.0),
                    raw_score=float(item.get("raw_score", 0.0) or 0.0),
                    explanation_ru=item.get("explanation_ru", ""),
                    evidence=item.get("evidence", ""),
                    severity=item.get("severity", ""),
                    law_reference=item.get("law_reference", ""),
                )
            )

        return AnalysisResult(
            lot_id=data.get("lot_id", ""),
            risk_score=float(data.get("risk_score", 0.0) or 0.0),
            risk_level=data.get("risk_level", "LOW"),
            rules_triggered=rules,
            total_rules_checked=int(data.get("total_rules_checked", 0) or 0),
            summary_ru=data.get("summary_ru", ""),
            highlights=data.get("highlights", []) or [],
            datanomix_codes=data.get("datanomix_codes", []) or [],
        )

    def _analysis_from_cache(self, data: dict) -> FullAnalysis:
        analysis = FullAnalysis(
            lot_id=data.get("lot_id", ""),
            lot_data=data.get("lot_data", {}) or {},
            final_score=float(data.get("final_score", 0.0) or 0.0),
            final_level=data.get("final_level", "LOW"),
            explanation=data.get("explanation", []) or [],
        )

        if data.get("rule_analysis"):
            analysis.rule_analysis = self._analysis_result_from_cache(data["rule_analysis"])

        analysis.ml_prediction = data.get("ml_prediction", {}) or {}

        return analysis

    def _load_analysis_cache(self) -> None:
        cache_path = self._analysis_cache_path
        raw_path = RAW_DIR / "real_lots.json"
        if not cache_path.exists():
            return

        if raw_path.exists() and cache_path.stat().st_mtime < raw_path.stat().st_mtime:
            logger.info("[Analyzer] Cache is older than raw data — skipping")
            return

        try:
            payload = json.loads(cache_path.read_text(encoding="utf-8"))
            records = payload.get("records", []) if isinstance(payload, dict) else payload
            cached = [self._analysis_from_cache(r) for r in records]
            self._analysis_cache = cached
            self._analysis_progress = len(cached)
            logger.info(f"[Analyzer] Loaded analysis cache: {len(cached)} lots")
        except Exception as exc:
            logger.warning(f"[Analyzer] Failed to load cache: {exc}")

    def save_analysis_cache(self) -> None:
        try:
            self._analysis_cache_path.parent.mkdir(parents=True, exist_ok=True)
            payload = {
                "total": len(self._analysis_cache),
                "records": [r.to_dict() for r in self._analysis_cache],
            }
            self._analysis_cache_path.write_text(
                json.dumps(payload, ensure_ascii=True),
                encoding="utf-8",
            )
            logger.info(f"[Analyzer] Saved analysis cache to {self._analysis_cache_path}")
        except Exception as exc:
            logger.warning(f"[Analyzer] Failed to save cache: {exc}")

    def start_background_analysis(self, batch_size: int = 50, sleep_seconds: float = 0.1) -> None:
        if self._analysis_thread and self._analysis_thread.is_alive():
            return

        def _worker():
            while True:
                with self._analysis_lock:
                    done = self._analysis_progress >= len(self._lots)
                if done:
                    break
                self.analyze_incremental(max_new=batch_size)
                time.sleep(sleep_seconds)

        self._analysis_thread = threading.Thread(target=_worker, daemon=True)
        self._analysis_thread.start()

    def analyze_incremental(self, max_new: int = 50) -> list[FullAnalysis]:
        if not self._lots:
            return self._analysis_cache

        with self._analysis_lock:
            start = self._analysis_progress
            end = min(self._analysis_progress + max_new, len(self._lots))
            if start >= end:
                return self._analysis_cache

        new_results = []
        for lot in self._lots[start:end]:
            new_results.append(self._analyze(lot))

        with self._analysis_lock:
            self._analysis_cache.extend(new_results)
            self._analysis_progress = end
            cache_snapshot = list(self._analysis_cache)

        if self._analysis_progress >= len(self._lots):
            self.save_analysis_cache()

        logger.info(f"[Analyzer] Incremental analyzed {end}/{len(self._lots)} lots")
        return cache_snapshot

    def get_cached_results(self) -> list[FullAnalysis]:
        with self._analysis_lock:
            return list(self._analysis_cache)

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

        # TODO: Restore ml_score * 0.50 after training on real labels.csv
        # Currently rule-based engine is the only reliable signal
        final = (
            rule_score * 0.70 +      # Increased from 0.30: rule engine is primary working component
            ml_score * 0.20 +        # Decreased from 0.50: trained on pseudo-labels, predictions are noisy
            semantic_score * 0.05 +  # Decreased from 0.10: reallocated to rules
            network_score * 0.05     # Decreased from 0.10: reallocated to rules
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
        if not self._lots:
            return []

        while self._analysis_progress < len(self._lots):
            self.analyze_incremental(max_new=200)

        logger.info(f"[Analyzer] Analyzed {len(self._analysis_cache)} lots")
        return self.get_cached_results()

    def get_dashboard_stats(self) -> dict:
        """Возвращает агрегированные метрики для дашборда."""
        results = self.get_cached_results()
        if not results and self._lots:
            results = self.analyze_incremental(max_new=50)

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
            "processed_lots": self._analysis_progress,
            "all_lots": len(self._lots),
            "by_level": by_level,
            "avg_score": round(sum(scores) / len(scores), 1) if scores else 0,
            "total_budget": total_budget,
            "by_category": by_category,
            "top_risks": [
                r.to_dict() for r in sorted(results, key=lambda x: x.final_score, reverse=True)[:10]
            ],
        }