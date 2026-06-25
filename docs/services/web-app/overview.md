# Service Overview — IFVM Web App

**Owner :** Équipe IFVM  
**Dernière mise à jour :** 2026-06-25  
**Statut :** En développement

## Identité du service

| Champ | Valeur |
|-------|--------|
| **Nom** | IFVM Web App |
| **Répertoire** | `frontend/` |
| **Plateforme** | Navigateur web (desktop) |
| **Stack** | React 19 + TypeScript + Vite + Tailwind CSS |
| **Port dev** | `5173` (Vite) |

## Description

Interface web de supervision et de validation des données de terrain de l'IFVM. Contrairement à l'app mobile (saisie offline sur le terrain), le frontend web est destiné aux équipes de bureau : vérificateurs, valideurs, administrateurs. Il offre la liste des fiches soumises, la consultation du détail, et les actions de validation (vérifier / valider / rejeter).

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     IFVM Web App                        │
├─────────────────────────────────────────────────────────┤
│  React Router v7 (createBrowserRouter)                  │
│  ├── /login              → LoginPage                    │
│  ├── /                   → DashboardPage                │
│  ├── /campagnes          → CampagnesPage                │
│  ├── /prospections       → ProspectionsPage (liste)     │
│  ├── /prospections/new   → NouvelleProspectionPage      │
│  └── /prospections/:id   → ProspectionDetailPage ★      │
├─────────────────────────────────────────────────────────┤
│  TanStack Query v5 (React Query)                        │
│  └── Pas de store global — data fetching par page       │
├─────────────────────────────────────────────────────────┤
│  shadcn/ui (Base UI + Tailwind CSS)                     │
│  Composants : button, card, dialog, table, textarea…    │
└─────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│  Backend API (FastAPI)                                  │
│  POST /auth/login           → JWT                       │
│  GET  /prospections         → Liste fiches              │
│  GET  /prospections/:id     → Détail fiche              │
│  GET  /prospections/:id/audit-log → Historique          │
│  PATCH /prospections/:id/statut   → Action workflow     │
│  GET  /referentiel/stations/:id   → Détail station      │
└─────────────────────────────────────────────────────────┘
```

★ Page de workflow de validation — voir [Workflow de validation](#workflow-de-validation).

## Pages

| Route | Description | Rôles |
|-------|-------------|-------|
| `/login` | Authentification JWT | Tous |
| `/` | Dashboard (stats globales) | Tous |
| `/campagnes` | Gestion des campagnes | Admin |
| `/prospections` | Liste filtrée des fiches intensives | Tous |
| `/prospections/new` | Formulaire de saisie en 4 étapes | Prospecteur |
| `/prospections/:id` | Détail + audit log + actions validation | Vérificateur, Validation finale |

## Workflow de validation

La page `/prospections/:id` est le point d'entrée principal du workflow de supervision :

```
Statut fiche      Rôle requis         Action disponible
─────────────────────────────────────────────────────────
en_attente   +   verificateur       → Bouton « Vérifier »
verifiee     +   validation_finale  → Boutons « Valider » / « Rejeter »
```

- **Vérifier** : transition vers `verifiee` (confirmation simple)
- **Valider** : transition vers `validee` (confirmation simple)
- **Rejeter** : transition vers `rejetee` (commentaire obligatoire)

Chaque action enregistre une entrée dans `audit_log` (côté backend).

## Authentification

- JWT stocké dans `localStorage` (`access_token`)
- Intercepteur Axios : injecte le header `Authorization: Bearer <token>` sur tous les appels
- Déconnexion automatique si 401 → redirection vers `/login`
- Rôle de l'utilisateur connecté : `GET /users/me` (React Query, mis en cache par page)

## Conventions de code

| Convention | Détail |
|------------|--------|
| Data fetching | TanStack Query — pas de store Zustand côté web |
| Composants | Un fichier par page dans `src/pages/`, composants partagés dans `src/components/` |
| Types | Définis localement par page (interfaces inline) |
| Styles | Tailwind CSS via classes, `cn()` pour les classes conditionnelles |
| Path alias | `@/` → `src/` (configuré dans `tsconfig.json` et `vite.config.ts`) |

## Commandes essentielles

```bash
# Démarrer le serveur de développement
cd frontend && npm run dev

# Vérification TypeScript
cd frontend && npx tsc --noEmit

# Build production
cd frontend && npm run build

# Lint
cd frontend && npm run lint
```

## Configuration

| Fichier | Rôle |
|---------|------|
| `vite.config.ts` | Build Vite, alias `@/`, proxy `/api → localhost:8000` |
| `tsconfig.json` | TypeScript strict |
| `tailwind.config.js` | Thème Tailwind (light uniquement pour l'instant) |
| `src/api/client.ts` | Instance Axios avec intercepteurs auth |
| `src/router.tsx` | Définition de toutes les routes |

## Relations avec autres services

| Service | Relation | Protocole |
|---------|----------|-----------|
| Backend API (FastAPI) | Consommateur | HTTP REST (proxy Vite en dev, Nginx en prod) |
| IFVM Mobile | Producteur de données | Synchronisation via backend |

## Plan d'évolution

| Feature | Statut | Description |
|---------|--------|-------------|
| Auth + routing | ✅ Terminé | JWT, ProtectedRoute, createBrowserRouter |
| Liste prospections | ✅ Terminé | Filtres, pagination, statut |
| Formulaire saisie | ✅ Terminé | 4 étapes, validation Zod, draft localStorage |
| Page détail + audit | ✅ Terminé | Détail fiche, audit log, actions workflow |
| Dashboard stats | 🔄 En cours | Métriques globales par campagne |
| Gestion utilisateurs | ⏳ À faire | Admin : créer / désactiver comptes |
| Export données | ⏳ À faire | CSV / Excel des fiches validées |

## Voir aussi

- [ADR-005](../../adr/ADR-005-frontend-ui.md) — Choix shadcn/ui
- [ADR-006](../../adr/ADR-006-prospection-unifiee.md) — Modèle de données prospection
- [Flux intensif](../../flux-intensif.md) — Workflow complet prospection intensive
