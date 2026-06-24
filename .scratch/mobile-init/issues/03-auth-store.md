Status: done

## What to build

Créer un store Zustand `useAuthStore` pour la gestion de l'authentification, avec persistance via `expo-secure-store`. Le store gère le state `{token, user, isAuthenticated}` et expose les actions `{login, logout, setUser}`. Au démarrage de l'app, le token est chargé depuis SecureStore, décodé pour extraire le `user_id`, puis le profil utilisateur est fetché depuis `/users/me`. L'action logout vide SecureStore et réinitialise le store. Le login appelle `POST /auth/login` via le API client (#2).

## Acceptance criteria

- [ ] Le store Zustand expose `token`, `user`, `isAuthenticated` et les actions `login`, `logout`, `setUser`
- [ ] Le token est persisté dans SecureStore (native Keychain/Keystore) et restauré au démarrage
- [ ] L'action `login(email, password)` appelle le API client, stocke le token et le user
- [ ] L'action `logout` vide SecureStore et réinitialise le store à l'état initial
- [ ] Au startup, le token est chargé → JWT décodé → profil fetché depuis `/users/me`
- [ ] Des tests unitaires vérifient les transitions de state (login → authenticated, logout → unauthenticated)
- [ ] Le store est utilisable comme hook React (`useAuthStore()`)

## Blocked by

- 02-api-client (utilise le API client pour les appels login et profile)
