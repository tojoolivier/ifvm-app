# E2E d'upgrade des captures locales (#676, à faire)

But : une capture non envoyée saisie avec l'ancienne version de l'app est toujours là, et
synchronisable, après la mise à jour (migrations `user_version`, `mobile/src/lib/migrations-captures.ts`).

Couvert aujourd'hui en Jest sur un vrai SQLite (`mobile/__tests__/db-upgrade.test.ts`) ; ce test-ci
ajoute ce que Jest ne voit pas : le vrai moteur (Hermes/expo-sqlite) et le vrai remplacement d'APK.

## Bloqué par
Les flows de l'épic #193 (`prospection-intensive.yaml`, #197/#198) ne sont pas sur cette branche.
Le flow « avant » réutilisera leur saisie de fiche ; on n'invente pas d'identifiants d'écran ici.

## Déroulé prévu (workflow `mobile-e2e-maestro.yml`)
1. Installer l'APK de la version **précédente** (dernier artifact de release).
2. Flow `upgrade-avant.yaml` : login e2e-bot, mode avion (`setAirplaneMode`), saisie d'une fiche
   jusqu'à « En attente » (sans réseau), fermeture de l'app **sans** `clearState`.
3. `adb install -r` de l'APK **candidat** (les données de l'app sont conservées).
4. Flow `upgrade-apres.yaml` : `launchApp` sans `clearState`, réseau rétabli, assertion que la fiche
   est listée « En attente », synchronisation, assertion « Synchronisée » (+ assertion API du #198).

## Vérification appareil (critère du ticket)
À consigner en commentaire de #676 avant fermeture : sur un build release/appareil réel, ouvrir
l'app depuis une installation antérieure contenant des captures en attente et constater `user_version`
à jour et captures intactes (Jest/Babel ≠ Hermes).
