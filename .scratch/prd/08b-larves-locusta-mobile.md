# PRD — Écran 8b : Larves Locusta migratoria (L1→L5)

## Contexte

Les larves de Locusta ont 5 stades (L1→L5). La grille de capture larvaire est différente de celle des imagos : pas de distinction de sexe (les larves sont indifférenciées), et seulement 4 phénotypes. C'est une grille 4 phénotypes × 5 stades = 20 cases.

## Problème utilisateur

> « Pour les larves, je n'ai pas besoin de différencier mâle/femelle. Je veux choisir le stade larvaire, puis incrémenter par phénotype. »

## Fonctionnalités requises

### F1 — Indicateur "Pas de sexe"
- Message d'information visible : "Larves : pas de distinction ♀/♂ — uniquement phénotype × stade."
- Le toggle Sexe de l'écran Compteur (4) est remplacé par ce message

### F2 — Sélection du stade larvaire
- Chips horizontaux : L1 | L2 | L3 | L4 | L5
- Stade actif mis en avant (fond vert)

### F3 — Compteur par phénotype
- 4 phénotypes : Grégaires | Solitaires | Solitaro-transiens | Transiens
- Pour chaque phénotype : bouton − / compteur / bouton +
- Total capturé en card en haut (ex. "41 / 65")

### F4 — Plafond de captures
- Max 65 larves pour Locusta
- Barre de progression du total vs plafond
- Bouton + désactivé si total atteint le plafond

### F5 — Navigation
- Bouton "Grille suivante : Nomadacris ›" si Nomadacris larves est dans la file
- Sinon : "Terminer le relevé ✓"

## Design & UX

- Même charte visuelle que l'écran Compteur (4)
- Absence du toggle Sexe (remplacé par le message d'info)
- Chips L1→L5 en haut, compteurs en bas

## Critères d'acceptation

- [ ] Le toggle sexe n'apparaît pas
- [ ] La grille 4×5 est correctement stockée en base (phénotype × stade)
- [ ] Le plafond de 65 bloque les incréments supplémentaires
- [ ] La navigation vers la grille suivante est correcte selon le hub (8a)

## Questions ouvertes

- Les larves comptées dans cette grille sont-elles incluses dans les totaux de densité de l'écran 6a ?
