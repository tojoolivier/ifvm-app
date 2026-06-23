# ADR-001 — Stack technique

**Statut :** Accepté  
**Date :** 2026-06-23

## Contexte

Application de collecte de données terrain (criquets, météo, traitements) pour l'IFVM Madagascar. Les agents opèrent sur le terrain avec une tablette, parfois sans connexion. Un bureau central analyse et valide les données via navigateur web.

## Décision

### Base de données

| Composant | Choix | Alternative écartée |
|-----------|-------|---------------------|
| Serveur central | **PostgreSQL 16** | MySQL — moins bon support des UUID, JSON, contraintes avancées |
| Local tablette | **SQLite** (Expo SQLite) | IndexedDB (PWA) — pas de requêtes SQL complexes, pas de transactions fiables |

PostgreSQL est retenu pour ses contraintes `CHECK`, ses types `UUID`, `DECIMAL`, `TIMESTAMPTZ`, et sa capacité future à intégrer PostGIS (coordonnées GPS des zones de traitement).

SQLite sur tablette reproduit le même schéma (avec adaptations mineures de types) pour permettre une sync structurée ligne par ligne.

### Backend

**FastAPI (Python 3.12)**

- Génération automatique OpenAPI → contrat d'API partagé avec le frontend
- Performance async native pour les endpoints de sync (upload batch de fiches)
- Ecosystème Python cohérent avec les futurs besoins d'analyse (pandas, geopandas)
- SQLAlchemy 2.0 (ORM async) + Alembic (migrations)

### Frontend web

**React 18 + TypeScript + Vite**

- Composants de formulaire réutilisables entre web et mobile (logique partagée)
- React Query pour la gestion du cache et des états de synchronisation
- Tanstack Table pour les tableaux de données terrain

### Application mobile

Voir `docs/adr/ADR-003-mobile.md` → **React Native (Expo)**

## Conséquences

- Un seul langage côté frontend (TypeScript) réduit la fragmentation
- Le schéma SQLite doit être maintenu en parallèle du schéma PostgreSQL (Alembic côté serveur, migrations manuelles côté SQLite via Expo)
- L'API FastAPI devient le point unique de vérité pour la logique de validation métier
