# Issue 05 — Frontend web : page détail et audit log

**Status:** ready-for-agent  
**Priority:** high  
**Depends on:** 04

## Description

Créer la page de détail d'une fiche intensive avec affichage de l'audit log et actions de vérification/validation.

## Acceptance Criteria

- [ ] Page `/prospections/:id` avec tous les champs de la fiche
- [ ] Affichage de la station sélectionnée (nom, coordonnées, PA)
- [ ] Section "Audit log" avec historique chronologique
- [ ] Chaque entrée d'audit log affiche : auteur, date, action, détails/commentaire
- [ ] Boutons d'action selon le statut et le rôle :
  - Si `en_attente` et rôle `verificateur` → bouton "Vérifier"
  - Si `verifiee` et rôle `validation_finale` → boutons "Valider" / "Rejeter"
- [ ] Modale de confirmation pour validation/rejet
- [ ] Champ de commentaire obligatoire lors du rejet
- [ ] Indicateur de sync status (synchronisé/désynchronisé)

## Technical Notes

- Utiliser les composants shadcn/ui (card, dialog, button, badge, textarea)
- L'audit log est une liste triée par date décroissante
- Les actions changent le statut via `PATCH /prospections-intensives/{id}/statut`

## Testing

- Test de rendu : les données de la fiche sont affichées
- Test d'audit log : les entrées sont affichées chronologiquement
- Test d'action : le bouton "Valider" apparaît pour le bon rôle
