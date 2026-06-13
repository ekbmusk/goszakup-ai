"""Клиент API goszakup.gov.kz (REST + GraphQL) с режимом мок-данных."""
import json
import time
import logging
from pathlib import Path
from typing import Any

try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False

from src.utils.config import (
    GOSZAKUP_TOKEN,
    GOSZAKUP_BASE_URL,
    GOSZAKUP_GRAPHQL_URL,
    RAW_DIR,
)

logger = logging.getLogger(__name__)


class GoszakupClient:
    """Клиент для API goszakup.gov.kz (v3)."""

    def __init__(self, token: str | None = None):
        self.token = GOSZAKUP_TOKEN if token is None else token
        self.base_url = GOSZAKUP_BASE_URL

        # Кэш лотов, собранных с живого API (lot_id -> lot dict).
        self._remote_cache: dict[str, dict] = {}

        # Если задан токен и есть httpx — тянем свежие данные с живого API v3.
        # Иначе работаем с готовым файлом lot_details.json / real_lots.json.
        self.use_remote_api = bool(self.token) and HAS_HTTPX
        self.use_local_data = not self.use_remote_api

        # Локальные данные всегда подгружаем (если есть) — они служат fallback'ом,
        # когда живой API недоступен.
        self._local_data = self._load_local_data(required=self.use_local_data)

        if self.use_remote_api:
            self._client = httpx.Client(
                base_url=self.base_url,
                headers={
                    "Authorization": f"Bearer {self.token}",
                    "Content-Type": "application/json",
                },
                timeout=30.0,
            )
            logger.info("[GoszakupClient] 🌐 Remote API mode enabled (token provided)")
        else:
            if self.token and not HAS_HTTPX:
                logger.warning("[GoszakupClient] httpx not installed; using local lot_details.json")
            if not self.token:
                logger.info("[GoszakupClient] Using local lot_details.json as data source (no token provided)")

    def _load_local_data(self, required: bool = True) -> list[dict]:
        """Загружает лоты из готовых файлов lot_details.json или real_lots.json.

        В remote-режиме файлы не обязательны (required=False) — служат лишь fallback'ом.
        """
        # Предпочитаем lot_details.json (как источник пользователя)
        lot_details_path = RAW_DIR / "lot_details.json"
        real_path = RAW_DIR / "real_lots.json"  # результат конвертера из lot_details.jsonl

        for path in (lot_details_path, real_path):
            if path.exists():
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    logger.info(f"[GoszakupClient] ✅ Loaded {len(data)} lots from {path}")
                    return data
                except json.JSONDecodeError as e:
                    logger.error(f"[GoszakupClient] ❌ JSON parsing error in {path}: {e}")
                except Exception as e:
                    logger.error(f"[GoszakupClient] ❌ Failed to load data from {path}: {e}", exc_info=True)

        if required:
            # Без токена локальный файл обязателен
            raise RuntimeError(
                "No lot data found. Please provide data/raw/lot_details.json (or run convert_lot_details.py)."
            )
        logger.info("[GoszakupClient] No local data file found — remote API is the only source")
        return []

    @staticmethod
    def _map_api_lot(raw: dict) -> dict:
        """Маппинг лота из формата REST API v3 (/v3/lots) во внутренний формат.

        Учитываем, что живой API отдаёт меньше полей, чем веб-скрейп
        (нет ТРУ-кода, числа участников, победителя, срока подачи) — недостающее
        заполняем дефолтами, чтобы конвейер анализа работал по тексту ТЗ.
        """
        amount = float(raw.get("amount", 0) or 0)
        count = float(raw.get("count", 0) or 0)
        unit_price = amount / count if count > 0 else amount
        kato = raw.get("pln_point_kato_list") or []
        return {
            "lot_id": str(raw.get("lot_number", raw.get("id", ""))),
            "trd_buy_id": raw.get("trd_buy_id", ""),
            "name_ru": raw.get("name_ru", "") or "",
            "name_kz": raw.get("name_kz", "") or "",
            "desc_ru": raw.get("description_ru", "") or "",
            "extra_desc_ru": "",
            "category_code": "",        # ТРУ-код недоступен в /v3/lots
            "category_name": "",        # → группируется как «Другое»
            "budget": amount,
            "quantity": count,
            "unit_price": unit_price,
            "participants_count": 0,    # нет в /v3/lots
            "deadline_days": 0,         # нет в /v3/lots
            "city": str(kato[0]) if kato else "",
            "customer_bin": raw.get("customer_bin", "") or "",
            "customer_name": raw.get("customer_name_ru", "") or "",
            "winner_bin": "",
            "winner_name": "",
            "publish_date": raw.get("last_update_date", "") or raw.get("index_date", "") or "",
            "lot_status": raw.get("ref_lot_status_id", ""),
            "trd_buy_number_anno": raw.get("trd_buy_number_anno", ""),
            "is_synthetic": False,
            "source": "goszakup_api_v3",
        }

    def _request(self, endpoint: str) -> dict:
        """GET к живому API с повторами. endpoint может быть путём из next_page."""
        max_retries = 3
        for attempt in range(max_retries):
            try:
                resp = self._client.get(endpoint)
                resp.raise_for_status()
                return resp.json()
            except Exception as e:
                if attempt < max_retries - 1:
                    time.sleep(1)
                    continue
                logger.error(f"[GoszakupClient] Request failed: {endpoint} → {e}")
                raise
        return {}

    def _get(self, endpoint: str, params: dict | None = None) -> dict:
        """GET-запрос с повторами."""
        if self.use_local_data or not self.use_remote_api:
            raise RuntimeError("Remote API is disabled; using local lot_details.json")

        max_retries = 3
        for attempt in range(max_retries):
            try:
                resp = self._client.get(endpoint, params=params)
                resp.raise_for_status()
                return resp.json()
            except Exception as e:
                if attempt < max_retries - 1:
                    time.sleep(1)
                    continue
                raise
        return {}

    def get_lots(self, page: int = 0, size: int = 20) -> list[dict]:
        """Возвращает список лотов закупок."""
        if self.use_local_data:
            start = page * size
            return self._local_data[start:start + size]
        try:
            data = self._get("/v3/lots", {"limit": size, "offset": page * size})
            return data.get("items", data.get("data", []))
        except Exception as exc:
            logger.error(f"[GoszakupClient] get_lots failed from remote API: {exc}")
            raise

    def get_lot_by_id(self, lot_id: str) -> dict | None:
        """Возвращает лот по идентификатору."""
        if self.use_remote_api:
            # Сначала смотрим в кэше собранных лотов
            cached = self._remote_cache.get(str(lot_id))
            if cached:
                return cached
            # Иначе пробуем найти по номеру лота через поиск API
            try:
                data = self._request(f"/v3/lots?lotNumber={lot_id}&limit=1")
                items = data.get("items", [])
                if items:
                    lot = self._map_api_lot(items[0])
                    self._remote_cache[lot["lot_id"]] = lot
                    return lot
            except Exception as exc:
                logger.warning(f"[GoszakupClient] get_lot_by_id remote failed: {exc}")
            # Fallback на локальные данные
            for lot in self._local_data:
                if str(lot.get("lot_id")) == str(lot_id):
                    return lot
            return None

        for lot in self._local_data:
            if str(lot.get("lot_id")) == str(lot_id):
                return lot
        return None

    def get_trd_buy(self, trd_buy_id: str) -> dict:
        """Возвращает объявление о закупке."""
        if self.use_local_data:
            for lot in self._local_data:
                if lot.get("trd_buy_id") == trd_buy_id:
                    return lot
            return {}
        return self._get(f"/v3/trd-buy/{trd_buy_id}")

    def get_contracts(self, lot_id: str | None = None, page: int = 0, size: int = 20) -> list[dict]:
        """Возвращает контракты, при необходимости по лоту."""
        if self.use_local_data:
            contracts = []
            for lot in self._local_data:
                contracts.append({
                    "contract_id": f"CNT-{lot['lot_id']}",
                    "lot_id": lot["lot_id"],
                    "supplier_bin": lot["winner_bin"],
                    "customer_bin": lot["customer_bin"],
                    "contract_sum": lot["contract_sum"],
                    "sign_date": lot["publish_date"],
                })
            if lot_id:
                contracts = [c for c in contracts if c["lot_id"] == lot_id]
            return contracts[page * size:(page + 1) * size]

        params = {"limit": size, "offset": page * size}
        if lot_id:
            params["lot_id"] = lot_id
        data = self._get("/v3/contract", params)
        return data.get("items", [])

    def get_subject(self, bin_iin: str) -> dict:
        """Возвращает сведения об участнике по БИН/ИИН."""
        if self.use_local_data:
            return {
                "bin": bin_iin,
                "name_ru": f"Организация {bin_iin}",
                "status": "active",
            }
        return self._get(f"/v3/subject/{bin_iin}")

    def get_rnu(self, page: int = 0, size: int = 20) -> list[dict]:
        """Возвращает реестр недобросовестных поставщиков."""
        if self.use_local_data:
            return []
        data = self._get("/v3/rnu", {"limit": size, "offset": page * size})
        return data.get("items", [])

    def graphql_query(self, query: str, variables: dict | None = None) -> dict:
        """Выполняет GraphQL-запрос."""
        if self.use_local_data:
            logger.info("[GraphQL] Local mode — returning preloaded data")
            return {"data": {"lots": self._local_data[:20]}}

        resp = self._client.post(
            "/v3/graphql",
            json={"query": query, "variables": variables or {}},
        )
        resp.raise_for_status()
        return resp.json()

    def get_lots_graphql(self, after: int = 0, limit: int = 20) -> list[dict]:
        """Возвращает лоты через GraphQL."""
        query = """
        query GetLots($after: Int, $limit: Int) {
            Lots(filter: {}, after: $after, limit: $limit) {
                id
                nameRu
                descriptionRu
                descriptionKz
                amount
                customerBin
                count
                TrdBuy {
                    id
                    publishDate
                    endDate
                    refTradeMethodsId
                }
            }
        }
        """
        result = self.graphql_query(query, {"after": after, "limit": limit})
        return result.get("data", {}).get("Lots", [])

    def collect_all_lots(self, max_pages: int = 10, page_size: int = 50) -> list[dict]:
        """Собирает лоты по страницам.

        В remote-режиме идёт по курсорной пагинации API (next_page / search_after)
        и маппит каждый лот во внутренний формат. При ошибке API — откат на локальные данные.
        """
        if self.use_remote_api:
            return self._collect_remote(max_pages=max_pages, page_size=page_size)

        all_lots = []
        for page in range(max_pages):
            lots = self.get_lots(page=page, size=page_size)
            if not lots:
                break
            all_lots.extend(lots)
            logger.info(f"[Collect] Page {page}: {len(lots)} lots (total: {len(all_lots)})")
        return all_lots

    def _collect_remote(self, max_pages: int, page_size: int) -> list[dict]:
        """Собирает свежие лоты с живого API v3 через next_page."""
        page_size = max(1, min(page_size, 500))
        endpoint = f"/v3/lots?limit={page_size}"
        all_lots: list[dict] = []
        try:
            for page in range(max_pages):
                data = self._request(endpoint)
                items = data.get("items", []) or []
                if not items:
                    break
                for raw in items:
                    lot = self._map_api_lot(raw)
                    if not lot["lot_id"]:
                        continue
                    all_lots.append(lot)
                    self._remote_cache[lot["lot_id"]] = lot
                total = data.get("total", "?")
                logger.info(
                    f"[Collect/API] Page {page + 1}: +{len(items)} "
                    f"(собрано {len(all_lots)}, всего на портале {total})"
                )
                next_page = data.get("next_page")
                if not next_page:
                    break
                endpoint = next_page
                time.sleep(0.3)
        except Exception as exc:
            logger.error(f"[GoszakupClient] Remote collection failed: {exc}")
            if all_lots:
                logger.warning(f"[GoszakupClient] Returning {len(all_lots)} lots collected before error")
                return all_lots
            if self._local_data:
                logger.warning("[GoszakupClient] Falling back to local data")
                return self._local_data
            raise
        logger.info(f"[GoszakupClient] ✅ Collected {len(all_lots)} fresh lots from live API")
        return all_lots

    def get_total_lots(self) -> int:
        """Возвращает количество лотов."""
        if self.use_local_data:
            return len(self._local_data)
        return 0

    def close(self):
        """Закрывает HTTP-клиент."""
        if hasattr(self, "_client"):
            self._client.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
