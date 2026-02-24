#!/usr/bin/env python3
"""
Добавляет синтетические данные о победителях к лотам для демонстрации графа связей.
"""

import json
import random
from pathlib import Path

def add_synthetic_winners():
    """Добавляет winner_bin и winner_name к 80% лотов."""
    
    data_file = Path(__file__).parent.parent / "data/raw/real_lots.json"
    
    print(f"Читаем файл: {data_file}")
    with open(data_file, 'r', encoding='utf-8') as f:
        lots = json.load(f)
    
    print(f"Всего лотов: {len(lots)}")
    
    # Список синтетических поставщиков с БИН и названиями
    suppliers = [
        {"bin": "111140001122", "name": "ТОО Альфа Снаб"},
        {"bin": "222240002233", "name": "АО БетаТех"},
        {"bin": "333340003344", "name": "ТОО ГаммаТрейд"},
        {"bin": "444440004455", "name": "АО ДельтаСервис"},
        {"bin": "555540005566", "name": "ТОО ЭпсилонСтрой"},
        {"bin": "666640006677", "name": "АО ЗетаТранс"},
        {"bin": "777740007788", "name": "ТОО ЭтаЛогистик"},
        {"bin": "888840008899", "name": "АО ТетаПлюс"},
        {"bin": "999940009900", "name": "ТОО ЙотаГруп"},
        {"bin": "101040001011", "name": "АО КаппаКомпани"},
        {"bin": "121240002122", "name": "ТОО ЛамбдаСистемс"},
        {"bin": "131340003133", "name": "АО МюСаплайз"},
        {"bin": "141440004144", "name": "ТОО НюТехнолоджи"},
        {"bin": "151540005155", "name": "АО КсиПартнерс"},
        {"bin": "161640006166", "name": "ТОО ОмикронТорг"},
        {"bin": "171740007177", "name": "АО ПиДистрибьюшн"},
        {"bin": "181840008188", "name": "ТОО РоСнабжение"},
        {"bin": "191940009199", "name": "АО СигмаРесурс"},
        {"bin": "202040001200", "name": "ТОО ТауИмпорт"},
        {"bin": "212140002211", "name": "АО ФиЭкспорт"},
    ]
    
    # Создаём паттерны для более реалистичных связей:
    # - Некоторые поставщики специализируются в определённых категориях
    # - Некоторые заказчики предпочитают определённых поставщиков
    
    customer_preferences = {}  # customer_bin -> preferred suppliers
    winner_count = 0
    
    for lot in lots:
        # 80% лотов получают победителя
        if random.random() < 0.8:
            customer_bin = lot.get("customer_bin", "")
            
            # Если у заказчика есть предпочтения, используем их с вероятностью 60%
            if customer_bin in customer_preferences and random.random() < 0.6:
                winner = random.choice(customer_preferences[customer_bin])
            else:
                winner = random.choice(suppliers)
                
                # Сохраняем предпочтение (заказчик работает с этим поставщиком)
                if customer_bin:
                    if customer_bin not in customer_preferences:
                        customer_preferences[customer_bin] = []
                    if winner not in customer_preferences[customer_bin]:
                        customer_preferences[customer_bin].append(winner)
                        # Ограничим 2-5 предпочтительными поставщиками на заказчика
                        if len(customer_preferences[customer_bin]) > random.randint(2, 5):
                            customer_preferences[customer_bin].pop(0)
            
            lot["winner_bin"] = winner["bin"]
            lot["winner_name"] = winner["name"]
            winner_count += 1
    
    # Сохраняем обратно
    print(f"Сохраняем обновленные данные...")
    with open(data_file, 'w', encoding='utf-8') as f:
        json.dump(lots, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ Готово!")
    print(f"   Лотов с победителями: {winner_count} из {len(lots)} ({winner_count/len(lots)*100:.1f}%)")
    print(f"   Уникальных заказчиков: {len(customer_preferences)}")
    print(f"   Уникальных поставщиков: {len(suppliers)}")

if __name__ == "__main__":
    add_synthetic_winners()
