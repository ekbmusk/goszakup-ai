"""Convert lot_details.jsonl to internal lots JSON."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any


BASE_DIR = Path(__file__).resolve().parent.parent
RAW_DIR = BASE_DIR / "data" / "raw"

DEFAULT_INPUT = Path.home() / "Downloads" / "lot_details.jsonl"
DEFAULT_OUTPUT = RAW_DIR / "real_lots.json"
RAW_JSONL = RAW_DIR / "lot_details.jsonl"


def _parse_float(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).replace(" ", "").replace("\u00a0", "")
    text = text.replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return 0.0


def _safe_str(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def _normalize_deadline(value: Any) -> int:
    days = int(_parse_float(value))
    if days <= 0 or days > 365:
        return 0
    return days


def _read_jsonl(path: Path) -> list[dict]:
    items: list[dict] = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            items.append(json.loads(line))
    return items


def _convert_record(item: dict) -> dict:
    fields = item.get("fields", {})
    fields_flat = item.get("fields_flat", {})

    def field_value(name: str) -> Any:
        if name in fields and isinstance(fields[name], dict):
            return fields[name].get("value")
        return fields_flat.get(name)

    def field_amount(name: str) -> Any:
        if name in fields and isinstance(fields[name], dict):
            return fields[name].get("amount_parsed")
        return None

    lot_number = _safe_str(item.get("lot_number") or field_value("Лот №"))
    lot_number = lot_number.replace(" История", "").strip()

    category_name = _safe_str(field_value("Наименование ТРУ"))
    short_desc = _safe_str(field_value("Краткая характеристика"))
    extra_desc = _safe_str(field_value("Дополнительная характеристика"))
    incoterms = _safe_str(field_value("Условия поставки ИНКОТЕРМС"))

    budget = field_amount("Запланированная сумма")
    if budget is None:
        budget = field_amount("Сумма 1 год")
    if budget is None:
        budget = field_amount("Цена за единицу")
    budget_value = _parse_float(budget)

    deadline_value = field_amount("Срок поставки ТРУ")

    return {
        "lot_id": lot_number or _safe_str(item.get("url")),
        "trd_buy_id": lot_number,
        "name_ru": category_name or _safe_str(item.get("lot_heading")),
        "desc_ru": short_desc,
        "extra_desc_ru": " ".join([p for p in [extra_desc, incoterms] if p]).strip(),
        "budget": budget_value,
        "participants_count": 0,
        "deadline_days": _normalize_deadline(deadline_value),
        "category_code": _safe_str(field_value("Код ТРУ")),
        "category_name": category_name,
        "customer_bin": _safe_str(field_value("БИН заказчика")),
        "customer_name": _safe_str(field_value("Наименование заказчика")),
        "winner_bin": "",
        "contract_sum": budget_value,
        "publish_date": _safe_str(field_value("Дата начала приема заявок")),
        "city": "",
        "source_url": _safe_str(item.get("url")),
        "lot_status": _safe_str(item.get("lot_status")),
    }


def main() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    input_path = RAW_JSONL if RAW_JSONL.exists() else DEFAULT_INPUT
    if not input_path.exists():
        raise FileNotFoundError(f"Input JSONL not found: {input_path}")

    data = _read_jsonl(input_path)
    lots = [_convert_record(item) for item in data]

    DEFAULT_OUTPUT.write_text(
        json.dumps(lots, ensure_ascii=True),
        encoding="utf-8",
    )

    print(f"Converted {len(lots)} lots -> {DEFAULT_OUTPUT}")


if __name__ == "__main__":
    main()
