# PRD — Écran 8d : Web · Larves — grilles captures (les 2 espèces)

## Contexte

La vue web du superviseur présente les grilles larvaires des deux espèces côte à côte, une fois les données soumises. Chaque espèce a sa propre structure (stades, phénotypes, plafonds). Ce panneau est accessible depuis la console web (écran 6) en sous-onglet de la section B/C.

## Fonctionnalités requises

### F1 — Grille Locusta — Larves (L1→L5)
- Tableau : Phénotype (ligne) × Stade L1..L5 + Σ (colonnes)
- 4 phénotypes : Solitaires, Solitaro-transiens, Transiens, Grégaires
- Ligne de total par stade
- Plafond 65 affiché en header ("Locusta 65 max")

### F2 — Grille Nomadacris — Larves (L1→L7)
- Tableau : 3 Phénotypes (Solitaires, Transiens, Grégaires) × 7 Stades L1..L7 + Σ
- Ligne de total par stade
- Plafond 75 affiché en header ("Nomadacris 75 max")

### F3 — Affichage côte à côte
- Les deux grilles sur la même page, séparées par un header d'espèce
- Message contextuel en bas : "Les deux espèces apparaissent côte à côte une fois leurs grilles remplies — chacune avec ses propres stades et plafonds."

### F4 — Édition (si superviseur)
- Cellules éditables pour correction
- Totaux Σ recalculés en live
- Validation : total ≤ plafond par espèce

## Design & UX

- Tables identiques à la grille imagos (fond alternant, totaux sur fond `#16201A`)
- Header espèce : badge vert avec nom latin et code (L)
- Affichage responsive : sur tablette les 2 grilles s'empilent verticalement

## Critères d'acceptation

- [ ] Les deux grilles sont affichées sur la même page
- [ ] Les stades de Nomadacris vont jusqu'à L7 (pas L5)
- [ ] Les totaux sont corrects et distincts entre les deux espèces
- [ ] Si une espèce n'a pas de larves → sa grille n'est pas affichée
- [ ] Les corrections web sont synchronisées avec la fiche (audit trail)

## Questions ouvertes

- Les modifications web des larves sont-elles tracées (qui a modifié, quand) pour l'audit trail ?
