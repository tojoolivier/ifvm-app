# Issue 01 — Modèle de données : statuts et audit log

**Status:** ready-for-agent  
**Priority:** high  
**Depends on:** none

## Description

Ajouter les colonnes de statut et d'audit log au modèle de données pour supporter le workflow de validation de la prospection intensive.

## Acceptance Criteria

- [ ] Table `prospection_intensive` : ajouter colonnes `statut`, `statut_sync`, `campagne_id`, `verified_by`, `verified_at`, `validated_by`, `validated_at`
- [ ] Table `audit_log` créée avec tous les champs (id, fiche_type, fiche_id, auteur_id, action, details, created_at)
- [ ] Contraintes CHECK sur `statut` (brouillon, en_attente, verifiee, validee, rejetee)
- [ ] Contraintes CHECK sur `statut_sync` (local, synced, conflict)
- [ ] Migration Alembic créée et testée
- [ ] Modèles SQLAlchemy mis à jour (Infrastructure layer)
- [ ] Domaine `ProspectionIntensive` mis à jour (Domain layer)

## Technical Notes

- Suivre le pattern existant dans `backend/app/infrastructure/campagne_model.py`
- Le `audit_log` est une table générique (pas liée à un seul type de fiche)
- Les colonnes `verified_by` et `validated_by` sont nullable (pas encore vérifié/validé)

## Testing

- Test de migration : vérifier que la table est créée correctement
- Test de contraintes : INSERT avec statut invalide doit échouer
