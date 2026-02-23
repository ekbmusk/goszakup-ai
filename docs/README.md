# Запуск проекта

## Docker (рекомендуется)

```bash
make start
```

Сервисы:

- API: http://localhost:8006/docs
- Frontend: http://localhost:5173

Логи: `make logs`  
Остановка: `make stop`

---

## Локально

### 1. Backend

```bash
python3.11 -m venv .venv311
source .venv311/bin/activate
pip install -U pip
pip install -r requirements.txt
uvicorn src.api.routes:app --reload --port 8006
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Команды

- `make help` - все команды
- `make build` - собрать образы
- `make logs-api` - логи API
- `make clean` - очистка
