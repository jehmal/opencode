# OpenCode-DGM Monorepo Makefile

.PHONY: help setup install clean build test lint format dev ci docker-dev docker-stop docker-rebuild health-check env

# Default target
help:
	@echo "OpenCode-DGM Monorepo Commands:"
	@echo ""
	@echo "Setup & Installation:"
	@echo "  make setup         - Initial setup of the monorepo"
	@echo "  make install       - Install all dependencies"
	@echo "  make env           - Copy .env.example to .env"
	@echo ""
	@echo "Development:"
	@echo "  make dev           - Start development servers"
	@echo "  make docker-dev    - Start Docker development environment"
	@echo "  make docker-stop   - Stop Docker development environment"
	@echo "  make docker-rebuild - Rebuild Docker services"
	@echo "  make health-check  - Check service health"
	@echo ""
	@echo "Code Quality:"
	@echo "  make test          - Run all tests"
	@echo "  make lint          - Lint all code"
	@echo "  make format        - Format all code"
	@echo "  make check-types   - Type check all code"
	@echo ""
	@echo "Build & Clean:"
	@echo "  make build         - Build all workspaces"
	@echo "  make clean         - Clean all build artifacts"
	@echo "  make ci            - Run CI pipeline"

# Setup
setup:
	@bash scripts/setup.sh

# Install dependencies
install:
	bun install
	cd dgm && poetry install

# Clean
clean:
	rm -rf node_modules **/node_modules
	rm -rf **/dist **/build **/.turbo
	rm -rf **/__pycache__ **/.pytest_cache
	rm -rf coverage htmlcov .coverage
	find . -name "*.pyc" -delete
	find . -name "*.pyo" -delete
	find . -name ".DS_Store" -delete

# Build
build: build-ts build-py

build-ts:
	bun run build:ts

build-py:
	cd dgm && poetry build

# Test
test: test-ts test-py

test-ts:
	bun run test:ts

test-py:
	cd dgm && poetry run pytest

# Integration tests
test-integration:
	@bash scripts/run-integration-tests.sh

test-integration-verbose:
	@bash scripts/run-integration-tests.sh --verbose

test-integration-coverage:
	@bash scripts/run-integration-tests.sh --coverage

test-perf:
	@bash scripts/run-integration-tests.sh --perf

test-quick:
	@bash scripts/run-integration-tests.sh --quick

# Lint
lint: lint-ts lint-py

lint-ts:
	bun run lint:ts

lint-py:
	cd dgm && poetry run ruff check .

# Format
format: format-ts format-py

format-ts:
	bun run format:ts

format-py:
	cd dgm && poetry run black . && poetry run isort .

# Development
dev:
	bun run dev

dev-opencode:
	bun run dev:opencode

dev-dgm:
	bun run dev:dgm

# CI Pipeline
ci: install lint test build
	@echo "✅ CI pipeline completed successfully"

# Docker commands
docker-build:
	docker-compose build

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f

# Utility commands
check-types:
	bun run typecheck
	cd dgm && poetry run mypy .

check-deps:
	@echo "Checking for dependency updates..."
	@cd opencode && bun outdated || true
	@cd dgm && poetry show --outdated || true

update-deps:
	@echo "Updating dependencies..."
	@bun update
	@cd dgm && poetry update

# Release commands
version-patch:
	@npm version patch

version-minor:
	@npm version minor

version-major:
	@npm version major

# Development environment commands
env:
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "✅ Created .env file from .env.example"; \
		echo "⚠️  Please update .env with your API keys and settings"; \
	else \
		echo "✅ .env file already exists"; \
	fi

docker-dev:
	@echo "Starting Docker development environment..."
	@docker-compose -f docker-compose.dev.yml up -d
	@echo "✅ Development environment started"
	@echo "Services available at:"
	@echo "  - OpenCode: http://localhost:3000"
	@echo "  - DGM API: http://localhost:8000"
	@echo "  - Adminer: http://localhost:8080"
	@echo "  - Redis Commander: http://localhost:8081"

docker-stop:
	@echo "Stopping Docker development environment..."
	@docker-compose -f docker-compose.dev.yml down
	@echo "✅ Development environment stopped"

docker-rebuild:
	@echo "Rebuilding Docker services..."
	@docker-compose -f docker-compose.dev.yml build --no-cache
	@echo "✅ Services rebuilt"

docker-logs:
	@docker-compose -f docker-compose.dev.yml logs -f

docker-shell-opencode:
	@docker-compose -f docker-compose.dev.yml exec opencode /bin/bash

docker-shell-dgm:
	@docker-compose -f docker-compose.dev.yml exec dgm /bin/bash

health-check:
	@bash scripts/health-check.sh

# Development shortcuts
dev-install:
	@make env
	@make install
	@echo "✅ Development dependencies installed"

dev-reset:
	@echo "⚠️  This will reset your development environment. Continue? [y/N]"
	@read ans && [ $${ans:-N} = y ]
	@make docker-stop
	@make clean
	@docker-compose -f docker-compose.dev.yml down -v
	@echo "✅ Development environment reset"