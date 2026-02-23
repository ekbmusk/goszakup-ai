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
        self.token = token or GOSZAKUP_TOKEN
        self.base_url = GOSZAKUP_BASE_URL
        self.use_mock = not bool(self.token)

        if self.use_mock:
            logger.warning(
                "[GoszakupClient] No token provided. Using mock data. "
                "Set GOSZAKUP_TOKEN in .env to use real API."
            )
            self._mock_data = self._load_mock_data()
        elif not HAS_HTTPX:
            logger.warning(
                "[GoszakupClient] httpx not installed, falling back to mock data."
            )
            self.use_mock = True
            self._mock_data = self._load_mock_data()
        else:
            self._client = httpx.Client(
                base_url=self.base_url,
                headers={
                    "Authorization": f"Bearer {self.token}",
                    "Content-Type": "application/json",
                },
                timeout=30.0,
            )

    def _enable_mock(self, reason: str) -> None:
        if self.use_mock:
            return
        logger.warning(f"[GoszakupClient] Falling back to mock data: {reason}")
        self.use_mock = True
        self._mock_data = self._load_mock_data()

    def _load_mock_data(self) -> list[dict]:
        """Загружает мок-данные из схемы или генерирует их."""
        schema_path = RAW_DIR / "goszakup_schema_mock.json"
        try:
            from src.ingestion.goszakup_mock import build_internal_lots, save_schema_mock

            if schema_path.exists():
                with open(schema_path, "r", encoding="utf-8") as f:
                    schema_data = json.load(f)
                return build_internal_lots(schema_data)

            return save_schema_mock(RAW_DIR / "mock_lots.json")
        except Exception:
            mock_path = RAW_DIR / "mock_lots.json"
            if mock_path.exists():
                with open(mock_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            return []

    def _get(self, endpoint: str, params: dict | None = None) -> dict:
        """GET-запрос с повторами."""
        if self.use_mock:
            raise RuntimeError("Real API not available. Using mock data.")

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
        if self.use_mock:
            start = page * size
            return self._mock_data[start:start + size]
        try:
            data = self._get("/v3/lots", {"limit": size, "offset": page * size})
            return data.get("items", data.get("data", []))
        except Exception as exc:
            self._enable_mock(f"get_lots failed: {exc}")
            start = page * size
            return self._mock_data[start:start + size]

    def get_lot_by_id(self, lot_id: str) -> dict | None:
        """Возвращает лот по идентификатору."""
        if self.use_mock:
            for lot in self._mock_data:
                if str(lot.get("lot_id")) == str(lot_id):
                    return lot
            return None

        return self._get(f"/v3/lots/{lot_id}")

    def get_trd_buy(self, trd_buy_id: str) -> dict:
        """Возвращает объявление о закупке."""
        if self.use_mock:
            for lot in self._mock_data:
                if lot.get("trd_buy_id") == trd_buy_id:
                    return lot
            return {}
        return self._get(f"/v3/trd-buy/{trd_buy_id}")

    def get_contracts(self, lot_id: str | None = None, page: int = 0, size: int = 20) -> list[dict]:
        """Возвращает контракты, при необходимости по лоту."""
        if self.use_mock:
            contracts = []
            for lot in self._mock_data:
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
        if self.use_mock:
            return {
                "bin": bin_iin,
                "name_ru": f"Организация {bin_iin}",
                "status": "active",
            }
        return self._get(f"/v3/subject/{bin_iin}")

    def get_rnu(self, page: int = 0, size: int = 20) -> list[dict]:
        """Возвращает реестр недобросовестных поставщиков."""
        if self.use_mock:
            return [
                {"bin": SUPPLIER_BINS[0], "reason": "Неисполнение обязательств"},
                {"bin": SUPPLIER_BINS[1], "reason": "Предоставление ложных сведений"},
            ]
        data = self._get("/v3/rnu", {"limit": size, "offset": page * size})
        return data.get("items", [])

    def graphql_query(self, query: str, variables: dict | None = None) -> dict:
        """Выполняет GraphQL-запрос."""
        if self.use_mock:
            logger.info("[GraphQL] Mock mode — returning mock data")
            return {"data": {"lots": self._mock_data[:20]}}

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
        """Собирает лоты по страницам."""
        all_lots = []
        for page in range(max_pages):
            lots = self.get_lots(page=page, size=page_size)
            if not lots:
                break
            all_lots.extend(lots)
            logger.info(f"[Collect] Page {page}: {len(lots)} lots (total: {len(all_lots)})")
            if not self.use_mock:
                time.sleep(0.5)
        return all_lots

    def get_total_lots(self) -> int:
        """Возвращает количество лотов."""
        if self.use_mock:
            return len(self._mock_data)
        return len(self._mock_data) if self.use_mock else 0

    def close(self):
        """Закрывает HTTP-клиент."""
        if hasattr(self, "_client"):
            self._client.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


from src.ingestion.mock_data import SUPPLIER_BINS