# Issue 09 — Intégration sync et workflow

**Status:** ready-for-agent  
**Priority:** medium  
**Depends on:** 01, 02

## Description

S'assurer que le workflow de validation est correctement intégré avec le système de synchronisation offline/online.

## Acceptance Criteria

- [ ] Le statut de sync (`local`, `synced`, `conflict`) est indépendant du statut de workflow
- [ ] Une fiche peut être `validee` et `conflict` en sync simultanément
- [ ] La synchronisation push enregistre la fiche côté serveur sans changer le statut de workflow
- [ ] Le pull sync récupère les changements de statut faits côté serveur
- [ ] Les conflits de sync sont gérés selon ADR-002 (admin résout)
- [ ] L'audit log est synchronisé avec la fiche

## Technical Notes

- Le module de sync existant (`sync.tsx` mobile, `POST /sync/push`, `GET /sync/pull`) doit être étendu
- Chaque table porte les colonnes `local_version`, `server_version`, `sync_status` (ADR-002)
- L'audit log doit être synchronisé séparément ou inclus dans la fiche

## Testing

- Test offline → online : la fiche est synchronisée sans changer de statut workflow
- Test de conflit : un conflit sync ne bloque pas le workflow de validation
- Test d'audit log sync : l'historique est complet après synchronisation
