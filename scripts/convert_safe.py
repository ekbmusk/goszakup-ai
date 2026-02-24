"""Safe converter for lot_details.jsonl with error handling."""
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
RAW_DIR = BASE_DIR / "data" / "raw"
INPUT = RAW_DIR / "lot_details.jsonl"
OUTPUT = RAW_DIR / "real_lots.json"


def parse_float(value):
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).replace(" ", "").replace("\u00a0", "").replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return 0.0


def safe_str(value):
    return str(value).strip() if value is not None else ""


def normalize_deadline(value):
    days = int(parse_float(value))
    if days <= 0 or days > 365:
        return 0
    return days


def extract_field(fields, key, amount_key="amount_parsed"):
    field = fields.get(key, {})
    if isinstance(field, dict):
        return field.get("value", ""), field.get(amount_key)
    return str(field), None


def convert_item(raw_item):
    """Convert single raw item to internal format."""
    fields = raw_item.get("fields", {})
    
    lot_number = extract_field(fields, "Лот №")[0]
    # Clean up lot_number by removing "История" and other extra text
    lot_number = lot_number.replace(" История", "").strip()
    
    budget = parse_float(extract_field(fields, "Запланированная сумма")[1])
    if budget == 0:
        budget = parse_float(extract_field(fields, "Сумма 1 год")[1])
    if budget == 0:
        budget = parse_float(extract_field(fields, "Цена за единицу")[1])
    
    category_code = safe_str(extract_field(fields, "Код ТРУ")[0])
    category_name = safe_str(extract_field(fields, "Наименование ТРУ")[0])
    
    desc_ru = safe_str(extract_field(fields, "Краткая характеристика")[0])
    extra_desc_ru = safe_str(extract_field(fields, "Дополнительная характеристика")[0])
    
    city = safe_str(extract_field(fields, "Место поставки товара, КАТО")[0])
    if not city:
        city = "Не указано"
    
    deadline_str = extract_field(fields, "Срок поставки ТРУ")[0]
    deadline_days = normalize_deadline(extract_field(fields, "Срок поставки ТРУ")[1]) or 0
    
    customer_bin = safe_str(extract_field(fields, "БИН заказчика")[0])
    customer_name = safe_str(extract_field(fields, "Наименование заказчика")[0])
    
    date_start = safe_str(extract_field(fields, "Дата начала приема заявок")[0])
    date_end = safe_str(extract_field(fields, "Дата окончания приема заявок")[0])
    
    # Additional fields
    unit = safe_str(extract_field(fields, "Единица измерения")[0])
    quantity = parse_float(extract_field(fields, "Количество")[1]) or 0
    unit_price = parse_float(extract_field(fields, "Цена за единицу")[1]) or 0
    advance_payment_pct = parse_float(extract_field(fields, "Размер авансового платежа %")[1]) or 0
    financing_source = safe_str(extract_field(fields, "Источник финансирования")[0])
    incoterms = safe_str(extract_field(fields, "Условия поставки ИНКОТЕРМС")[0])
    dumping_status = safe_str(extract_field(fields, "Признак демпинга")[0])
    
    # Contact information
    contact_person = safe_str(extract_field(fields, "ФИО представителя")[0])
    contact_position = safe_str(extract_field(fields, "Должность")[0])
    contact_phone = safe_str(extract_field(fields, "Контактный телефон")[0])
    contact_email = safe_str(extract_field(fields, "E-Mail")[0])
    
    # Root-level metadata
    url = safe_str(raw_item.get("url", ""))
    lot_status = safe_str(raw_item.get("lot_status", ""))
    
    return {
        "lot_id": lot_number,
        "name_ru": category_name or desc_ru[:100],
        "desc_ru": desc_ru,
        "extra_desc_ru": extra_desc_ru,
        "category_code": category_code,
        "category_name": category_name,
        "budget": budget,
        "participants_count": 0,
        "deadline_days": deadline_days,
        "city": city,
        "customer_bin": customer_bin,
        "customer_name": customer_name,
        "publish_date": date_start,
        "deadline_date": date_end,
        # Additional procurement details
        "unit": unit,
        "quantity": quantity,
        "unit_price": unit_price,
        "advance_payment_pct": advance_payment_pct,
        "financing_source": financing_source,
        "incoterms": incoterms,
        "dumping_status": dumping_status,
        # Contact information
        "contact_person": contact_person,
        "contact_position": contact_position,
        "contact_phone": contact_phone,
        "contact_email": contact_email,
        # Metadata
        "url": url,
        "lot_status": lot_status,
    }


def main():
    print(f"Reading from: {INPUT}")
    
    converted = []
    errors = 0
    
    with INPUT.open("r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            
            try:
                raw = json.loads(line)
                item = convert_item(raw)
                converted.append(item)
            except json.JSONDecodeError as e:
                print(f"JSON error on line {line_num}: {e}")
                errors += 1
            except Exception as e:
                print(f"Conversion error on line {line_num}: {e}")
                errors += 1
    
    print(f"✅ Converted: {len(converted)} lots")
    print(f"❌ Errors: {errors}")
    
    with OUTPUT.open("w", encoding="utf-8") as f:
        json.dump(converted, f, ensure_ascii=False, indent=2)
    
    print(f"Saved to: {OUTPUT}")


if __name__ == "__main__":
    main()
