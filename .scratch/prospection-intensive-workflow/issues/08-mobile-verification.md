# Issue 08 — App mobile : écran de vérification (vérificateur)

**Status:** ready-for-agent  
**Priority:** high  
**Depends on:** 03

## Description

Implémenter l'écran mobile pour que le vérificateur puisse vérifier les fiches intensives depuis l'app.

## Acceptance Criteria

- [ ] Onglet "Vérification" visible uniquement pour les rôles `verificateur` et au-dessus
- [ ] Liste des fiches avec statut "En attente"
- [ ] Chaque fiche affiche : station, date, prospecteur, statut sync
- [ ] Tap sur une fiche → détail complet avec tous les champs
- [ ] Section "Audit log" avec historique
- [ ] Bouton "Vérifier" pour passer à "Vérifié"
- [ ] Possibilité d'ajouter un commentaire avant de vérifier
- [ ] Indicateur de sync status

## Technical Notes

- Le vérificateur est une "autre équipe" — pas le même prospecteur
- La vérification peut être faite sur mobile OU web
- Le commentaire est enregistré dans l'audit log

## Testing

- Test de visibilité : l'onglet n'apparaît pas pour un prospecteur simple
- Test de liste : les fiches "En attente" sont affichées
- Test de vérification : le statut passe à "Vérifié"
- Test de commentaire : le commentaire est enregistré dans l'audit log
