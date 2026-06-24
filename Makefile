COMPOSE = docker compose

.PHONY: up down build logs migrate seed shell-db shell-backend

up:
	$(COMPOSE) up --build

down:
	$(COMPOSE) down

build:
	$(COMPOSE) build

logs:
	$(COMPOSE) logs -f

# Générer une nouvelle migration après modification des modèles SQLAlchemy
migrate:
	$(COMPOSE) exec backend alembic revision --autogenerate -m "$(msg)"

# Appliquer toutes les migrations en attente
upgrade:
	$(COMPOSE) exec backend alembic upgrade head

# Revenir à la migration précédente
downgrade:
	$(COMPOSE) exec backend alembic downgrade -1

# Insérer les données de référence
seed:
	$(COMPOSE) exec backend python -m app.seed

# Accéder à psql
shell-db:
	$(COMPOSE) exec db psql -U ifvm -d ifvm_db

# Accéder au shell du backend
shell-backend:
	$(COMPOSE) exec backend bash

# --- Infra ---
TF = terraform -C infra

tf-init:
	$(TF) init

tf-plan:
	$(TF) plan

tf-apply:
	$(TF) apply -auto-approve

tf-destroy:
	$(TF) destroy -auto-approve

tf-output:
	$(TF) output

# Déployer sur la VPS (SSH direct)
deploy:
	ssh root@$$(make tf-output | grep server_ip | awk '{print $$3}') "cd /opt/app && git pull && docker compose -f docker-compose.prod.yml up -d --build"
