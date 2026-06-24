Status: done

## What to build

Implémenter l'écran de login, l'auth guard dans le root layout, la navigation par bottom tabs adaptée au rôle, et l'écran dashboard. L'écran login affiche le logo IFVM, un formulaire email/mot de passe, gère les erreurs (mauvais identifiants) et l'état de chargement. Le root layout utilise le store auth (#3) pour rediriger vers `(auth)` ou `(tabs)`. Les bottom tabs s'adaptent au rôle de l'utilisateur (prospecteur, chef_equipe, etc.). Le dashboard affiche des cartes résumé (nombre de postes acridiens, fiches) adaptées au rôle via les endpoints `/geo/postes`. Un écran profil avec bouton logout est inclus.

## Acceptance criteria

- [ ] L'écran login affiche le logo IFVM, un champ email, un champ mot de passe, et un bouton "Se connecter"
- [ ] Soumettre le formulaire appelle `login()` du store auth ; en cas d'erreur, un message clair s'affiche
- [ ] Le root layout redirige automatiquement vers login si non authentifié, vers les tabs si authentifié
- [ ] Le bottom tab navigator affiche les onglets selon le rôle (prospecteur : Dashboard/Prospection/Sync ; chef_equipe : Dashboard/Fiches/Supervision/Sync ; tous : Profil)
- [ ] Le dashboard affiche le nombre de postes acridiens de l'agent (prospecteur) ou des cartes résumé par type de fiche (chef_equipe)
- [ ] L'écran profil affiche les infos utilisateur et un bouton "Se déconnecter" qui appelle `logout()`
- [ ] Le token expiré ou invalide redirige automatiquement vers le login
- [ ] Des tests composants vérifient : soumission login, affichage erreurs, auth guard redirige correctement

## Blocked by

- 03-auth-store (a besoin du store pour l'auth guard et le login)
