# PRD — Écran 3 : Filtre conditionnel — "Qu'avez-vous observé ?"

## Contexte

La fiche papier contient des sections B et C obligatoires pour deux espèces (Locusta migratoria capito et Nomadacris septemfasciata). Si une espèce est absente, le prospecteur doit quand même remplir les cases "néant" — effort inutile. Jusqu'à −60 % des champs peuvent être sautés si on filtre d'abord ce qui a été observé.

## Problème utilisateur

> « Je n'ai vu que des Locusta aujourd'hui. Pourquoi dois-je remplir toute la section Nomadacris avec des zéros ? »

## Objectif

Permettre au prospecteur de déclarer en une étape ce qu'il a observé, et ne lui présenter ensuite que les écrans de saisie pertinents.

## Fonctionnalités requises

### F1 — Carte d'espèce (toggle)
- Une carte par espèce acridienne suivie par l'IFVM (MVP : Locusta migratoria capito, Nomadacris septemfasciata)
- Chaque carte a un toggle global (espèce présente / absente)
- Si espèce présente : afficher les sous-types observés (Imagos / Larves) comme boutons toggle indépendants
- État visuel clair : carte active (bordure verte épaisse + ✓), carte inactive (grisée)

### F2 — Résumé adaptatif
- Message dynamique en bas indiquant combien d'écrans de saisie vont s'afficher
- Ex. : « 2 écrans à remplir au lieu de 4. Nomadacris est sautée. »

### F3 — Validation
- Au moins une espèce doit être cochée OU confirmation explicite "Aucune observation" (cas rare)
- Si aucune espèce : proposer un écran de confirmation avec motif (prospection négative)

### F4 — Stepper
- Étape 2/4 active

## Logique conditionnelle générée

| Sélection | Écrans suivants |
|---|---|
| Locusta Imagos + Larves | Captures Imagos + Captures Larves + Infestation + Végétation |
| Locusta Imagos seulement | Captures Imagos + Infestation + Végétation |
| Locusta + Nomadacris | Captures Locusta (Imagos/Larves) + Captures Nomadacris (Imagos/Larves) + Infestation + Végétation |
| Aucune espèce | Infestation (néant) + Végétation |

## Design & UX

- Cartes grandes (≥ 80 px de hauteur) — lisibles en plein soleil
- Boutons Imagos/Larves en style segmented control (pas des checkboxes)
- Confirmation visuelle immédiate (animation toggle)
- Message adaptatif en fond `#EAF2EC` (vert très clair)

## Critères d'acceptation

- [ ] L'activation d'une espèce affiche immédiatement les sous-types
- [ ] Le message de résumé se met à jour à chaque toggle
- [ ] Le flux de saisie suivant correspond exactement aux sous-types cochés
- [ ] Une espèce non cochée ne génère aucun écran de saisie ni champ vide en base
- [ ] Cas "aucune observation" : tracé avec motif, sans grille

## Questions ouvertes

- Y a-t-il d'autres espèces acridiennes à suivre en dehors de Locusta et Nomadacris ?
- Faut-il permettre d'ajouter une espèce "Autre" avec saisie libre ?
