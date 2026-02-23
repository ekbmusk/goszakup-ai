.PHONY: help build up down restart logs clean dev-setup dev-backend dev-frontend

# Цвета для вывода
GREEN=\033[0;32m
NC=\033[0m # No Color

help: ## Показать помощь
	@echo "${GREEN}GoszakupAI - Makefile команды${NC}"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ========== Docker команды ==========

build: ## Собрать Docker образы
	@echo "${GREEN}Сборка Docker образов...${NC}"
	docker-compose build

up: ## Запустить все сервисы
	@echo "${GREEN}Запуск сервисов...${NC}"
	docker-compose up -d

down: ## Остановить все сервисы
	@echo "${GREEN}Остановка сервисов...${NC}"
	docker-compose down

restart: down up ## Перезапустить все сервисы

logs: ## Показать логи всех сервисов
	docker-compose logs -f

logs-api: ## Показать логи API
	docker-compose logs -f api

logs-frontend: ## Показать логи Frontend
	docker-compose logs -f frontend

clean: ## Остановить и удалить все контейнеры, volumes
	@echo "${GREEN}Очистка Docker ресурсов...${NC}"
	docker-compose down -v
	docker system prune -f

# ========== Локальная разработка ==========

dev-setup: ## Настроить локальное окружение для разработки
	@echo "${GREEN}Создание venv и установка зависимостей...${NC}"
	python3.11 -m venv .venv311
	@echo "${GREEN}Активируйте venv командой:${NC}"
	@echo "  source .venv311/bin/activate"
	@echo "${GREEN}Затем выполните: make dev-install${NC}"

dev-install: ## Установить зависимости (внутри venv)
	@echo "${GREEN}Обновление pip и установка зависимостей...${NC}"
	pip install -U pip
	pip install -r requirements.txt
	@echo "${GREEN}Установка frontend зависимостей...${NC}"
	cd frontend && npm install

dev-backend: ## Запустить бэкенд локально
	@echo "${GREEN}Запуск FastAPI сервера на порту 8006...${NC}"
	uvicorn src.api.routes:app --reload --port 8006

dev-frontend: ## Запустить фронтенд локально
	@echo "${GREEN}Запуск Vite dev сервера...${NC}"
	cd frontend && npm run dev


convert-data: ## Конвертировать lot_details.jsonl
	@echo "${GREEN}Конвертация данных...${NC}"
	python scripts/convert_lot_details.py

health: ## Проверить здоровье сервисов
	@echo "${GREEN}Проверка API...${NC}"
	@curl -f http://localhost:8006/health || echo "API недоступен"
	@echo ""
	@echo "${GREEN}Проверка Frontend...${NC}"
	@curl -f http://localhost:3000 || echo "Frontend недоступен"

ps: ## Показать статус контейнеров
	docker-compose ps


start: build up ## Быстрый старт: собрать и запустить
	@echo "${GREEN}Сервисы запущены!${NC}"
	@echo "API: http://localhost:8006"
	@echo "Frontend: http://localhost:3000"
	@echo ""
	@echo "Логи: make logs"

stop: down ## Остановить все

# По умолчанию показываем help
.DEFAULT_GOAL := help
