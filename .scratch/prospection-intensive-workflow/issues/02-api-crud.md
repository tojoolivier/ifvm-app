# Issue 02 — API : CRUD prospection intensive

**Status:** ready-for-agent  
**Priority:** high  
**Depends on:** 01

## Description

Implémenter les endpoints API pour la création, lecture, mise à jour et suppression des fiches de prospection intensive.

## Acceptance Criteria

- [ ] `POST /prospections` — créer une fiche (`type_prospection` requis ; brouillon ou soumise)
- [ ] `GET /prospections?type=intensive` — lister avec filtres (type, statut, campagne, station, prospecteur)
- [ ] `GET /prospections/{id}` — détail complet
- [ ] `PUT /prospections/{id}` — modifier (seulement si brouillon)
- [ ] `DELETE /prospections/{id}` — supprimer (seulement si brouillon)
- [ ] Entité de domaine `Prospection` (aggregate) + port `ProspectionRepository` (ABC) dans `domain/`
- [ ] Use cases (create/list/get/update/delete) dans `application/`
- [ ] Adapter SQLAlchemy de `ProspectionRepository` dans `infrastructure/`
- [ ] Schemas Pydantic (Create, Read, Update) + routes dans `presentation/`

## Technical Notes

- `campagne_id` est **obligatoire** (NOT NULL) : toujours la campagne en cours (règle « une seule campagne en cours »)
- Pour une intensive, `station_id` réfère une station de type **fixe** ; la localisation ponctuelle
  (lat/long sans `station_id`) est réservée à extensive/validation (hors périmètre de cette PRD)
- created_by est extrait du token JWT
- Clean archi (calqué sur `campagne`) : `domain/` (entité `Prospection` + port `ProspectionRepository`)
  ← `application/` (use cases) ← `infrastructure/` (adapter SQLAlchemy) / `presentation/` (routes + schemas)

## Testing

- Tests d'intégration pour chaque endpoint
- Test de validation : créer une intensive avec une station "ponctuelle" (ou sans `station_id`) doit échouer
- Test de validation : créer une fiche sans `campagne_id` doit échouer
- Test de filtrage : `GET /prospections?type=intensive&statut=...` retourne les bonnes fiches
