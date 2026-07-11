# PRD — Écran 5 : E · Végétation & Sol

## Contexte

La section E de la fiche papier recueille des données environnementales : strate herbeuse, phénologie ORPAD, humidité du sol et texture. Ces données contextualisent l'infestation (conditions favorables au développement acridien). C'est le dernier écran de saisie avant validation.

## Problème utilisateur

> « Je dois estimer le recouvrement végétal en pourcentage, cocher la phénologie et la texture du sol. Ce sont des jugements visuels rapides — je veux des boutons larges, pas des cases à cocher minuscules. »

## Objectif

Permettre une saisie rapide (< 2 min) des données environnementales avec des contrôles adaptés à chaque type de donnée.

## Fonctionnalités requises

### F1 — Strate herbeuse
- **Recouvrement (%)** : curseur horizontal 0–100 %, avec poignée large (≥ 20 × 20 px)
- Valeur affichée en temps réel à côté du curseur (ex. "70 %")
- **Phénologie ORPAD** : 5 options en chips multi-sélection (non exclusives)
  - Verdissement, Feuillaison, Floraison, Fructification, Sécheresse

### F2 — Humidité du sol
- 4 classes exclusives en segmented control :
  - < 0,5 cm | 0,5–12 cm | 12–30 cm | > 30 cm
- 1 seul choix possible

### F3 — Texture du sol
- 4 options en chips à sélection unique :
  - Limoneuse | Argileuse | Sable fin | Gravier
- Chip sélectionnée : fond ocre `#8A6D2F`

### F4 — Bouton final
- CTA : **"Vérifier & enregistrer ✓"** en ocre `#E89B2B`
- Lance l'écran de récapitulatif (ou validation directe si aucune anomalie)

## Design & UX

- Sections regroupées en cards (1 card = 1 variable environnementale)
- Curseur de recouvrement : poignée ronde blanche sur fond vert, inspiré iOS
- Chips ORPAD : multi-sélection, visuellement distinctes des radio buttons
- Pas de scroll si possible (tout tenir en une vue)

## Critères d'acceptation

- [ ] Le curseur de recouvrement accepte des valeurs de 0 à 100 par pas de 5
- [ ] La phénologie accepte 0 à 5 sélections simultanées
- [ ] Humidité et texture : exactement 1 sélection requise avant validation
- [ ] Le bouton "Vérifier & enregistrer" est désactivé si humidité ou texture non renseignée
- [ ] Les données sont sauvegardées localement à chaque changement (auto-save)

## Questions ouvertes

- Faut-il ajouter un champ "Observations libres" pour des notes terrain ?
- La phénologie ORPAD est-elle applicable à toutes les zones prospectées (Hautes Terres vs côtes) ?
