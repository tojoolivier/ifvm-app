# Issue 03 — API : transitions de statut et audit log

**Status:** ready-for-agent  
**Priority:** high  
**Depends on:** 02

## Description

Implémenter l'endpoint de changement de statut avec validation des transitions et enregistrement automatique dans l'audit log.

## Acceptance Criteria

- [ ] `PATCH /prospections-intensives/{id}/statut` — changer le statut
- [ ] Validation des transitions : brouillon→en_attente, en_attente→verifiee, verifiee→validee, verifiee→rejetee
- [ ] Refus des transitions invalides (400 Bad Request)
- [ ] Vérification des permissions (qui peut faire quoi)
- [ ] Enregistrement automatique dans l'audit log à chaque transition
- [ ] `POST /prospections-intensives/{id}/commentaire` — ajouter un commentaire
- [ ] `GET /prospections-intensives/{id}/audit-log` — historique des modifications

## Technical Notes

| Transition | Qui peut la faire |
|------------|-------------------|
| brouillon → en_attente | prospecteur (créateur) |
| en_attente → verifiee | verificateur |
| verifiee → validee | validation_finale |
| verifiee → rejetee | validation_finale |

L'audit log est créé automatiquement lors de chaque appel à PATCH /statut.

## Testing

- Test de transition valide : vérifier que le statut change
- Test de transition invalide : vérifier que 400 est retourné
- Test de permission : un prospecteur ne peut pas valider
- Test d'audit log : vérifier que l'enregistrement est créé
