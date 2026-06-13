# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Что это

GoszakupAI — система анализа рисков государственных закупок Казахстана. Backend (FastAPI + ML) присваивает каждому лоту риск-балл 0–100 и уровень (LOW/MEDIUM/HIGH/CRITICAL), выявляя признаки заточки тендера под конкретного поставщика. Frontend (React) — дашборд для просмотра лотов, заказчиков, категорий, графа связей и ручного анализа ТЗ.

## Команды

Всё управление — через `Makefile` (см. `make help`). Команды Docker/Make подгружают переменные из `envs/.dev.env` или `envs/.prod.env`.

**Docker (рекомендуется):**
- `make start` — собрать и поднять dev (API `:8008`, Frontend `:3000`, Swagger `:8008/docs`)
- `make stop` / `make logs` / `make logs-api` / `make logs-front` / `make health` / `make clean`
- `make prod` — продакшен (Frontend `:8080`, API внутри сети); `make deploy` — git pull + сборка на сервере `bekzhan@77.42.43.153`

**Без Docker:**
- Backend: `make dev-setup` → `source .venv311/bin/activate` → `make dev-install` → `make dev-backend` (uvicorn на `:8008`)
- Frontend: `cd frontend && npm install && npm run dev`
- CLI-анализ всех лотов с печатью топ-рисков: `python main.py` (а `python main.py serve` поднимает API)

**Frontend:**
- `cd frontend && npm run build` (`tsc -b && vite build`), `npm run lint` (eslint), `npm run preview`

**Тесты:** автоматических тестов нет. `test_pdf_*.py` в корне — ручные отладочные скрипты для проверки кириллицы в PDF, не test-suite.

## Архитектура

### Источник данных — локальные файлы, не живой API
`GoszakupClient` (`src/ingestion/goszakup_client.py`) по умолчанию читает лоты из `data/raw/lot_details.json` или `data/raw/real_lots.json`, **не** из сети. Удалённый API goszakup.gov.kz задействуется только если задан `GOSZAKUP_TOKEN` и установлен `httpx`. Сырьё `data/raw/lot_details.jsonl` конвертируется в `real_lots.json` скриптами из `scripts/` (`convert_real_data.py`, `convert_lot_details.py` и др.; `mark_synthetic_lots.py`/`add_winners.py`/`spread_dates.py` дополняют поля). Поле `is_synthetic` отличает добавленные синтетические лоты от реальных.

### Один глобальный анализатор на процесс
`src/api/routes.py` держит модульный глобальный `analyzer: GoszakupAnalyzer`, создаваемый в FastAPI `lifespan` при старте. `analyzer.initialize()` загружает все лоты, строит фичи/индексы/граф и (при необходимости) обучает ML. Затем `start_background_analysis()` в фоновом потоке инкрементально прогоняет анализ батчами. Почти каждый эндпоинт делает `if not analyzer: raise 503` и вызывает `analyze_incremental(...)`, дочитывая ещё необработанные лоты. Результаты лежат в памяти (`_analysis_cache`) и персистятся в `data/processed/analysis_cache.json` (при загрузке кэш «гидрируется» свежими полями из `real_lots.json`).

### Конвейер анализа одного лота — `GoszakupAnalyzer._analyze()` (`src/model/analyzer.py`)
Пять стадий, каждая в своём модуле `src/`, объединяются в `FullAnalysis`:
1. **FeatureEngineer** (`preprocessing/feature_engineer.py`) — `LotFeatures`, медианы цен по категориям, история по заказчику.
2. **RuleEngine** (`model/rules.py`) — правила-индикаторы Datanomix (бренды без «или эквивалент», запрет аналогов, проприетарные термины, дилерские/гео-ограничения и т.д.) → `AnalysisResult` с `rules_triggered`.
3. **Vectorizer** (`model/vectorizer.py`) — поиск похожих ТЗ, детект copy-paste / уникальности (TF-IDF; опционально transformer-эмбеддинги при `use_transformers=True`).
4. **RiskScorer** (`model/scorer.py`) — ML: CatBoost (`risk_scorer.cbm`) + IsolationForest (`isolation_forest.pkl`) в `data/models/`.
5. **NetworkAnalyzer** (`model/network.py`) — граф заказчик↔поставщик через networkx, сетевые флаги по БИН.

`_compute_final_score()` смешивает их с весами: **правила 50% + ML 40% + семантика 5% + сеть 5%**, обрезает до 0–100, переводит в уровень через `get_risk_level()`. Пороги, веса правил и константы — в `src/utils/config.py`.

### Обучение и метки (важный нюанс)
При старте модели **переобучаются**, если данных >100 лотов (`has_real_data`) или `FORCE_TRAIN=1`. Метки берутся из CSV (`LABELS_CSV`, по умолчанию `data/processed/labels.csv`); этот CSV пополняет эндпоинт `POST /api/feedback`. Без меток scorer обучается на **псевдо-метках** из rule_score (порог 50) — CatBoost-предсказания в этом режиме приблизительны (см. предупреждения в `scorer.py`). `EXPORT_TRAIN_DATA=1` выгружает обучающую выборку в `data/processed/catboost_train.{json,csv}`.

### Frontend (`frontend/`)
React 19 + Vite 7 + TypeScript + Tailwind + Radix UI + react-router 7. Все вызовы API — через хуки в `src/hooks/useApi.ts`; типы ответов — `src/types/api.ts`. Базовый URL: `import.meta.env.VITE_API_BASE_URL`. Алиас импорта `@` → `src/`. Локализация ru/kz через i18next (`src/locales/`, `src/i18n.ts`). Страницы (`src/pages/`) соответствуют маршрутам в `App.tsx`; общий каркас с сайдбаром — `Layout.tsx` (лендинг `/` рендерится без него).

### Сеть и порты
- **Dev:** API `:8008`, Frontend `:3000`. Vite dev-server проксирует `/api` и `/health` на backend.
- **Prod:** nginx во frontend-контейнере отдаёт SPA и проксирует `/api` → контейнер `api:${API_PORT}` (`frontend/nginx.conf.template`, подстановка через envsubst).
- docker-compose слоистый: `docker-compose.yml` (база) + `docker-compose.dev.yml` / `docker-compose.prod.yml` (оверрайды), как задано в Makefile.
- ⚠️ В `config.py` `API_PORT=8000` (дефолт для `main.py serve`), но Docker и `make dev-backend` запускают на **8008** через env. CORS открыт (`CORS_ALLOWED_ORIGINS=["*"]`).

## Документация API
`docs/API.md` — подробное описание эндпоинтов с примерами curl/JS. Эндпоинты: `/api/lots`, `/api/lots/{id}/analysis`, `/api/lots/compare`, `/api/lots/{id}/export/pdf`, `/api/analyze`, `/api/feedback`, `/api/stats/{dashboard,timeline,category-pricing}`, `/api/network/{graph,{bin}}`, `/api/customers*`, `/api/categories*`, `/api/export/csv`.

## Язык
Код, комментарии, логи и пользовательский текст — преимущественно на русском (домен — закупки РК). Сохраняй этот стиль и кириллицу.
