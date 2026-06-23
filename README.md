# IFVM — Système de gestion acridienne

Digitalisation des fiches terrain de l'**IFVM** (Ivotoerana Famongorana ny Valala eto Madagasikara), centre national de lutte antiacridienne de Madagascar.

## Prérequis

- [Docker](https://docs.docker.com/get-docker/) ≥ 24
- [Docker Compose](https://docs.docker.com/compose/) ≥ 2 (inclus dans Docker Desktop)
- `make` (pré-installé sur macOS/Linux)

## Démarrage rapide

```bash
# 1. Copier la configuration
cp .env.example .env

# 2. Démarrer tous les services (build + migrations + hot-reload)
make up

# 3. Dans un autre terminal : insérer les données de référence
make seed
```

| Service  | URL                           | Description                  |
|----------|-------------------------------|------------------------------|
| API      | http://localhost:8000/docs    | Swagger UI (FastAPI)         |
| Frontend | http://localhost:5173         | Interface web (React)        |
| Base     | localhost:5432                | PostgreSQL 16                |

**Compte admin par défaut** : `admin@ifvm.mg` / `ifvm2026!`  
> Changer ce mot de passe après la première connexion.

---

## Architecture

```
.
├── backend/               FastAPI + SQLAlchemy 2.0 + Alembic
│   ├── app/
│   │   ├── main.py        Point d'entrée, CORS, routes
│   │   ├── auth.py        JWT (python-jose) + bcrypt
│   │   ├── config.py      Variables d'environnement (pydantic-settings)
│   │   ├── database.py    Moteur async SQLAlchemy
│   │   ├── models/        Modèles ORM (geo, users, meteo, prospection, traitement, vol)
│   │   ├── schemas/       Schémas Pydantic v2 (validation entrée/sortie)
│   │   ├── routers/       Routes par domaine métier
│   │   └── seed.py        Données de référence initiales
│   └── alembic/
│       └── versions/
│           └── 0001_initial.py   Migration initiale (toutes les tables)
├── frontend/              React 18 + TypeScript + Vite + Tailwind
│   └── src/
│       ├── api/client.ts  Axios avec Bearer token automatique
│       ├── components/    Layout, ProtectedRoute
│       ├── pages/         Login, Dashboard (+ stubs par fiche)
│       └── router.tsx     Routes protégées
├── data/sql/
│   └── schema.sql         DDL PostgreSQL de référence (documentation)
├── docs/
│   ├── adr/               Décisions d'architecture (ADR-001 à ADR-003)
│   └── *.md               Fiches terrain numérisées
├── docker-compose.yml
├── Makefile
└── CONTEXT.md             Glossaire métier et modèle de données
```

---

## Commandes utiles

```bash
make up            # Démarrer (build + alembic upgrade head + hot-reload)
make down          # Arrêter les conteneurs
make logs          # Suivre les logs en temps réel
make seed          # Insérer les données de référence

# Migrations
make migrate msg="ajouter_table_xxx"   # Générer une migration depuis les modèles
make upgrade                           # Appliquer les migrations en attente
make downgrade                         # Revenir à la migration précédente

# Shells
make shell-db       # psql dans la base
make shell-backend  # bash dans le conteneur backend
```

### Ajouter une migration

1. Modifier un modèle dans `backend/app/models/`
2. Lancer `make migrate msg="description_courte"`
3. Vérifier le fichier généré dans `backend/alembic/versions/`
4. Le changement est appliqué automatiquement au prochain `make up`

---

## Variables d'environnement

| Variable          | Défaut                             | Description                |
|-------------------|------------------------------------|----------------------------|
| `POSTGRES_DB`     | `ifvm_db`                          | Nom de la base             |
| `POSTGRES_USER`   | `ifvm`                             | Utilisateur PostgreSQL     |
| `POSTGRES_PASSWORD` | `ifvm_secret`                    | Mot de passe PostgreSQL    |
| `JWT_SECRET`      | `change_me_in_production_…`        | Clé de signature JWT       |
| `JWT_EXPIRE_MINUTES` | `60`                            | Durée de validité du token |

---

## Modèle de données

Cinq types de fiches terrain :

| Fiche | Endpoint API | Statut MVP |
|-------|-------------|------------|
| Prospection extensive | `GET/POST /prospection/extensive` | stub |
| Prospection intensive | `GET/POST /prospection/intensive` | stub |
| Relevé météo | `GET/POST /meteo/releves` | stub |
| Compte-rendu de traitement (CRT) | `GET/POST /traitement/crt` | stub |
| Fiche de vol | `GET/POST /vol/` | stub |

> Voir `CONTEXT.md` et `docs/adr/` pour le détail du domaine et les décisions d'architecture.

---

## Développement

Le backend et le frontend ont tous deux le hot-reload activé via les volumes Docker.  
Toute modification de `backend/app/` ou `frontend/src/` se reflète immédiatement sans rebuild.
