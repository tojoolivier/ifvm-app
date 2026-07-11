# PRD — Écran 8c : Larves Nomadacris septemfasciata (L1→L7)

## Contexte

Les larves de Nomadacris ont 7 stades (L1→L7) et seulement 3 phénotypes (pas de Solitaro-transiens). La grille est donc 3 phénotypes × 7 stades = 21 cases. Le plafond est de 75 larves. C'est le dernier écran de captures avant le récapitulatif.

## Problème utilisateur

> « Pour Nomadacris les larves ont 7 stades, pas 5. Et il n'y a que 3 phénotypes. L'app doit s'adapter automatiquement à l'espèce. »

## Fonctionnalités requises

### F1 — Chips de stade larvaire
- 7 chips horizontaux : L1 | L2 | L3 | L4 | L5 | L6 | L7
- Stade actif mis en avant

### F2 — Compteur par phénotype (3 seulement)
- 3 phénotypes : Transiens | Solitaires | Grégaires
- **Pas de Solitaro-transiens** (différence clé avec Locusta)
- Bouton − / compteur / bouton +

### F3 — Plafond de captures
- Max 75 larves pour Nomadacris
- Barre de progression totale vs plafond

### F4 — CTA final
- Bouton "Terminer le relevé ✓"
- Action : navigue vers le récapitulatif de la fiche → puis demande validation

## Design & UX

- Chips L1→L7 : affichage compact (7 chips sur une ligne, taille réduite si nécessaire, ou 2 lignes)
- Même compteur que les autres grilles

## Critères d'acceptation

- [ ] 7 chips de stade, pas 5
- [ ] 3 phénotypes seulement (sans Solitaro-transiens)
- [ ] Plafond à 75 (distinct du 65 de Locusta)
- [ ] "Terminer le relevé ✓" n'est actif que si cette grille est la dernière du hub (8a)
- [ ] Données stockées séparément de la grille larvaire Locusta

## Questions ouvertes

- Les stades L6 et L7 sont-ils toujours présents dans toutes les zones ou seulement dans certaines conditions climatiques ?
