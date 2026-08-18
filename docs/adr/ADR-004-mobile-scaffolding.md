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

**ABI natives embarquées (`buildArchs`)**

`expo-build-properties` restreint la liste `reactNativeArchitectures` de Gradle. Chaque ABI absente de cette liste rend l'APK non installable sur les appareils correspondants — avec un message Android générique (« application non installée »), sans trace exploitable.

| ABI | Cible |
|-----|-------|
| `armeabi-v7a` | Appareils Android Go en userland 32-bit — itel A631L (A49 Play), Unisoc SC9863A, Android 12 Go |
| `arm64-v8a` | Tablettes et smartphones terrain 64-bit (majorité du parc) |
| `x86_64` | Émulateur Android (dev et CI) |

`x86` (émulateur 32-bit) est volontairement exclu : plus aucun émulateur utilisé sur le projet ne l'exige.

Le SoC seul ne détermine pas l'ABI : le SC9863A est un Cortex-A55 ARMv8 (donc 64-bit *capable*), mais les ROM Android Go livrées sur ces appareils d'entrée de gamme tournent en userland 32-bit et n'exposent que `armeabi-v7a`. C'est l'OS installé qui décide, d'où l'inclusion des deux ABI ARM plutôt qu'un pari sur l'une des deux.

Le parc supporté est la spécification exécutable `mobile/__tests__/android-build-config.test.ts` : y ajouter un appareil fait échouer la CI tant que `app.json` ne couvre pas son ABI.

**Conséquence sur les updates OTA** — `runtimeVersion` utilise la policy `fingerprint`, et `app.json` fait partie des sources hachées. Modifier `buildArchs` change donc le fingerprint, ce qui est le comportement voulu : une update OTA ne doit jamais atteindre un binaire dont les ABI diffèrent. En pratique, **un changement d'ABI ne se diffuse pas par OTA** — les appareils déjà équipés restent sur l'ancien runtime et doivent réinstaller l'APK produit par le job `build`. C'est le cas pour l'ajout d'`armeabi-v7a` : l'itel A631L n'ayant de toute façon jamais pu installer l'APK précédent, il part d'une installation neuve.

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
