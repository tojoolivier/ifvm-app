# PRD — Écran 6f : E · Strates de végétation (mobile)

## Contexte

La section E végétation de la fiche papier va au-delà de la seule strate herbeuse : elle recense toutes les strates (arborée, arbustive, buissonneuse, herbeuse, cultures sèches, sol nu) avec leur recouvrement relatif. Chaque strate peut être détaillée (hauteur, phénologie ORPAD). Le recouvrement total doit faire exactement 100 %.

## Problème utilisateur

> « Je dois répartir 100 % entre 6 strates. Sur papier c'est une colonne de pourcentages. Sur mobile il me faut quelque chose d'intuitif qui m'empêche de dépasser 100 %. »

## Fonctionnalités requises

### F1 — Liste des strates
- 6 strates affichées en liste verticale :
  1. Strate arborée
  2. Strate arbustive
  3. Buissonneuse
  4. Strate herbeuse (principale)
  5. Cultures sèches
  6. Sol nu
- Chaque strate : curseur de recouvrement % (0–100)
- Total affiché en temps réel en bas (doit égaler 100 %)

### F2 — Détail par strate (expandable)
- Tap sur une strate → expand pour afficher :
  - Hauteur moyenne (m) — champ numérique
  - Phénologie ORPAD : Verdissement, Repousse, Germination, Feuillaison, Floraison, Fructification, Sécheresse (multi-select chips)
- La strate herbeuse est expansée par défaut

### F3 — Validation recouvrement
- Si total ≠ 100 % : afficher le delta et mettre en rouge le total
- Aide contextuelle : "Recouvrement total ≥ 100% — répartissez les pourcentages entre les strates"

### F4 — Simplification intelligente
- Si strate = 0 % → ne pas afficher son détail
- Seules les strates > 0 % contribuent au total

## Design & UX

- Total recouvrement toujours visible (sticky bottom ou en-tête de section)
- Strates non sélectionnées (0 %) en gris clair
- Expand animé (slide down)

## Critères d'acceptation

- [ ] Le total se met à jour à chaque modification de curseur
- [ ] Le total 100 % est indiqué en vert, tout autre valeur en rouge
- [ ] Les strates à 0 % n'affichent pas de détail expandable
- [ ] La phénologie ORPAD accepte 0 à 7 sélections simultanées
- [ ] Hauteur moyenne : champ numérique, 1 décimale

## Questions ouvertes

- La contrainte "total = exactement 100 %" est-elle stricte ou approximative (ex. ≥ 95 %) ?
