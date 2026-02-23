#!/usr/bin/env python3
"""
Convert real goszakup.gov.kz data to GoszakupAI system format.
Converts lots.jsonl to the internal lot structure.
"""
import json
import sys
from pathlib import Path
from datetime import datetime, timedelta
import hashlib
import re

# Add project to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.utils.config import RAW_DIR, PROCESSED_DIR


def extract_budget(amount_str):
    """Parse budget from amount_raw field."""
    if not amount_str:
        return 0
    try:
        # Remove currency symbols and spaces, then parse
        amount = float(re.sub(r'[^\d.]', '', str(amount_str)))
        return int(amount)
    except:
        return 0


def extract_quantity(quantity_str):
    """Parse quantity from quantity field."""
    if not quantity_str:
        return 1
    try:
        qty = int(float(str(quantity_str)))
        return max(qty, 1)  # Minimum 1
    except:
        return 1


def categorize_lot(lot_data):
    """Categorize lot based on name/description."""
    name = (lot_data.get("lot_name", "") + " " + lot_data.get("lot_description", "")).lower()
    
    categories = {
        "Программное обеспечение": ["программ", "soft", "office", "kasper", "1c:"],
        "Ноутбуки": ["ноутбук", "laptop", "macbook", "dell", "hp", "lenovo", "thinkpad"],
        "Настольные компьютеры": ["компьютер", "desktop", "pc", "optiplex"],
        "Принтеры": ["принтер", "printer", "laserjet", "xerox"],
        "Медицинское оборудование": ["медиц", "hospital", "аппаuat", "УЗ", "рентген"],
        "Автомобили": ["автомобиль", "машина", "авто", "toyota", "kia", "hyundai", "lexus"],
        "Офисная мебель": ["мебель", "стол", "кресло", "шкаф", "стул"],
        "Услуги": ["услуг", "services", "обслуживание", "ремонт", "сервис"],
        "Продукты питания": ["молоко", "хлеб", "яблоко", "мясо", "продукт", "food"],
        "Хозяйственные товары": ["мыло", "щетка", "ведро", "тряпка", "бумага", "пакет"],
        "Строительные материалы": ["краска", "кирпич", "цемент", "доска", "строит"],
        "Инструменты": ["топор", "молоток", "пила", "инструмент"],
        "Электрооборудование": ["провод", "кабель", "лампа", "электр", "розетк"],
        "Услуги аренды": ["аренда", "rent", "взять напрокат"],
        "Канцелярские товары": ["ручка", "карандаш", "тетрадь", "степлер", "папка"],
    }
    
    for category, keywords in categories.items():
        for keyword in keywords:
            if keyword in name:
                return category
    
    return "Прочие товары и услуги"


def convert_real_lot(goszakup_lot, idx):
    """Convert a real goszakup lot to system format."""
    lot_number = goszakup_lot.get("lot_number", f"REAL-{idx}")
    budget = goszakup_lot.get("amount", 0)
    quantity = extract_quantity(goszakup_lot.get("quantity", 1))
    category_name = categorize_lot(goszakup_lot)
    
    # Generate consistent lot_id based on lot_number
    lot_id_base = hashlib.md5(lot_number.encode()).hexdigest()[:8]
    lot_id = f"R{lot_id_base.upper()}"
    
    name_ru = goszakup_lot.get("lot_name", goszakup_lot.get("announcement_name", "Лот без названия"))
    desc_ru = goszakup_lot.get("lot_description", name_ru)
    
    # Parse customer info
    customer_str = goszakup_lot.get("customer", "")
    # Extract БИН if present
    customer_bin = ""
    bin_match = re.search(r'\d{12}', customer_str)
    if bin_match:
        customer_bin = bin_match.group()
    else:
        customer_bin = f"1001{idx:08d}"[-12:]
    
    customer_name = customer_str.split(":")[-1].strip()[:100] if customer_str else "Заказчик"
    
    # Estimate deadline based on status
    deadline_days = 15 if "прием" in goszakup_lot.get("status", "").lower() else 30
    publish_date = datetime.now() - timedelta(days=5)
    end_date = publish_date + timedelta(days=deadline_days)
    
    return {
        "lot_id": lot_id,
        "trd_buy_id": lot_number,
        "name_ru": name_ru[:200],
        "desc_ru": desc_ru[:500],
        "extra_desc_ru": f"Оригинальный лот: {goszakup_lot.get('announcement_url', '')}",
        "category_code": f"CAT-{category_name.replace(' ', '-')}",
        "category_name": category_name,
        "budget": int(budget),
        "contract_sum": int(budget * 0.9),
        "publish_date": publish_date.isoformat(),
        "end_date": end_date.isoformat(),
        "deadline_days": deadline_days,
        "participants_count": max(1, budget // 1_000_000),  # Estimate
        "customer_bin": customer_bin,
        "customer_name": customer_name,
        "winner_bin": "",
        "city": "Казахстан",
        "status": "PUBLISHED" if "опубликов" in goszakup_lot.get("status", "").lower() else "DRAFT",
        "label": "real",
        "procurement_method": goszakup_lot.get("procurement_method", ""),
        "quantity": quantity,
    }


def load_real_data(input_file):
    """Load real lots from JSONL file."""
    input_path = Path(input_file)
    
    if not input_path.exists():
        print(f"❌ File not found: {input_path}")
        return []
    
    lots = []
    errors = 0
    
    print(f"📖 Loading real lots from: {input_path}")
    
    with open(input_path, 'r', encoding='utf-8') as f:
        for idx, line in enumerate(f, 1):
            if idx % 1000 == 0:
                print(f"  Processing... {idx} lots read")
            
            try:
                lot_data = json.loads(line.strip())
                converted_lot = convert_real_lot(lot_data, idx)
                lots.append(converted_lot)
            except Exception as e:
                errors += 1
                if errors <= 5:  # Print first 5 errors
                    print(f"  ⚠️  Error on line {idx}: {e}")
    
    print(f"✅ Loaded {len(lots)} lots ({errors} errors)")
    return lots


def save_real_data(lots, output_path=None):
    """Save converted lots to JSON."""
    if output_path is None:
        output_path = RAW_DIR / "real_lots.json"
    
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(lots, f, ensure_ascii=False, indent=2)
    
    print(f"💾 Saved {len(lots)} lots to: {output_path}")
    
    # Print statistics
    categories = {}
    for lot in lots:
        cat = lot.get("category_name", "Unknown")
        categories[cat] = categories.get(cat, 0) + 1
    
    print(f"\n📊 Category distribution:")
    for cat, count in sorted(categories.items(), key=lambda x: -x[1])[:10]:
        print(f"  {cat}: {count}")
    
    return lots


def main():
    input_file = "/Users/beka/Downloads/lots.jsonl"
    
    # Load and convert
    real_lots = load_real_data(input_file)
    
    if real_lots:
        # Save converted data
        save_real_data(real_lots)
        
        # Calculate budget statistics
        budgets = [lot["budget"] for lot in real_lots if lot["budget"] > 0]
        if budgets:
            total_budget = sum(budgets)
            avg_budget = sum(budgets) / len(budgets)
            print(f"\n💰 Budget statistics:")
            print(f"  Total: ₸{total_budget:,.0f}")
            print(f"  Average: ₸{avg_budget:,.0f}")
            print(f"  Min: ₸{min(budgets):,.0f}")
            print(f"  Max: ₸{max(budgets):,.0f}")


if __name__ == "__main__":
    main()
