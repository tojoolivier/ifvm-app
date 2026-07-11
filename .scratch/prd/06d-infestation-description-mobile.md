# PRD — Écran 6d : D · Infestation — Description (mobile)

## Contexte

La section D de la fiche papier décrit le type et l'étendue de l'infestation observée : type de cible (tache larvaire, bande larvaire, vol clair, essaim), superficie, densité min/max/moy et interdistance entre individus ou groupes.

## Problème utilisateur

> « Je dois noter le type de cible, la surface infestée, et des densités min/max/moy. Ce sont des mesures de terrain que je prends avec un GPS et une règle. »

## Fonctionnalités requises

### F1 — Type de cible (exclusif)
- 4 options en chips larges :
  - Tache Larvaire (L)
  - Bande Larvaire (L)
  - Vol clair
  - Essaim
- 1 seul type actif (radio)

### F2 — Taille et surface
- **Taille** : champ texte libre (ex. "L" = grande)
- **Surface totale** : valeur numérique en ha

### F3 — Densité (/m²)
- 3 champs : min / max / moy
- La moyenne peut être calculée automatiquement si min et max sont renseignés (proposition, modifiable)

### F4 — Interdistance (m)
- 3 champs : min / max / moy
- Même logique de calcul automatique pour la moyenne

### F5 — Bouton "Comportement ›"
- Navigue vers l'écran 6e (Infestation — Comportement)

## Design & UX

- Chips de type de cible : ≥ 48 px de hauteur
- Grille min/max/moy : 3 colonnes compactes, IBM Plex Mono
- Champs désactivés si type de cible non sélectionné

## Critères d'acceptation

- [ ] Les champs Densité et Interdistance sont désactivés tant qu'aucun type de cible n'est sélectionné
- [ ] La moyenne calculée automatiquement peut être modifiée manuellement
- [ ] Les données sont liées au type de cible sélectionné en base
- [ ] Bouton "Comportement" disponible uniquement si type de cible sélectionné
