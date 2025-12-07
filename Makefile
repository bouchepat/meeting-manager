# Meeting Manager - Docker Management
.PHONY: help up down logs restart clean rebuild dev prod backup restore

help: ## Show this help message
	@echo "Meeting Manager - Available Commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

up: ## Start all services in development mode
	docker-compose up

dev: ## Start all services in detached mode (development)
	docker-compose up -d

down: ## Stop all services
	docker-compose down

logs: ## View logs from all services
	docker-compose logs -f

logs-backend: ## View backend logs only
	docker-compose logs -f backend

logs-frontend: ## View frontend logs only
	docker-compose logs -f frontend

logs-db: ## View database logs only
	docker-compose logs -f mysql

restart: ## Restart all services
	docker-compose restart

restart-backend: ## Restart backend service only
	docker-compose restart backend

restart-frontend: ## Restart frontend service only
	docker-compose restart frontend

status: ## Show status of all services
	docker-compose ps

clean: ## Stop and remove all containers, networks, and volumes
	docker-compose down -v
	@echo "⚠️  All data has been removed!"

rebuild: ## Rebuild all containers
	docker-compose build
	docker-compose up -d

rebuild-backend: ## Rebuild backend container only
	docker-compose build backend
	docker-compose up -d backend

rebuild-frontend: ## Rebuild frontend container only
	docker-compose build frontend
	docker-compose up -d frontend

shell-backend: ## Open shell in backend container
	docker-compose exec backend sh

shell-frontend: ## Open shell in frontend container
	docker-compose exec frontend sh

shell-db: ## Open MySQL shell
	docker-compose exec mysql mysql -u meetinguser -pmeetingpass meeting_manager

prod: ## Start services in production mode
	docker-compose -f docker-compose.prod.yml up -d

prod-down: ## Stop production services
	docker-compose -f docker-compose.prod.yml down

backup: ## Create database backup
	@mkdir -p backups
	docker-compose exec mysql mysqldump -u meetinguser -pmeetingpass meeting_manager > backups/backup-$$(date +%Y%m%d-%H%M%S).sql
	@echo "✅ Backup created in backups/ directory"

restore: ## Restore database from latest backup (use FILE=path/to/backup.sql to specify)
	@if [ -z "$(FILE)" ]; then \
		echo "❌ Please specify backup file: make restore FILE=backups/backup-20240101-120000.sql"; \
	else \
		docker-compose exec -T mysql mysql -u meetinguser -pmeetingpass meeting_manager < $(FILE); \
		echo "✅ Database restored from $(FILE)"; \
	fi

install: ## Install dependencies in containers
	docker-compose exec backend npm install
	docker-compose exec frontend npm install

test-backend: ## Run backend tests
	docker-compose exec backend npm test

test-frontend: ## Run frontend tests
	docker-compose exec frontend npm test

prune: ## Remove all unused Docker resources
	docker system prune -a --volumes
	@echo "⚠️  All unused Docker resources have been removed!"
