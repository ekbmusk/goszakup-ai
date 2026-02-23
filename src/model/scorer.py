"""ML-скоринг риска: CatBoost + IsolationForest."""
import logging
import pickle
from pathlib import Path
from typing import Optional

import numpy as np

from src.utils.config import MODELS_DIR, CATBOOST_ITERATIONS, CATBOOST_DEPTH, CATBOOST_LR
from src.preprocessing.feature_engineer import LotFeatures

logger = logging.getLogger(__name__)


class RiskScorer:
    """Скоринг риска на базе ML моделей."""

    def __init__(self):
        self._catboost_model = None
        self._isolation_forest = None
        self._is_fitted = False
        self._feature_names = LotFeatures.feature_names()

    def fit(
        self,
        features_list: list[LotFeatures],
        labels: Optional[list[int]] = None,
        rule_scores: Optional[list[float]] = None,
    ):
        """Обучает модели скоринга."""
        if len(features_list) < 10:
            logger.warning("[Scorer] Too few samples to train. Need at least 10.")
            return

        logger.info(f"[Scorer] Starting training with {len(features_list)} samples")
        
        X = np.array([f.to_feature_vector() for f in features_list])

        if labels is None and rule_scores is not None:
            threshold = 50.0
            labels = [1 if s >= threshold else 0 for s in rule_scores]
            positive_count = sum(labels)
            
            # If we have only one class, adjust threshold to create balance
            if len(set(labels)) < 2:
                logger.warning(f"[Scorer] Generated labels have only one class. Adjusting threshold...")
                # Try different thresholds to find one that splits the data
                for thresh in [np.median(rule_scores), np.percentile(rule_scores, 75), np.percentile(rule_scores, 25)]:
                    labels = [1 if s >= thresh else 0 for s in rule_scores]
                    if len(set(labels)) >= 2:
                        logger.info(f"[Scorer] Using threshold {thresh:.1f}, got {sum(labels)} positive samples")
                        break
            
            logger.info(
                f"[Scorer] Using pseudo-labels from rules. "
                f"Positive: {sum(labels)}, Negative: {len(labels) - sum(labels)}"
            )
        elif labels is None:
            logger.warning("[Scorer] No labels provided. Cannot train CatBoost.")
            labels = [0] * len(features_list)

        y = np.array(labels)

        try:
            from catboost import CatBoostClassifier

            if len(set(y)) < 2:
                logger.warning("[Scorer] Only one class in labels. Adding synthetic minority samples.")
                if 1 not in y:
                    y[-max(1, len(y) // 20):] = 1
                elif 0 not in y:
                    y[-max(1, len(y) // 20):] = 0
                logger.info(f"[Scorer] After synthetic balancing: {sum(y)} positive, {len(y) - sum(y)} negative")

            if len(set(y)) < 2:
                logger.warning("[Scorer] Still one class after balancing. Skipping CatBoost training.")
                self._catboost_model = None
            else:
                logger.info(
                    f"[Scorer] CatBoost config: iterations={min(CATBOOST_ITERATIONS, max(50, len(X) * 2))}, "
                    f"depth={CATBOOST_DEPTH}, lr={CATBOOST_LR}"
                )

                self._catboost_model = CatBoostClassifier(
                    iterations=min(CATBOOST_ITERATIONS, max(50, len(X) * 2)),
                    depth=CATBOOST_DEPTH,
                    learning_rate=CATBOOST_LR,
                    loss_function="Logloss",
                    eval_metric="AUC",
                    verbose=False,
                    random_seed=42,
                )

                rng = np.random.default_rng(42)
                indices = rng.permutation(len(X))
                X_shuffled = X[indices]
                y_shuffled = y[indices]

                split = int(len(X_shuffled) * 0.8)
                if split < 5:
                    logger.info("[Scorer] Training CatBoost without validation split")
                    self._catboost_model.fit(X_shuffled, y_shuffled)
                else:
                    logger.info(
                        f"[Scorer] Training CatBoost with validation split: {split} train, {len(X)-split} eval"
                    )
                    y_train = y_shuffled[:split]
                    y_eval = y_shuffled[split:]
                    if len(set(y_train)) < 2 or len(set(y_eval)) < 2:
                        logger.warning("[Scorer] Validation split has one class. Training without eval set.")
                        self._catboost_model.fit(X_shuffled, y_shuffled)
                    else:
                        self._catboost_model.fit(
                            X_shuffled[:split], y_train,
                            eval_set=(X_shuffled[split:], y_eval),
                            early_stopping_rounds=20,
                        )
                logger.info(f"[Scorer] ✅ CatBoost trained successfully on {len(X)} samples")

        except ImportError as e:
            logger.error(f"[Scorer] ❌ CatBoost import error: {e}")
            self._catboost_model = None
        except Exception as e:
            logger.error(f"[Scorer] ❌ CatBoost training failed: {e}", exc_info=True)
            self._catboost_model = None

        try:
            from sklearn.ensemble import IsolationForest

            logger.info("[Scorer] Training Isolation Forest...")
            self._isolation_forest = IsolationForest(
                n_estimators=100,
                contamination=0.15,
                random_state=42,
            )
            self._isolation_forest.fit(X)
            logger.info(f"[Scorer] ✅ Isolation Forest trained successfully on {len(X)} samples")

        except ImportError as e:
            logger.error(f"[Scorer] ❌ scikit-learn import error: {e}")
        except Exception as e:
            logger.error(f"[Scorer] ❌ Isolation Forest training failed: {e}", exc_info=True)

        self._is_fitted = True

    def predict(self, features: LotFeatures) -> dict:
        """Возвращает ML-оценку риска для одного лота."""
        result = {
            "catboost_proba": 0.0,
            "isolation_anomaly": False,
            "isolation_score": 0.0,
            "feature_importance": {},
        }

        X = np.array([features.to_feature_vector()])

        if self._catboost_model is not None:
            try:
                proba = self._catboost_model.predict_proba(X)[0]
                result["catboost_proba"] = float(proba[1]) if len(proba) > 1 else float(proba[0])

                importances = self._catboost_model.get_feature_importance()
                top_features = sorted(
                    zip(self._feature_names, importances),
                    key=lambda x: x[1], reverse=True
                )[:5]
                result["feature_importance"] = {
                    name: round(imp, 2) for name, imp in top_features
                }
            except Exception as e:
                logger.error(f"[Scorer] CatBoost predict failed: {e}")

        if self._isolation_forest is not None:
            try:
                anomaly_pred = self._isolation_forest.predict(X)[0]
                anomaly_score = self._isolation_forest.score_samples(X)[0]
                result["isolation_anomaly"] = bool(anomaly_pred == -1)
                result["isolation_score"] = float(anomaly_score)
            except Exception as e:
                logger.error(f"[Scorer] Isolation Forest predict failed: {e}")

        return result

    def predict_batch(self, features_list: list[LotFeatures]) -> list[dict]:
        """ML-оценка риска для набора лотов."""
        return [self.predict(f) for f in features_list]

    def save(self, path: Optional[Path] = None):
        """Сохраняет модели на диск."""
        path = path or MODELS_DIR
        Path(path).mkdir(parents=True, exist_ok=True)

        if self._catboost_model is not None:
            try:
                self._catboost_model.save_model(str(Path(path) / "risk_scorer.cbm"))
                logger.info(f"[Scorer] CatBoost saved to {path}/risk_scorer.cbm")
            except Exception as e:
                logger.warning(f"[Scorer] CatBoost not saved: {e}")

        if self._isolation_forest is not None:
            with open(Path(path) / "isolation_forest.pkl", "wb") as f:
                pickle.dump(self._isolation_forest, f)
            logger.info(f"[Scorer] Isolation Forest saved to {path}/isolation_forest.pkl")

    def load(self, path: Optional[Path] = None):
        """Загружает модели с диска."""
        path = path or MODELS_DIR

        catboost_path = Path(path) / "risk_scorer.cbm"
        if catboost_path.exists():
            try:
                from catboost import CatBoostClassifier
                self._catboost_model = CatBoostClassifier()
                self._catboost_model.load_model(str(catboost_path))
                logger.info("[Scorer] CatBoost loaded")
            except Exception as e:
                logger.error(f"[Scorer] Failed to load CatBoost: {e}")

        iso_path = Path(path) / "isolation_forest.pkl"
        if iso_path.exists():
            try:
                with open(iso_path, "rb") as f:
                    self._isolation_forest = pickle.load(f)
                logger.info("[Scorer] Isolation Forest loaded")
            except Exception as e:
                logger.error(f"[Scorer] Failed to load Isolation Forest: {e}")

        self._is_fitted = self._catboost_model is not None or self._isolation_forest is not None

    @property
    def is_fitted(self) -> bool:
        return self._is_fitted