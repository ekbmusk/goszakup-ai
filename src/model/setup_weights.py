"""Разовая подготовка весов моделей для data/models/."""
import os
import pickle
import numpy as np
from sklearn.ensemble import IsolationForest

MODELS_DIR = "data/models"
os.makedirs(MODELS_DIR, exist_ok=True)


def setup():
    print("⚙️  Training Isolation Forest stub...")
    iso_path = os.path.join(MODELS_DIR, "isolation_forest.pkl")
    iso_forest = IsolationForest(n_estimators=100, contamination=0.15, random_state=42)
    iso_forest.fit(np.random.rand(50, 21))
    with open(iso_path, "wb") as f:
        pickle.dump(iso_forest, f)
    print(f"✅ Isolation Forest saved → {iso_path}")

    try:
        from catboost import CatBoostClassifier
        print("⚙️  Training CatBoost stub...")
        cb_path = os.path.join(MODELS_DIR, "risk_scorer.cbm")
        X = np.random.rand(20, 21)
        y = [0] * 10 + [1] * 10
        cb_model = CatBoostClassifier(iterations=10, depth=3, learning_rate=0.1, verbose=False)
        cb_model.fit(X, y, silent=True)
        cb_model.save_model(cb_path)
        print(f"✅ CatBoost saved → {cb_path}")
    except ImportError:
        print("⚠️  catboost not installed — skipping. Install with: pip install catboost")

    try:
        from sentence_transformers import SentenceTransformer
        print("📥 Downloading LaBSE weights (~500 MB)...")
        model_path = os.path.join(MODELS_DIR, "labse")
        nlp_model = SentenceTransformer("sentence-transformers/LaBSE")
        nlp_model.save(model_path)
        print(f"✅ LaBSE saved → {model_path}")
    except ImportError:
        print("⚠️  sentence-transformers not installed — skipping LaBSE download")

    print("\n✅ Setup complete.")


if __name__ == "__main__":
    setup()