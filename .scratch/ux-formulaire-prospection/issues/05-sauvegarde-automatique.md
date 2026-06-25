Status: ready-for-agent

## Parent

`.scratch/ux-formulaire-prospection/PRD.md`

## What to build

Persistance automatique du formulaire en `localStorage` pour éviter toute perte de données.

**Comportement attendu :**

- Toutes les 30 secondes, si l'état du formulaire a changé depuis la dernière sauvegarde, sérialiser l'ensemble des `useState` dans `localStorage` sous la clé `prospection-draft` (pas de user_id pour l'instant, un seul brouillon à la fois).
- Un indicateur discret ("Brouillon sauvegardé à 14:32") apparaît après chaque sauvegarde automatique, dans le header du formulaire.
- La sauvegarde automatique est désactivée pendant la mutation (soumission en cours).
- Après soumission réussie, effacer la clé `localStorage`.

**Restauration au chargement :**

- Si un brouillon existe en `localStorage`, afficher une bannière : "Un brouillon du 25/06/2026 à 14:32 existe. [Reprendre] [Commencer à zéro]"
- "Reprendre" : charger l'état sauvegardé dans les `useState`
- "Commencer à zéro" : effacer le brouillon et démarrer un formulaire vide

**Warning navigation :**

- Si le formulaire contient des données non soumises, intercepter la navigation (`beforeunload` + React Router `useBlocker`) avec un message "Des modifications non soumises seront perdues. Quitter quand même ?"

## Acceptance criteria

- [ ] Le formulaire se sauvegarde automatiquement toutes les 30s si modifié
- [ ] L'indicateur de sauvegarde affiche l'heure de la dernière sauvegarde
- [ ] Au rechargement de la page, la bannière de restauration apparaît si un brouillon existe
- [ ] "Reprendre" restaure exactement l'état sauvegardé (tous les champs, toutes les lignes de captures)
- [ ] "Commencer à zéro" efface le brouillon et présente un formulaire vide
- [ ] Après soumission réussie, le brouillon est effacé (pas de bannière au prochain chargement)
- [ ] La navigation vers une autre page avec données non soumises déclenche un warning
- [ ] Pas de sauvegarde pendant la soumission

## Blocked by

None — can start immediately
