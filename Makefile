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
