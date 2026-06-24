# PRD — Initialisation de l'application mobile IFVM (Android)

**Status:** ready-for-agent
**Date:** 2026-06-24

## Problem Statement

Les agents de terrain IFVM utilisent des tablettes Android pour collecter des données acridiennes (prospection, météo, traitement, vol). Aujourd'hui, cette collecte se fait sur papier ou via un frontend web qui nécessite une connexion internet constante — impossible en condition terrain (pas de réseau). Il faut une application mobile native Android qui fonctionne hors-ligne, avec stockage local SQLite et synchronisation différée vers le serveur PostgreSQL.

Pour l'instant, seules des décisions architecturales ont été prises (ADR-001, ADR-002, ADR-003) : React Native (Expo), sync ownership-based, monorepo futur. Aucun code mobile n'existe. Cette PRD couvre l'initialisation du projet mobile et la mise en place des premiers écrans fonctionnels (login + dashboard).

## Solution

Créer un projet React Native (Expo) dans `mobile/` à la racine du repo, en utilisant le template `tabs` (Expo Router) pour démarrer rapidement. L'application communique avec le backend FastAPI existant via une couche API client (fetch natif). L'authentification utilise `expo-secure-store` pour la persistance du JWT et Zustand pour le state runtime. Les premiers écrans implémentés sont le login et le dashboard, validant le flow complet : ouverture → connexion → affichage des données du poste acridien.

## User Stories

### Authentification
1. As an IFVM agent, I want to enter my email and password on a login screen, so that I can authenticate with the backend
2. As an IFVM agent, I want my JWT token to be stored securely on my tablet, so that I stay connected between sessions
3. As an IFVM agent, I want to be automatically redirected to the login screen if my token expires or is invalid, so that I never see stale data
4. As an IFVM agent, I want to log out from the app, so that my session is cleared and no one else can access my data
5. As an IFVM agent, I want to see a clear error message if my login fails (wrong email/password), so that I know what to do
6. As an IFVM agent, I want the login screen to show the IFVM logo and branding, so that I recognize the official app

### Dashboard
7. As an IFVM agent, I want to see a dashboard after login, so that I have an overview of my work context
8. As a prospecteur, I want to see the number of postes acridiennes associated with my PA, so that I know my coverage area
9. As a chef_equipe, I want to see summary cards for all fiches types (prospection, CRT, météo), so that I can monitor my team's activity
10. As any role, I want the dashboard to adapt to my role, so that I only see relevant information
11. As an IFVM agent, I want the dashboard to load quickly even on slow connections, so that I'm not blocked waiting

### Navigation
12. As an IFVM agent, I want a bottom tab navigation, so that I can switch between main screens easily
13. As an IFVM agent, I want to see only the tabs relevant to my role, so that I'm not overwhelmed with unused features
14. As a prospecteur, I want tabs for Dashboard, Prospection, and Sync, so that I have quick access to my main tasks
15. As a chef_equipe, I want tabs for Dashboard, Fiches, Supervision, and Sync, so that I can manage my team
16. As an IFVM agent, I want a Profil/Settings tab, so that I can view my account info and log out

### API Communication
17. As a mobile app, I want an API client that automatically attaches the JWT token to every request, so that authentication is seamless
18. As a mobile app, I want the API client to handle 401 responses by redirecting to login, so that expired tokens don't cause errors
19. As a mobile app, I want to configure the API base URL (dev vs production), so that I can point to different backends
20. As a developer, I want the mobile API client to use the same endpoints as the web frontend (`/auth/login`, `/geo/postes`, etc.), so that there's no backend duplication

### State Management
21. As a developer, I want a Zustand auth store that holds the current user and token, so that state is predictable and testable
22. As a developer, I want the auth store to persist to SecureStore, so that the user stays logged in across app restarts
23. As a developer, I want the auth store to expose login/logout actions, so that components can trigger auth flows cleanly

### Project Structure
24. As a developer, I want the mobile project in `mobile/` at the repo root, so that it's consistent with `frontend/` and `backend/`
25. As a developer, I want Expo Router (file-based routing) from the tabs template, so that navigation setup is minimal
26. As a developer, I want TypeScript strict mode enabled, so that type safety is enforced from the start
27. As a developer, I want a `.env` file for the API URL, so that I can switch environments without code changes

### Build & Distribution
28. As a developer, I want EAS Build configured for Android APK generation, so that I can produce test builds without Android Studio
29. As a developer, I want a `preview` build profile that produces a sideloadable APK, so that field agents can install directly
30. As an IFVM admin, I want the APK to target Android 10+, so that it runs on standard field tablets

## Implementation Decisions

### Project location and initialization
- `mobile/` directory at repo root (parallel to `frontend/`, `backend/`)
- Expo template: `tabs` (includes Expo Router, file-based routing, bottom tab navigation)
- No monorepo migration yet — `packages/core` deferred until there's shared logic to extract

### API communication layer
- Use `fetch` (native, no axios dependency) for HTTP requests
- Base URL configurable via environment variable `EXPO_PUBLIC_API_URL`
- Default dev URL: `http://localhost:8000` (same as backend)
- The backend has no CORS issues for mobile — native apps bypass CORS entirely
- API endpoints reused from web: `POST /auth/login`, `GET /geo/postes`, `GET /geo/stations`
- JWT token format: HS256, contains `sub` (user UUID) and `exp` (expiration)
- Token expiry: 60 minutes (configured in `backend/app/config.py`)

### Auth flow
- **Login**: `POST /auth/login` with `{email, password}` → receives `{access_token, token_type}`
- **Token storage**: `expo-secure-store` (native Keychain/Keystore, hardware-backed encryption)
- **Runtime state**: Zustand store with `{token, user, isAuthenticated}`
- **Startup**: Load token from SecureStore → decode JWT to get user_id → fetch user profile from backend
- **Logout**: Clear SecureStore + reset Zustand store → redirect to login
- **401 handling**: API interceptor catches 401 → clear auth state → redirect to login

### Navigation structure (Expo Router)
```
mobile/app/
  _layout.tsx          ← Root layout (auth guard)
  (auth)/
    login.tsx          ← Login screen
  (tabs)/
    _layout.tsx        ← Bottom tab navigator
    index.tsx          ← Dashboard
    fiches.tsx         ← Fiches list (placeholder)
    sync.tsx           ← Sync status (placeholder)
    profil.tsx         ← Profil + logout
```

- `(auth)` group: shown when NOT authenticated
- `(tabs)` group: shown when authenticated, with bottom tab bar
- Auth guard in root `_layout.tsx`: checks Zustand store → redirects to `(auth)` or `(tabs)`

### State management
- Zustand store: `useAuthStore` with state `{token, user, isAuthenticated}` and actions `{login, logout, setUser}`
- Persistence: `zustand/middleware` with custom SecureStore adapter (expo-secure-store)
- No React Query yet — API calls are direct fetch in components for simplicity at this stage

### Styling
- NativeWind (Tailwind CSS for React Native) — already included in Expo tabs template
- Color palette: green-700 primary (matching web frontend branding)
- IFVM logo displayed on login screen

### Build configuration
- EAS Build with `preview` profile for Android APK (sideload)
- `eas.json` with `preview` and `production` profiles
- App slug: `ifvm-mobile`
- Package name: `com.ifvm.mobile`

## Testing Decisions

### Seam for testing
The **API client layer** is the single highest seam — it's the boundary between the mobile app and the backend. All external behavior flows through it. Tests should focus on:

1. **Auth store behavior** (unit): Test Zustand store transitions — login sets token + user, logout clears state, 401 triggers logout
2. **API client integration** (integration): Test that requests include the Authorization header, that 401 responses trigger auth redirect
3. **Navigation guards** (e2e/integration): Test that unauthenticated users see login, authenticated users see dashboard
4. **Login screen** (component): Test form submission, error display, loading state

### What makes a good test
- Test external behavior (what the user sees/does), not implementation details
- Mock the API layer at the fetch boundary, not inside components
- Use MSW (Mock Service Worker) or jest mocks for API responses
- Prefer integration tests over unit tests for UI components

### Prior art
- Backend uses pytest (configured in `pyproject.toml`)
- Frontend web has no tests yet — mobile can establish the testing pattern
- Expo projects typically use Jest (included by default) + React Native Testing Library

### Test files location
```
mobile/__tests__/
  auth-store.test.ts       ← Zustand store unit tests
  api-client.test.ts       ← API client integration tests
  login-screen.test.tsx    ← Login component tests
```

## Out of Scope

- **SQLite local storage**: Schema SQLite et sync offline — decision reportée (Question 5)
- **Packages/core extraction**: Monorepo et partage de code avec le web — fait plus tard
- **Fiches terrain**: Les 5 écrans de collecte de données (prospection, météo, CRT, vol) — Pas dans cette PRD
- **GPS et location**: expo-location — pas dans cette PRD
- **Offline sync**: Endpoints push/pull, gestion des conflits — fait plus tard
- **PostGIS / données géospatiales**: Intégration FlatGeobuf — fait plus tard
- **iOS**: Cible Android uniquement pour l'instant
- **Play Store**: Distribution via sideload uniquement
- **Tests e2e complets**: Detox ou Maestro — configuré plus tard
- **Notifications push**: Pas dans cette PRD
- **Internationalisation (i18n)**: App en français uniquement pour l'instant

## Further Notes

### Référence des types TypeScript existants
Le frontend web définit des interfaces dans `frontend/src/types/index.ts` qui seront réutilisées (ou adaptées) pour le mobile :
- `PosteAcridien` (id, code, nom, region, district, commune)
- `Station` (id, pa_id, code, nom, type, latitude, longitude, altitude_m)
- `Utilisateur` (id, nom, prenom, email, role, pa_id, actif)
- `SyncStatus` = 'local' | 'synced' | 'conflict'
- `Espece` = 'LMC' | 'NSE' | 'mixte'

### Backend endpoints disponibles
| Endpoint | Méthode | Rôle | Auth |
|----------|---------|------|------|
| `/auth/login` | POST | Login | Non |
| `/geo/postes` | GET | Liste postes acridiens | Oui |
| `/geo/stations` | GET | Liste stations | Oui |
| `/geo/stations-meteo` | GET | Liste stations météo | Oui |
| `/users/me` | GET | Profil utilisateur courant | Oui |

### Rôles IFVM et permissions
| Rôle | Fiches accessibles |
|------|---------------------|
| `prospecteur` | Prospection extensive, Prospection intensive, Relevé météo |
| `chef_equipe` | CRT + toutes prospections (lecture/écriture) + supervision |
| `agent_encadreur` | CRT (lecture seule ou co-remplissage) |
| `pilote` | Fiche de vol |
| `mecanicien` | Fiche de vol |
| `chef_de_base` | Tout en lecture/écriture + validation + sync status |
| `admin` | Gestion utilisateurs + config postes acridiens |

### Commandes utiles
```bash
# Créer le projet
npx create-expo-app mobile --template tabs

# Installer les dépendances supplémentaires
cd mobile && npx expo install expo-secure-store zustand

# Lancer en dev
cd mobile && npx expo start

# Build APK (EAS)
cd mobile && eas build -p android --profile preview
```
