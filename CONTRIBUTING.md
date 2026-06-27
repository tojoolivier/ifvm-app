# Guide de contribution — IFVM

Ce document couvre tout ce qu'il faut savoir pour contribuer au projet : setup local, conventions de code, gestion des tickets et processus de PR.

---

## Table des matières

1. [Prérequis](#prérequis)
2. [Setup local](#setup-local)
3. [Structure du projet](#structure-du-projet)
4. [Workflow de développement](#workflow-de-développement)
5. [Conventions de code](#conventions-de-code)
6. [Migrations de base de données](#migrations-de-base-de-données)
7. [Design system](#design-system)
8. [Gestion des tickets](#gestion-des-tickets)
9. [Commits et branches](#commits-et-branches)
10. [Soumettre une PR](#soumettre-une-pr)

---

## Prérequis

| Outil | Version minimale |
|-------|-----------------|
| Docker | ≥ 24 |
| Docker Compose | ≥ 2 (inclus dans Docker Desktop) |
| Node.js | ≥ 20 (pour mobile / lint frontend) |
| `make` | pré-installé sur macOS/Linux |

---

## Setup local

```bash
# 1. Copier la configuration d'environnement
cp .env.example .env

# 2. Démarrer tous les services (build + migrations + hot-reload)
make up

# 3. Insérer les données de référence (dans un autre terminal)
make seed
```

Les services sont disponibles sur :

| Service  | URL                        |
|----------|----------------------------|
| API      | http://localhost:8000/docs |
| Frontend | http://localhost:5173      |
| Base     | localhost:5432             |

Compte admin par défaut : `admin@ifvm.mg` / `ifvm2026!`

---

## Structure du projet

```
backend/          FastAPI + SQLAlchemy 2 + Alembic
frontend/         React 18 + TypeScript + Vite + Tailwind + shadcn/ui
mobile/           React Native (Expo SDK 56) + NativeWind
docs/
  adr/            Décisions d'architecture (ADR-001 à ADR-006)
  services/       Runbooks et overviews de services
.scratch/         Tickets et PRDs locaux (pas de tracker distant)
```

---

## Workflow de développement

Le hot-reload est actif pour le backend (`backend/app/`) et le frontend (`frontend/src/`) via les volumes Docker. Pas de rebuild nécessaire lors d'une modification de code.

Pour le mobile :

```bash
cd mobile
npm start          # Serveur Expo (Metro bundler)
npx tsc --noEmit   # Vérification TypeScript
```

---

## Conventions de code

### Backend (Python / FastAPI)

- Python 3.11+, typage strict avec `from __future__ import annotations`
- Modèles dans `backend/app/models/`, schémas Pydantic v2 dans `backend/app/schemas/`
- Un fichier par domaine métier dans `backend/app/routers/`
- Pas de logique métier dans les routers — déléguer à des fonctions de service

### Frontend (React / TypeScript)

- TypeScript strict (pas de `any` implicite)
- Composants dans `frontend/src/components/`, pages dans `frontend/src/pages/`
- Client HTTP centralisé dans `frontend/src/api/client.ts` (Axios + Bearer token auto)
- UI via shadcn/ui — ne pas créer de composants ad hoc quand un composant shadcn existe

### Mobile (React Native / Expo)

- Navigation file-based via Expo Router dans `mobile/src/app/`
- Styles via NativeWind v4 (classes Tailwind)
- Variable d'environnement `EXPO_PUBLIC_API_URL` pour l'URL de l'API

---

## Migrations de base de données

Toute modification de schéma passe par Alembic :

```bash
# 1. Modifier un modèle dans backend/app/models/
# 2. Générer la migration
make migrate msg="description_courte_en_snake_case"

# 3. Vérifier le fichier généré dans backend/alembic/versions/
# 4. Appliquer
make upgrade
```

> Les migrations sont appliquées automatiquement au prochain `make up`.  
> Ne jamais modifier manuellement la base — passer toujours par Alembic.

---

## Design system

Après chaque modification frontend (nouveau composant, changement de style, token de design) :

```bash
npx @google/design.md lint DESIGN.md
```

Corriger tous les avertissements avant de considérer la tâche terminée.

---

## Gestion des tickets

Les issues et PRDs sont des fichiers markdown locaux sous `.scratch/` — pas de tracker distant.

```
.scratch/<feature-slug>/
  PRD.md
  issues/
    01-<slug>.md
    02-<slug>.md
```

Chaque fichier d'issue contient une ligne `Status:` en haut avec l'un des labels :

| Label | Signification |
|-------|--------------|
| `needs-triage` | À analyser |
| `needs-info` | Bloqué, informations manquantes |
| `ready-for-agent` | Peut être traité par un agent IA |
| `ready-for-human` | Nécessite une décision humaine |
| `wontfix` | Ne sera pas traité |

Pour les détails complets : `docs/agents/issue-tracker.md` et `docs/agents/triage-labels.md`.

---

## Commits et branches

**Format de commit** (Conventional Commits) :

```
<type>(<scope>): <description courte>

[corps optionnel]
```

Types courants : `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `infra`

Exemples :

```
feat(prospection): ajouter le formulaire intensif mobile
fix(auth): corriger l'expiration silencieuse du token JWT
docs(adr): ADR-007 stratégie de cache offline
```

**Branches** :

```
main           branche de production
feat/<slug>    nouvelle fonctionnalité
fix/<slug>     correction de bug
```

---

## Soumettre une PR

1. Créer une branche depuis `main`
2. Faire des commits atomiques et bien nommés
3. S'assurer que le projet démarre sans erreur (`make up`)
4. Si frontend modifié : passer `npx @google/design.md lint DESIGN.md` au vert
5. Si schéma modifié : inclure la migration Alembic dans la PR
6. Ouvrir la PR avec un titre au format Conventional Commits et une description qui explique le **pourquoi** du changement

> Pour les décisions d'architecture significatives, créer un ADR dans `docs/adr/` avant d'implémenter.
