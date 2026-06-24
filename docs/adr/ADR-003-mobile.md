# ADR-003 — Application mobile : React Native vs PWA

**Statut :** Accepté  
**Date :** 2026-06-23

## Contexte

Les agents de terrain utilisent une tablette Android sur le terrain. L'application doit fonctionner hors-ligne, accéder au GPS, et stocker des données localement entre les sessions.

## Décision : React Native (Expo)

## Comparaison

| Critère | React Native (Expo) | PWA |
|---------|---------------------|-----|
| SQLite natif | ✅ `expo-sqlite` — transactions, requêtes complexes | ❌ IndexedDB uniquement — pas de SQL |
| GPS précis | ✅ `expo-location` — accès natif | ⚠️ `navigator.geolocation` — moins fiable sur Android |
| Offline fiable | ✅ ServiceWorker non requis, stockage natif | ⚠️ Dépend du ServiceWorker, quota variable selon navigateur |
| Codebase partagée avec web | ⚠️ Logique partagée via packages, UI séparée | ✅ Même code |
| Distribution | APK/Play Store ou sideload | URL directe |
| Effort de développement | +20% vs PWA | Référence |

## Justification

Le facteur décisif est **SQLite natif**. La stratégie de sync (ADR-002) repose sur des requêtes SQL structurées côté tablette — filtres par `statut_sync`, `server_version`, jointures multi-tables. IndexedDB ne peut pas reproduire ça proprement.

Le GPS précis est un second facteur : les coordonnées des stations et des zones de traitement doivent être fiables en conditions terrain (mauvaise réception, GPS lent au démarrage).

## Architecture de partage de code

```
packages/
  core/          ← logique métier partagée (TypeScript)
    models/      ← types et interfaces (Fiche, CRT, Station…)
    validators/  ← validation des formulaires
    sync/        ← algorithme de sync (agnostique à la plateforme)

apps/
  web/           ← React + Vite
  mobile/        ← React Native + Expo
```

Les composants UI sont distincts (React DOM vs React Native), mais la logique de validation, les types, et l'algorithme de sync sont dans `packages/core`.

## Distribution

- Build APK signé distribué via lien de téléchargement direct (sideload) — pas de Play Store requis pour les agents IFVM
- Mise à jour : Expo Updates (OTA) pour les mises à jour JS sans réinstaller l'APK
- Cible : Android 10+ (tablettes terrain standard)

## Conséquences

- Un monorepo (pnpm workspaces ou Turborepo) est nécessaire pour `packages/core`
- Les migrations SQLite côté tablette sont gérées manuellement dans `expo-sqlite` (pas d'Alembic)
- L'APK doit être retesté à chaque migration de schéma SQLite
