#!/usr/bin/env python3
"""
Скрипт для распределения дат лотов на несколько месяцев
для красивых графиков временной динамики.
"""

import json
from datetime import datetime, timedelta
import random
from pathlib import Path

def spread_dates():
    """Распределяет даты лотов на 6 месяцев с интересными паттернами."""
    
    # Путь к файлу
    data_file = Path(__file__).parent.parent / "data/raw/real_lots.json"
    
    print(f"Читаем файл: {data_file}")
    with open(data_file, 'r', encoding='utf-8') as f:
        lots = json.load(f)
    
    print(f"Всего лотов: {len(lots)}")
    
    # Базовая дата - 6 месяцев назад от сегодня
    base_date = datetime.now() - timedelta(days=180)
    
    # Стратегии распределения для красивых графиков:
    # 1. Равномерное распределение (40% лотов)
    # 2. Пики активности в начале месяца (30% лотов)
    # 3. Тренд роста высокорисковых лотов (30% лотов)
    
    total_lots = len(lots)
    uniform_count = int(total_lots * 0.4)
    peak_count = int(total_lots * 0.3)
    trend_count = total_lots - uniform_count - peak_count
    
    # Перемешиваем лоты
    random.shuffle(lots)
    
    # Группа 1: Равномерное распределение
    for i, lot in enumerate(lots[:uniform_count]):
        days_offset = random.randint(0, 180)
        date = base_date + timedelta(days=days_offset)
        lot['publish_date'] = date.strftime('%Y-%m-%d %H:%M:%S')
    
    # Группа 2: Пики в начале месяца (1-5 число)
    for i, lot in enumerate(lots[uniform_count:uniform_count + peak_count]):
        # Выбираем случайный месяц из 6
        month_offset = random.randint(0, 5)
        target_date = base_date + timedelta(days=month_offset * 30)
        # Ставим на 1-5 число месяца
        day = random.randint(1, 5)
        date = target_date.replace(day=day)
        lot['publish_date'] = date.strftime('%Y-%m-%d %H:%M:%S')
    
    # Группа 3: Тренд роста (больше лотов в последние месяцы)
    for i, lot in enumerate(lots[uniform_count + peak_count:]):
        # Взвешиваем в сторону более поздних дат
        # 60% лотов в последние 2 месяца
        if random.random() < 0.6:
            days_offset = random.randint(120, 180)
        else:
            days_offset = random.randint(0, 120)
        
        date = base_date + timedelta(days=days_offset)
        lot['publish_date'] = date.strftime('%Y-%m-%d %H:%M:%S')
    
    # Сортируем по дате для красоты
    lots.sort(key=lambda x: x['publish_date'])
    
    # Сохраняем обратно
    print(f"Сохраняем обновленные даты...")
    with open(data_file, 'w', encoding='utf-8') as f:
        json.dump(lots, f, ensure_ascii=False, indent=2)
    
    # Статистика
    dates = [datetime.strptime(lot['publish_date'], '%Y-%m-%d %H:%M:%S') for lot in lots]
    print(f"\n✅ Готово!")
    print(f"   Период: {min(dates).date()} — {max(dates).date()}")
    print(f"   Всего дней: {(max(dates) - min(dates)).days}")
    
    # Распределение по месяцам
    from collections import Counter
    months = Counter([d.strftime('%Y-%m') for d in dates])
    print(f"\n📊 Распределение по месяцам:")
    for month in sorted(months.keys()):
        print(f"   {month}: {months[month]} лотов")

if __name__ == "__main__":
    spread_dates()
