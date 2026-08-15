COMPOSE = docker compose

.PHONY: up down build logs migrate makemigrations seed shell-db shell-backend lint format

up:
	$(COMPOSE) up -d

down:
	$(COMPOSE) down

build:
	$(COMPOSE) build

logs:
	$(COMPOSE) logs -f

makemigrations:
	$(COMPOSE) exec backend alembic revision --autogenerate -m "$(msg)"

migrate:
	$(COMPOSE) exec backend alembic upgrade head

downgrade:
	$(COMPOSE) exec backend alembic downgrade -1

seed:
	$(COMPOSE) exec backend python -m app.seed

shell-db:
	$(COMPOSE) exec db psql -U ifvm -d ifvm_db

shell-backend:
	$(COMPOSE) exec backend bash

lint:
	$(MAKE) -C mobile lint

format:
	$(MAKE) -C mobile format

# --- Infra Contabo (principal) ---
TF_CONTABO = terraform -chdir=infra/contabo

tf-init:
	$(TF_CONTABO) init

tf-plan:
	$(TF_CONTABO) plan

tf-apply:
	$(TF_CONTABO) apply -auto-approve

tf-destroy:
	$(TF_CONTABO) destroy -auto-approve

tf-output:
	$(TF_CONTABO) output

tf-fmt:
	terraform -chdir=infra fmt -recursive

# Déployer sur la VPS (SSH direct)
deploy:
	ssh root@$$(make tf-output | grep instance_ip | awk '{print $$3}') "cd /opt/app && git pull && docker compose -f docker-compose.prod.yml --env-file .env up -d --build"
