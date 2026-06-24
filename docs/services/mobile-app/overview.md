# Service Overview — IFVM Mobile

**Owner :** Équipe IFVM  
**Dernière mise à jour :** 2026-06-24  
**Statut :** En développement

## Identité du service

| Champ | Valeur |
|-------|--------|
| **Nom** | IFVM Mobile |
| **Package** | `ifvm-mobile` |
| **Slug** | `ifvm-mobile` |
| **Répertoire** | `mobile/` |
| **Plateforme** | Android (tablettes terrain) |
| **Stack** | React Native + Expo SDK 56 + TypeScript |

## Description

Application mobile de collecte de données terrain pour les agents de l'IFVM (Institut de Fumigation et de Valorisation des Moyens). L'app permet de remplir les fiches de terrain (prospection, traitement, vol, météo) hors-ligne et de les synchroniser avec le serveur central quand une connexion est disponible.

## Architecture technique

```
┌─────────────────────────────────────────────┐
│                IFVM Mobile                  │
├─────────────────────────────────────────────┤
│  Expo Router (file-based routing)          │
│  ├── (tabs)/     → Écrans principaux       │
│  └── (auth)/     → Authentification        │
├─────────────────────────────────────────────┤
│  NativeWind (Tailwind CSS)                 │
├─────────────────────────────────────────────┤
│  React Native + Expo SDK 56                │
│  ├── expo-sqlite    → Stockage local       │
│  ├── expo-location  → GPS                  │
│  └── expo-secure-store → Tokens JWT        │
└─────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────┐
│  Backend API (FastAPI)                     │
│  POST /sync/upload → Sync fiches           │
│  POST /auth/login  → JWT                   │
└─────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────┐
│  PostgreSQL 16 (serveur central)           │
└─────────────────────────────────────────────┘
```

## Composants

### Navigation

| Route | Description | Type |
|-------|-------------|------|
| `(tabs)/` | Écran principal (dashboard) | Tab |
| `(tabs)/explore` | Écran d'exploration | Tab |
| `(auth)/login` | Page de connexion | Stack |

### Configuration

| Fichier | Rôle |
|---------|------|
| `app.json` | Configuration Expo (plugins, splash, icons) |
| `tsconfig.json` | TypeScript strict |
| `tailwind.config.js` | Configuration NativeWind |
| `babel.config.js` | Preset NativeWind |
| `metro.config.js` | Bundle Metro avec NativeWind |
| `eas.json` | EAS Build (preview/production) |
| `.env` | Variables d'environnement |

## Dépendances principales

| Package | Version | Usage |
|---------|---------|-------|
| `expo` | ~56.0.12 | Framework React Native |
| `expo-router` | ~56.2.11 | File-based routing |
| `nativewind` | ^4.2.6 | Tailwind CSS pour RN |
| `react-native` | 0.85.3 | Runtime React Native |
| `typescript` | ~6.0.3 | Type checking |

## Commandes essentielles

```bash
# Démarrer le serveur de développement
cd mobile && npm start

# Lancer les tests
cd mobile && npm test

# Vérifier TypeScript
cd mobile && npx tsc --noEmit

# Build APK (preview)
cd mobile && eas build --profile preview --platform android
```

## Relations avec autres services

| Service | Relation | Protocole |
|---------|----------|-----------|
| Backend API | Consommateur d'API | HTTPS REST |
| PostgreSQL | Via backend |间接 |
| Frontend Web | Partage `packages/core` (futur) | npm |

## Monitoring et observabilité

- **Logs** : `npx expo start` affiche les logs en développement
- **Erreurs** : Sentry à configurer (phase 2)
- **Performance** : Flipper pour le debugging React Native

## Sécurité

| Aspect | Implémentation |
|--------|----------------|
| Authentification | JWT via `expo-secure-store` |
| Stockage local | SQLite (expo-sqlite) |
| Transmission | HTTPS uniquement |
| APK | Signing manuel pour sideload |

## Plan de évolution

| Phase | Statut | Description |
|-------|--------|-------------|
| 01 - Scaffolding | ✅ Terminé | Projet Expo, navigation, NativeWind |
| 02 - API Client | 🔄 En cours | Client HTTP, types API |
| 03 - Auth Store | ⏳ À faire | Zustand, SecureStore, JWT |
| 04 - Login + Dashboard | ⏳ À faire | Écrans de connexion et dashboard |
| 05 - SQLite sync | ⏳ À faire | Stockage local, sync offline |
| 06 - Fiches terrain | ⏳ À faire | Formulaires de collecte |

## Voir aussi

- [ADR-003](../../adr/ADR-003-mobile.md) — Choix React Native vs PWA
- [ADR-004](../../adr/ADR-004-mobile-scaffolding.md) — Choix de scaffolding
- [Runbook développement](runbooks/development.md) — Procédures de développement
