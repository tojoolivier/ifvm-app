# Runbook — Développement Mobile IFVM

**Owner :** Équipe IFVM  
**Dernière mise à jour :** 2026-06-24  
**Fréquence de révision :** Trimestrielle + après chaque utilisation

## Prérequis

| Outil | Version | Installation |
|-------|---------|--------------|
| Node.js | ≥ 18 | `brew install node` |
| npm | ≥ 9 | Inclus avec Node |
| Expo CLI | Dernier | `npm install -g expo-cli` |
| EAS CLI | ≥ 12 | `npm install -g eas-cli` |
| Android Studio | Dernier | Pour l'émulateur (optionnel) |

## 1. Démarrage du projet

### Première mise en place

```bash
# Cloner le repo
git clone <repo-url> && cd database

# Installer les dépendances mobile
cd mobile && npm install

# Vérifier la configuration
npx tsc --noEmit

# Lancer le serveur de développement
npm start
```

### Démarrage quotidien

```bash
cd mobile && npm start
```

Le serveur Expo démarre sur `http://localhost:8081`.

**Options de lancement :**

| Commande | Description |
|----------|-------------|
| `npm start` | Serveur de développement (recommandé) |
| `npm run android` | Lancer sur émulateur Android |
| `npm run ios` | Lancer sur simulateur iOS |
| `npm run web` | Lancer en mode web |

## 2. Vérification de qualité

### TypeScript

```bash
cd mobile && npx tsc --noEmit
```

Doit retourner 0 erreur. En cas d'erreur, corriger avant de commiter.

### Tests

```bash
cd mobile && npm test
```

Tests de validation de la configuration (scaffolding).

### Lint

```bash
cd mobile && npm run lint
```

## 3. Structure du code

### Emplacement des fichiers

```
mobile/
├── src/
│   ├── app/              # Routes Expo Router
│   │   ├── _layout.tsx   # Root layout
│   │   ├── (tabs)/       # Écrans principaux
│   │   └── (auth)/       # Authentification
│   ├── components/       # Composants React Native
│   ├── constants/        # Constantes (theme, etc.)
│   ├── hooks/            # Hooks personnalisés
│   └── types/            # Types TypeScript
├── __tests__/            # Tests
├── assets/               # Images, polices, etc.
└── [config files]        # package.json, tsconfig, etc.
```

### Conventions de nommage

| Élément | Convention | Exemple |
|---------|------------|---------|
| Composants | PascalCase | `LoginScreen.tsx` |
| Hooks | camelCase avec `use` | `useAuth.ts` |
| Types | PascalCase | `User.ts`, `Fiche.ts` |
| Fichiers route | kebab-case | `login.tsx`, `fiche-prospection.tsx` |
| Constantes | SCREAMING_SNAKE | `API_URL`, `STORAGE_KEY` |

## 4. Ajout d'un nouvel écran

### Étape 1 : Créer le fichier de route

```bash
# Pour un écran dans les tabs
touch src/app/(tabs)/mon-ecran.tsx

# Pour un écran hors tabs
touch src/app/mon-ecran.tsx
```

### Étape 2 : Implémenter l'écran

```tsx
import { View, Text, StyleSheet } from 'react-native';

export default function MonEcran() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mon Écran</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold' },
});
```

### Étape 3 : Ajouter la route au layout

Dans `(tabs)/_layout.tsx` :

```tsx
<Tabs.Screen
  name="mon-ecran"
  options={{
    title: 'Mon Écran',
    tabBarIcon: ({ color }) => <TabIcon name="📱" color={color} />,
  }}
/>
```

## 5. Utilisation de NativeWind

### Appliquer des styles

```tsx
import { View, Text } from 'react-native';

export default function Example() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-red-500 text-2xl font-bold">
        Hello NativeWind !
      </Text>
    </View>
  );
}
```

### Classes disponibles

Référence : [NativeWind docs](https://www.nativewind.dev/)

Les classes sont identiques à Tailwind CSS web. Quelques exceptions :

| Web | Native | Note |
|-----|--------|------|
| `bg-red-500` | `bg-red-500` | Identique |
| `hover:bg-red-600` | `active:bg-red-600` | `hover` n'existe pas sur mobile |
| `grid` | `flex` | Pas de CSS Grid sur React Native |
| `fixed` | `absolute` | Pas de `position: fixed` |

## 6. Build APK (preview)

### Prérequis

```bash
# Se connecter à EAS
eas login

# Initialiser le projet EAS
cd mobile && eas init
```

### Build

```bash
cd mobile && eas build --profile preview --platform android
```

L'APK est généré et un lien de téléchargement est fourni.

### Distribution

1. Copier le lien de téléchargement
2. L'envoyer aux agents terrain
3. L'agent ouvre le lien sur la tablette
4. L'installation se fait en sideload

## 7. Dépannage

### Erreur : "Cannot find module"

```bash
cd mobile && rm -rf node_modules && npm install
```

### Erreur : "Metro bundler error"

```bash
cd mobile && npx expo start --clear
```

### Erreur : "TypeScript error"

Vérifier les types :

```bash
cd mobile && npx tsc --noEmit
```

### Erreur : "NativeWind styles not applying"

Vérifier que `global.css` est importé dans `src/app/_layout.tsx` :

```tsx
import '../global.css';
```

### Erreur : "EAS build failed"

Vérifier la configuration :

```bash
cd mobile && eas build:configure
```

## 8. Checklist avant commit

- [ ] `npx tsc --noEmit` passe sans erreur
- [ ] `npm test` passe
- [ ] `npm run lint` passe
- [ ] Nouvel écran ajouté au layout si nécessaire
- [ ] Styles NativeWind testés visuellement
- [ ] Variables d'environnement dans `.env` (pas commitées)

## 9. Ressources

| Ressource | URL |
|-----------|-----|
| Expo Docs | https://docs.expo.dev |
| Expo Router | https://docs.expo.dev/router/introduction |
| NativeWind | https://www.nativewind.dev |
| EAS Build | https://docs.expo.dev/build/introduction |
| React Native | https://reactnative.dev/docs |

## Voir aussi

- [Service Overview](../overview.md)
- [ADR-004 Scaffolding](../../adr/ADR-004-mobile-scaffolding.md)
