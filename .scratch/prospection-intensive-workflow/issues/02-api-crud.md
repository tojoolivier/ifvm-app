# Issue 02 — API : CRUD prospection intensive

**Status:** ready-for-agent  
**Priority:** high  
**Depends on:** 01

## Description

Implémenter les endpoints API pour la création, lecture, mise à jour et suppression des fiches de prospection intensive.

## Acceptance Criteria

- [ ] `POST /prospections-intensives` — créer une fiche (brouillon ou soumise)
- [ ] `GET /prospections-intensives` — lister avec filtres (statut, campagne, station, prospecteur)
- [ ] `GET /prospections-intensives/{id}` — détail complet
- [ ] `PUT /prospections-intensives/{id}` — modifier (seulement si brouillon)
- [ ] `DELETE /prospections-intensives/{id}` — supprimer (seulement si brouillon)
- [ ] Schemas Pydantic pour Create, Read, Update
- [ ] Use cases dans `application/`
- [ ] Repository dans `infrastructure/`
- [ ] Routes dans `presentation/`

## Technical Notes

- Le campagne_id doit être valide (campagne en cours ou existante)
- La station doit être de type "fixe" pour une intensive
- created_by est extrait du token JWT

## Testing

- Tests d'intégration pour chaque endpoint
- Test de validation : créer une fiche avec station "ponctuelle" doit échouer
- Test de filtrage : lister par statut retourne les bonnes fiches
