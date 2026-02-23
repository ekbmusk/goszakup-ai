"""Семантический векторизатор для поиска похожих ТЗ."""
import logging
import numpy as np
from dataclasses import dataclass
from typing import Optional

from src.utils.config import (
    EMBEDDING_MODEL,
    SIMILARITY_COPYPASTE_THRESHOLD,
    SIMILARITY_UNIQUE_THRESHOLD,
)
from src.preprocessing.text_cleaner import clean_text

logger = logging.getLogger(__name__)


@dataclass
class SimilarLot:
    """Похожий лот, найденный семантическим поиском."""
    lot_id: str
    similarity: float
    name_ru: str = ""
    category_code: str = ""


@dataclass
class VectorizerResult:
    """Результат семантического поиска для лота."""
    lot_id: str
    max_similarity: float = 0.0
    is_copypaste: bool = False
    is_unique: bool = False
    similar_lots: list = None

    def __post_init__(self):
        if self.similar_lots is None:
            self.similar_lots = []


class Vectorizer:
    """Семантический поиск и детект copy-paste/уникальных ТЗ."""

    def __init__(self, use_transformers: bool = True):
        self._model = None
        self._use_transformers = use_transformers
        self._index: list[dict] = []
        self._embeddings: Optional[np.ndarray] = None

        if use_transformers:
            try:
                from sentence_transformers import SentenceTransformer
                logger.info(f"[Vectorizer] Loading {EMBEDDING_MODEL}...")
                self._model = SentenceTransformer(EMBEDDING_MODEL)
                logger.info("[Vectorizer] LaBSE model loaded successfully")
            except ImportError:
                logger.warning(
                    "[Vectorizer] sentence-transformers not installed. "
                    "Falling back to TF-IDF. Install: pip install sentence-transformers"
                )
                self._use_transformers = False
            except Exception as e:
                logger.warning(f"[Vectorizer] Failed to load model: {e}. Using TF-IDF.")
                self._use_transformers = False

        if not self._use_transformers:
            self._init_tfidf()

    def _init_tfidf(self):
        """Инициализация TF-IDF как запасного варианта."""
        from sklearn.feature_extraction.text import TfidfVectorizer
        self._tfidf = TfidfVectorizer(
            max_features=5000,
            ngram_range=(1, 2),
            sublinear_tf=True,
        )
        self._tfidf_fitted = False

    def _encode(self, texts: list[str]) -> np.ndarray:
        """Кодирует тексты в эмбеддинги."""
        if self._use_transformers and self._model is not None:
            return self._model.encode(texts, show_progress_bar=False, normalize_embeddings=True)
        else:
            if not self._tfidf_fitted:
                vecs = self._tfidf.fit_transform(texts)
                self._tfidf_fitted = True
                return vecs.toarray()
            else:
                return self._tfidf.transform(texts).toarray()

    def build_index(self, lots: list[dict]):
        """Строит индекс поиска по лотам."""
        texts = []
        self._index = []

        for lot in lots:
            text = clean_text(lot.get("desc_ru", "") + " " + lot.get("extra_desc_ru", ""))
            if len(text) < 10:
                continue
            texts.append(text)
            self._index.append({
                "lot_id": lot.get("lot_id", ""),
                "name_ru": lot.get("name_ru", ""),
                "category_code": lot.get("category_code", ""),
                "text": text,
            })

        if not texts:
            logger.warning("[Vectorizer] No texts to index")
            return

        if not self._use_transformers:
            self._tfidf_fitted = False

        self._embeddings = self._encode(texts)
        logger.info(f"[Vectorizer] Indexed {len(texts)} lots, embedding shape: {self._embeddings.shape}")

    def _cosine_similarity(self, vec_a: np.ndarray, vec_b: np.ndarray) -> float:
        """Косинусная близость между векторами."""
        vec_a = vec_a.flatten()
        vec_b = vec_b.flatten()

        norm_a = np.linalg.norm(vec_a)
        norm_b = np.linalg.norm(vec_b)

        if norm_a == 0 or norm_b == 0:
            return 0.0

        return float(np.dot(vec_a, vec_b) / (norm_a * norm_b))

    def find_similar(self, lot: dict, top_k: int = 5) -> VectorizerResult:
        """Ищет похожие лоты и аномалии."""
        lot_id = lot.get("lot_id", "")
        text = clean_text(lot.get("desc_ru", "") + " " + lot.get("extra_desc_ru", ""))

        result = VectorizerResult(lot_id=lot_id)

        if self._embeddings is None or len(self._index) == 0:
            return result

        if self._use_transformers and self._model is not None:
            query_emb = self._model.encode([text], normalize_embeddings=True)[0]
        else:
            query_emb = self._tfidf.transform([text]).toarray()[0]

        similarities = []
        for i, entry in enumerate(self._index):
            if entry["lot_id"] == lot_id:
                continue
            sim = self._cosine_similarity(query_emb, self._embeddings[i])
            similarities.append((i, sim))

        similarities.sort(key=lambda x: x[1], reverse=True)

        for i, sim in similarities[:top_k]:
            entry = self._index[i]
            result.similar_lots.append(SimilarLot(
                lot_id=entry["lot_id"],
                similarity=round(sim, 4),
                name_ru=entry["name_ru"],
                category_code=entry["category_code"],
            ))

        if similarities:
            result.max_similarity = similarities[0][1]
            result.is_copypaste = result.max_similarity >= SIMILARITY_COPYPASTE_THRESHOLD
            result.is_unique = result.max_similarity <= SIMILARITY_UNIQUE_THRESHOLD

        return result

    def find_cluster_anomalies(self, lots: list[dict]) -> dict[str, list[str]]:
        """Ищет аномально подробные ТЗ внутри категорий."""
        by_category: dict[str, list[dict]] = {}
        for lot in lots:
            cat = lot.get("category_code", "")
            if cat:
                by_category.setdefault(cat, []).append(lot)

        anomalies = {}
        for cat, cat_lots in by_category.items():
            if len(cat_lots) < 3:
                continue

            lengths = [
                len(clean_text(l.get("desc_ru", "")))
                for l in cat_lots
            ]
            mean_len = np.mean(lengths)
            std_len = np.std(lengths)

            if std_len < 10:
                continue

            anomaly_ids = []
            for lot, length in zip(cat_lots, lengths):
                if length > mean_len + 2 * std_len:
                    anomaly_ids.append(lot.get("lot_id", ""))

            if anomaly_ids:
                anomalies[cat] = anomaly_ids

        return anomalies