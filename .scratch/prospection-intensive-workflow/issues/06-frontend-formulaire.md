# Issue 06 — Frontend web : formulaire de création

**Status:** done  
**Priority:** high  
**Depends on:** 02

## Description

Créer le formulaire web pour créer une fiche de prospection intensive depuis l'interface web.

## Acceptance Criteria

- [ ] Page `/prospections/nouvelle` avec formulaire complet
- [ ] Sélection de la campagne en cours (auto-sélectionnée si une seule en cours)
- [ ] Sélection de la station fixe (liste déroulante avec recherche)
- [ ] Pré-remplissage des infos station (coordonnées, PA, altitude)
- [ ] Tous les champs du formulaire intensif :
  - Captures (espece × stade × sexe × phase × effectif) — options de `stade` **filtrées par espèce** : LMC ⇒ A1-A5 (+ sous-stades A3-x/4), NSE ⇒ L1-L7
  - Population acridien (densités, accouplements, ponte)
  - Infestation (taches, bandes, vols, essaims)
  - Végétation (7 strates × attributs ORPAD)
  - Humidité du sol
  - Texture du sol
- [ ] Boutons "Sauvegarder (brouillon)" et "Soumettre"
- [ ] Validation côté client (champs obligatoires)
- [ ] Messages d'erreur explicites

## Technical Notes

- Utiliser les composants shadcn/ui (input, select, label, button, card)
- Le formulaire doit être scrollable (beaucoup de champs)
- Considérer un formulaire en étapes (wizard) si trop complexe
- Les données de référence (stades, espèces) sont pré-chargées ; le sélecteur de `stade`
  dépend de l'espèce choisie (LMC ⇒ A, NSE ⇒ L)
- La campagne en cours est obligatoire et auto-sélectionnée (règle « une seule campagne en cours »)

## Testing

- Test de rendu : le formulaire s'affiche avec les bons champs
- Test de sélection station : le pré-remplissage fonctionne
- Test de soumission : la fiche est créée avec le bon statut
- Test de validation : les champs obligatoires sont contrôlés
