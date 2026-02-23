"""Точка входа GoszakupAI.

Запуск:
    python main.py
    uvicorn src.api.routes:app --reload --port 8000
"""
import sys
import json
import logging
from pathlib import Path

import numpy as np


class NumpyEncoder(json.JSONEncoder):
    """JSON-энкодер для типов numpy."""
    def default(self, obj):
        if isinstance(obj, (np.integer, np.bool_)):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


def run_analysis():
    """Запускает полный анализ на доступных данных."""
    from src.model.analyzer import GoszakupAnalyzer
    from src.utils.config import PROCESSED_DIR

    logger.info("=" * 60)
    logger.info("GoszakupAI — Анализ рисков государственных закупок РК")
    logger.info("=" * 60)

    logger.info("\n[2/4] Инициализация анализатора...")
    analyzer = GoszakupAnalyzer(use_transformers=False)
    analyzer.initialize()

    logger.info("\n[3/4] Анализ лотов...")
    results = analyzer.analyze_all()

    logger.info("\n[4/4] Сохранение результатов...")
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    output = []
    for r in results:
        output.append(r.to_dict())

    output_path = PROCESSED_DIR / "results.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2, cls=NumpyEncoder)

    levels = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
    for r in results:
        levels[r.final_level] = levels.get(r.final_level, 0) + 1

    print("\n" + "=" * 60)
    print("📊 РЕЗУЛЬТАТЫ АНАЛИЗА")
    print("=" * 60)
    print(f"  Всего лотов:    {len(results)}")
    print(f"  🟢 LOW:         {levels['LOW']}")
    print(f"  🟡 MEDIUM:      {levels['MEDIUM']}")
    print(f"  🔴 HIGH:        {levels['HIGH']}")
    print(f"  ⛔ CRITICAL:    {levels['CRITICAL']}")
    print(f"\n  Результаты: {output_path}")

    top = sorted(results, key=lambda x: x.final_score, reverse=True)[:5]
    print(f"\n  🔝 ТОП-5 ПОДОЗРИТЕЛЬНЫХ ЛОТОВ:")
    for i, r in enumerate(top, 1):
        rules = len(r.rule_analysis.rules_triggered) if r.rule_analysis else 0
        name = r.lot_data.get("name_ru", "")[:50]
        print(f"  {i}. [{r.final_level:8s}] {r.final_score:5.1f} баллов | {rules} правил | {name}")
        if r.rule_analysis:
            for rule in r.rule_analysis.rules_triggered[:3]:
                print(f"     → {rule.rule_name_ru} (+{rule.raw_score})")

    print("\n" + "=" * 60)
    print("🚀 Для запуска API:")
    print("   uvicorn src.api.routes:app --reload --port 8000")
    print("=" * 60)


def run_server():
    """Запускает сервер FastAPI."""
    import uvicorn
    from src.utils.config import API_HOST, API_PORT
    uvicorn.run("src.api.routes:app", host=API_HOST, port=API_PORT, reload=True)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "serve":
        run_server()
    else:
        run_analysis()