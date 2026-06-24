Status: completed

## What to build

Créer le projet React Native (Expo) dans `mobile/` avec le template `tabs` (Expo Router). Configurer TypeScript strict, NativeWind, le fichier `.env` pour `EXPO_PUBLIC_API_URL`, et la structure de dossiers `app/` + `__tests__/`. Ajouter la configuration EAS Build (`eas.json`) avec un profil `preview` pour générer un APK Android sideloadable. Vérifier que `npx expo start` démarre sans erreur.

## Acceptance criteria

- [x] Le dossier `mobile/` existe et `npx expo start` fonctionne
- [x] Expo Router (file-based routing) est actif avec le template tabs
- [x] TypeScript strict mode est activé dans `tsconfig.json`
- [x] NativeWind est configuré et fonctionnel (style de test appliqué)
- [x] Un fichier `.env` contient `EXPO_PUBLIC_API_URL=http://localhost:8000`
- [x] `eas.json` définit les profils `preview` (APK) et `production`
- [x] `package.json` définit le package name `ifvm-mobile` et le slug `ifvm-mobile`
- [x] La structure `mobile/src/app/` suit la navigation Expo Router (tabs + auth group)

## Implementation notes

- Projet créé avec `npx create-expo-app@latest mobile --template default`
- NativeWind v4 configuré avec Tailwind CSS
- Structure de navigation : `src/app/(tabs)/` pour les tabs, `src/app/(auth)/` pour l'authentification
- Tests de validation ajoutés dans `mobile/__tests__/scaffolding.test.ts`
- Script de validation shell ajouté dans `scripts/validate-scaffolding.sh`

## Blocked by

None - can start immediately
