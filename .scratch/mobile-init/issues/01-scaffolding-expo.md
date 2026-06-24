Status: ready-for-agent

## What to build

Créer le projet React Native (Expo) dans `mobile/` avec le template `tabs` (Expo Router). Configurer TypeScript strict, NativeWind, le fichier `.env` pour `EXPO_PUBLIC_API_URL`, et la structure de dossiers `app/` + `__tests__/`. Ajouter la configuration EAS Build (`eas.json`) avec un profil `preview` pour générer un APK Android sideloadable. Vérifier que `npx expo start` démarre sans erreur.

## Acceptance criteria

- [ ] Le dossier `mobile/` existe et `npx expo start` fonctionne
- [ ] Expo Router (file-based routing) est actif avec le template tabs
- [ ] TypeScript strict mode est activé dans `tsconfig.json`
- [ ] NativeWind est configuré et fonctionnel (style de test appliqué)
- [ ] Un fichier `.env` contient `EXPO_PUBLIC_API_URL=http://localhost:8000`
- [ ] `eas.json` définit les profils `preview` (APK) et `production`
- [ ] `package.json` définit le package name `com.ifvm.mobile` et le slug `ifvm-mobile`
- [ ] La structure `mobile/app/` suit la navigation Expo Router (tabs + auth group)

## Blocked by

None - can start immediately
