Status: ready-for-agent

## What to build

Créer un module API client HTTP dans le projet mobile qui communique avec le backend FastAPI existant. Le client utilise le `fetch` natif, attaque automatiquement le header `Authorization: Bearer <token>` sur chaque requête authentifiée, gère les réponses 401 en déclenchant un callback de redirection vers l'écran de login, et lit la base URL depuis `EXPO_PUBLIC_API_URL`. Les endpoints réutilisés sont ceux du web : `POST /auth/login`, `GET /geo/postes`, `GET /geo/stations`, `GET /users/me`.

## Acceptance criteria

- [ ] Le client API envoie le header `Authorization: Bearer <token>` sur les routes protégées
- [ ] Les réponses 401 déclenchent un callback fourni (pour redirection vers login)
- [ ] La base URL est configurable via `EXPO_PUBLIC_API_URL` (défaut : `http://localhost:8000`)
- [ ] Le client expose des fonctions pour les endpoints : login, getPostes, getStations, getProfile
- [ ] Des tests unitaires mockent `fetch` et vérifient le header Authorization et le comportement 401
- [ ] Le client ne dépend d'aucune librairie tierce (fetch natif uniquement)

## Blocked by

- 01-scaffolding-expo (a besoin du projet Expo installé)
