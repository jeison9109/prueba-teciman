# Atajos para los comandos documentados en el README. Cada objetivo muestra la orden real.
COMPOSE := docker compose
BACKEND := cd backend &&
FRONTEND := cd frontend &&

.PHONY: help up down logs migrate seed walkthrough install \
	backend-lint backend-format backend-typecheck backend-test \
	frontend-lint frontend-typecheck frontend-test frontend-build \
	check verify

help:
	@grep -E '^[a-z-]+:' Makefile | cut -d: -f1 | sort

# --- Docker Compose ---
up:
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f

migrate:
	$(COMPOSE) exec backend alembic upgrade head

# Carga idempotente de datos de demostración (se puede repetir sin duplicar).
seed:
	$(COMPOSE) exec backend python -m scripts.seed_demo

# --- Dependencias locales ---
install:
	$(BACKEND) uv sync
	$(FRONTEND) npm ci

# --- Backend ---
backend-lint:
	$(BACKEND) uv run ruff check . && uv run ruff format --check .

backend-format:
	$(BACKEND) uv run ruff format . && uv run ruff check --fix .

backend-typecheck:
	$(BACKEND) uv run mypy

# Requiere un PostgreSQL accesible en TEST_DATABASE_URL o DATABASE_URL (p. ej. `make up`).
backend-test:
	$(BACKEND) uv run pytest

# --- Frontend ---
frontend-lint:
	$(FRONTEND) npm run lint

frontend-typecheck:
	$(FRONTEND) npm run typecheck

frontend-test:
	$(FRONTEND) npm test

frontend-build:
	$(FRONTEND) npm run build

# --- Verificación ---
check: backend-lint backend-typecheck backend-test frontend-lint frontend-typecheck frontend-test frontend-build

verify:
	scripts/verify-stack.sh
