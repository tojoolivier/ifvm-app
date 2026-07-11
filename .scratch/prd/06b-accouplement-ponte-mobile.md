# PRD — Écran 6b : B · Accouplement & Ponte (mobile)

## Contexte

L'intensité d'accouplement et de ponte est un indicateur précoce de reproduction acridienne. La fiche papier utilise une échelle à 5 niveaux (Néant / Rare / Peu / Beaucoup / Dominant) pour chacun des deux comportements.

## Problème utilisateur

> « Je dois cocher une case parmi 5 pour l'accouplement, et une autre parmi 5 pour la ponte. Une grille 2×5 sur papier — sur mobile j'ai besoin de deux lignes de boutons. »

## Fonctionnalités requises

### F1 — Matrice accouplement / ponte
- Deux lignes de choix exclusifs (radio buttons styled en chips larges) :
  - **Accouplement** : Néant | Rare | Peu | Beaucoup | Dominant
  - **Ponte** : Néant | Rare | Peu | Beaucoup | Dominant
- 1 seul choix possible par ligne (radio)
- Chips ≥ 44 px de hauteur

### F2 — Alerte croisée
- Si Ponte = Rare ET Phase dominante = Transiens → afficher une alerte contextuelle :
  > "Ponte « Rare » + phase Transiens → signal de reproduction à surveiller."
- Alerte non bloquante (informationnelle)

## Design & UX

- Chips en 5 colonnes, texte court (Néant, Rare, Peu, Bcp, Dom)
- Chip sélectionnée : fond vert `#235A36`, texte blanc
- Alerte : fond ocre clair `#FDF6E7`, icône ⚠

## Critères d'acceptation

- [ ] Les deux lignes fonctionnent indépendamment
- [ ] L'alerte croisée s'affiche uniquement quand les deux conditions sont réunies
- [ ] La sélection est persistée même si l'agent revient en arrière
- [ ] "Néant" est la valeur par défaut (pré-sélectionnée)
