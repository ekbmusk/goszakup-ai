#!/bin/bash

echo "=== GOSZAKUP AI: ТЕХНИЧЕСКИЙ АУДИТ СИСТЕМЫ ==="
echo ""

# 1. Проверка окружения
echo "1. Библиотеки и среда (Runtime):"
if [ -d ".venv311" ]; then
    SIZE=$(du -sh .venv311 | cut -f1)
    echo "   [OK] Виртуальное окружение .venv311 найдено ($SIZE)"
else
    echo "   [!] Окружение .venv311 не найдено"
fi

# 2. Проверка моделей ИИ
echo ""
echo "2. Собственные модели ИИ (Weights):"
MODELS_DIR="data/models"

check_model() {
    if [ -d "$1" ] || [ -f "$1" ]; then
        SIZE=$(du -sh "$1" | cut -f1)
        echo "   [OK] Модель $2 найдена ($SIZE)"
    else
        echo "   [MISSING] Модель $2 НЕ НАЙДЕНА в $1"
    fi
}

check_model "$MODELS_DIR/sentence_bert" "NLP (LaBSE/BERT)"
check_model "$MODELS_DIR/iso_forest.joblib" "Anomaly Detector (Isolation Forest)"
check_model "$MODELS_DIR/catboost_risk_model.bin" "Risk Scorer (CatBoost)"

# 3. Итоговый статус
echo ""
echo "3. Статус автономности:"
if [ -d "$MODELS_DIR/sentence_bert" ]; then
    echo "   >>> СИСТЕМА ГОТОВА К АВТОНОМНОЙ РАБОТЕ (AIR-GAPPED READY) <<<"
else
    echo "   >>> ВНИМАНИЕ: ТРЕБУЕТСЯ ЗАГРУЗКА ВЕСОВ МОДЕЛЕЙ <<<"
fi