# ADR-004 — Scaffolding mobile : choix techniques du projet Expo

**Statut :** Accepté  
**Date :** 2026-06-24  
**Lié à :** ADR-003 (React Native vs PWA)

## Contexte

Après avoir choisi React Native (Expo) pour l'application mobile IFVM (ADR-003), il faut initialiser le projet avec une structure technique cohérente. Les contraintes sont :

- Navigation par tabs (écrans principaux) + authentification
- Styles CSS avec Tailwind (cohérence avec le frontend web)
- TypeScript strict pour la fiabilité
- Build Android APK pour sideload (pas de Play Store)
- Compatibilité avec le futur monorepo (`packages/core`)

## Décision

### Template de navigation

**Expo Router avec structure `(tabs)` + `(auth)`**

| Option | Choix | Justification |
|--------|-------|---------------|
| React Navigation manuel | Écarté | Trop de boilerplate, pas de file-based routing |
| Expo Router (tabs) | **Retenu** | File-based routing, structure intuitive, natif Expo |
| Soleus (bottom tabs) | Écarté | Moins mature, moins documenté |

La structure retenue :

```
src/app/
├── _layout.tsx          # Root layout (Stack)
├── (tabs)/
│   ├── _layout.tsx      # Bottom tabs
│   ├── index.tsx        # Écran principal
│   └── explore.tsx      # Écran exploration
└── (auth)/
    ├── _layout.tsx      # Stack auth
    └── login.tsx        # Page de connexion
```

### Framework CSS

**NativeWind v4 (Tailwind CSS pour React Native)**

| Option | Choix | Justification |
|--------|-------|---------------|
| StyleSheet React Native | Écarté | Pas de utility classes, verbose |
| Styled Components | Écarté | Runtime overhead, moins populaire |
| NativeWind (Tailwind) | **Retenu** | Cohérence avec le frontend web (Tailwind), utility classes, performant |

Configuration :
- `tailwind.config.js` avec preset `nativewind/preset`
- `babel.config.js` avec `nativewind/babel`
- `metro.config.js` avec `withNativeWind`
- `global.css` pour les directives `@tailwind`

### TypeScript

**Strict mode activé**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true
  }
}
```

Le strict mode inclut `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, etc. Ceci garantit la fiabilité du code et la détection précoce des erreurs.

### Build et distribution

**EAS Build avec profils `preview` et `production`**

| Profil | Usage | Type |
|--------|-------|------|
| `preview` | Sideload APK pour tests internes | APK Android |
| `production` | Build final pour distribution | AAB (Play Store futur) |

Le profil `preview` génère un APK installable directement sur les tablettes terrain sans passer par le Play Store.

### Variables d'environnement

**Fichier `.env` avec `EXPO_PUBLIC_API_URL`**

```
EXPO_PUBLIC_API_URL=http://localhost:8000
```

Expo supporte nativement les variables `EXPO_PUBLIC_*` qui sont injectées au build time.

## Alternatives écartées

| Alternative | Raison de l'écart |
|-------------|-------------------|
| Nativewind v2 | Pas de support Expo Router, configuration différente |
| Tamagui | Plus complexe, moins adopté pour Expo |
| React Native Paper | Composants UI lourds, pas de utility CSS |
| Flutter | Pas de partage de code avec le frontend web React |

## Conséquences

### Positives
- Cohérence visuelle entre web (Tailwind) et mobile (NativeWind)
- File-based routing simplifie la navigation
- TypeScript strict réduit les bugs en production
- EAS Build simplifie la distribution APK

### À surveiller
- NativeWind v4 est récent (2024) — monitorer la stabilité
- La configuration Metro + Babel + Tailwind est plus complexe qu'un projet Expo standard
- Le `global.css` doit être importé dans le root layout

### Prochaines étapes
- Installer Zustand pour la gestion d'état (ADR-002 sync)
- Configurer Expo SQLite pour le stockage local
- Implémenter l'écran de login avec JWT
