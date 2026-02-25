.PHONY: help start stop prod prod-down prod-logs deploy logs logs-api logs-front clean health ps dev-backend dev-frontend dev-setup dev-install

# Цвета
GREEN  = \033[0;32m
YELLOW = \033[1;33m
CYAN   = \033[0;36m
NC     = \033[0m

# Конфиги
DEV_COMPOSE  = docker-compose.yml -f docker-compose.dev.yml
PROD_COMPOSE = docker-compose.yml -f docker-compose.prod.yml
DEV_ENV      = envs/.dev.env
PROD_ENV     = envs/.prod.env

# Сервер
PROD_SERVER  = bekzhan@77.42.43.153
PROD_DIR     = /home/bekzhan/goszakup-ai

help: ## Показать команды
	@echo ""
	@echo "$(GREEN)GoszakupAI$(NC) — команды Makefile"
	@echo ""
	@echo "$(CYAN)━━━━━ Локальная разработка ━━━━━━━━━━━━━━━━━━━━━━━$(NC)"
	@grep -E '^(start|stop|logs|health|ps|clean|dev-)[a-zA-Z_-]+:.*?##' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(CYAN)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)━━━━━ Продакшен ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(NC)"
	@grep -E '^(prod|deploy)[a-zA-Z_-]*:.*?##' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""

# ══════════════════════════════════════════════════
#  ЛОКАЛЬНАЯ РАЗРАБОТКА (DEV)
# ══════════════════════════════════════════════════

start: ## 🟢 Собрать и запустить локально (API:8008, Frontend:3000)
	@echo "$(GREEN)▶ Запуск DEV окружения...$(NC)"
	@set -a && . ./$(DEV_ENV) && set +a && \
		docker-compose -f $(DEV_COMPOSE) build && \
		docker-compose -f $(DEV_COMPOSE) up -d
	@echo "$(GREEN)✓ Готово!$(NC)"
	@echo "  Frontend : http://localhost:3000"
	@echo "  API      : http://localhost:8008"
	@echo "  Логи     : make logs"

stop: ## 🔴 Остановить локальные сервисы
	@echo "$(GREEN)Остановка DEV сервисов...$(NC)"
	@docker-compose -f $(DEV_COMPOSE) down

logs: ## Логи всех сервисов (DEV)
	@docker-compose -f $(DEV_COMPOSE) logs -f

logs-api: ## Логи API (DEV)
	@docker-compose -f $(DEV_COMPOSE) logs -f api

logs-front: ## Логи Frontend (DEV)
	@docker-compose -f $(DEV_COMPOSE) logs -f frontend

ps: ## Статус контейнеров (DEV)
	@docker-compose -f $(DEV_COMPOSE) ps

health: ## Проверить доступность сервисов (DEV)
	@echo "$(GREEN)API healthcheck...$(NC)"
	@curl -sf http://localhost:8008/health && echo " ✓ API online" || echo " ✗ API недоступен"
	@echo "$(GREEN)Frontend...$(NC)"
	@curl -sf -o /dev/null http://localhost:3000 && echo " ✓ Frontend online" || echo " ✗ Frontend недоступен"

clean: ## Удалить все DEV контейнеры и volumes
	@echo "$(GREEN)Очистка DEV ресурсов...$(NC)"
	@docker-compose -f $(DEV_COMPOSE) down -v
	@docker system prune -f

# ─── Локальный запуск без Docker ────────────────────────

dev-setup: ## Создать venv311 для разработки
	@echo "$(GREEN)Создание venv311...$(NC)"
	python3.11 -m venv .venv311
	@echo "  source .venv311/bin/activate  → затем: make dev-install"

dev-install: ## Установить зависимости (активируй venv311 сначала)
	pip install -U pip && pip install -r requirements.txt
	cd frontend && npm install

dev-backend: ## Запустить FastAPI локально (без Docker)
	@set -a && . ./$(DEV_ENV) && set +a && \
		uvicorn src.api.routes:app --reload --host 0.0.0.0 --port 8008

dev-frontend: ## Запустить Vite dev server (без Docker)
	cd frontend && npm run dev

# ══════════════════════════════════════════════════
#  ПРОДАКШЕН (PROD)  — сервер bekzhan@77.42.43.153
# ══════════════════════════════════════════════════

prod: ## 🚀 Собрать и запустить PROD на этом хосте (API:8009, Frontend:8080)
	@echo "$(YELLOW)▶ Запуск PROD окружения...$(NC)"
	@set -a && . ./$(PROD_ENV) && set +a && \
		docker-compose -f $(PROD_COMPOSE) build && \
		docker-compose -f $(PROD_COMPOSE) up -d
	@echo "$(YELLOW)✓ PROD запущен!$(NC)"
	@echo "  Frontend : http://$(shell hostname -I | awk '{print $$1}'):$${FRONTEND_PORT:-8080}"
	@echo "  Логи     : make prod-logs"

prod-down: ## Остановить PROD сервисы
	@echo "$(YELLOW)Остановка PROD...$(NC)"
	@set -a && . ./$(PROD_ENV) && set +a && \
		docker-compose -f $(PROD_COMPOSE) down

prod-logs: ## Логи PROD сервисов
	@docker-compose -f $(PROD_COMPOSE) logs -f

prod-restart: ## Перезапустить PROD сервисы
	@set -a && . ./$(PROD_ENV) && set +a && \
		docker-compose -f $(PROD_COMPOSE) restart

prod-ps: ## Статус PROD контейнеров
	@docker-compose -f $(PROD_COMPOSE) ps

prod-health: ## Проверить PROD (запускай на сервере)
	@curl -sf http://localhost:8009/health && echo " ✓ API online" || echo " ✗ API недоступен"
	@curl -sf -o /dev/null http://localhost:8080 && echo " ✓ Frontend online" || echo " ✗ Frontend недоступен"

deploy: ## 📦 Задеплоить на сервер $(PROD_SERVER) через git pull + make prod
	@echo "$(YELLOW)▶ Деплой на $(PROD_SERVER)...$(NC)"
	@ssh $(PROD_SERVER) '\
		set -e; \
		if [ ! -d $(PROD_DIR) ]; then \
			echo "→ Первый деплой: клонируем репозиторий..."; \
			git clone https://github.com/ekbmusk/goszakup-ai.git $(PROD_DIR); \
		fi; \
		cd $(PROD_DIR); \
		echo "→ git pull..."; \
		git pull origin main; \
		echo "→ make prod..."; \
		make prod; \
	'
	@echo "$(YELLOW)✓ Деплой завершён!$(NC)"
	@echo "  Открой: http://77.42.43.153:8080"

deploy-first: ## 🔑 Первый деплой: скопировать SSH ключ на сервер
	@echo "$(YELLOW)Копируем SSH ключ на $(PROD_SERVER)...$(NC)"
	ssh-copy-id $(PROD_SERVER)
	@echo "✓ Теперь можно запускать: make deploy"

.DEFAULT_GOAL := help
