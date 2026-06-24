# Issue 04 — Frontend web : page liste des prospections intensives

**Status:** ready-for-agent  
**Priority:** high  
**Depends on:** 02

## Description

Créer la page web pour lister, filtrer et consulter les fiches de prospection intensive.

## Acceptance Criteria

- [ ] Page `/prospections` avec tableau des fiches
- [ ] Colonnes : station, date, prospecteur, statut, campagne, actions
- [ ] Filtres : par statut, par campagne, par station, par date
- [ ] Lien vers le détail de chaque fiche
- [ ] Bouton "Nouvelle fiche" pour créer depuis le web
- [ ] Badge de statut avec couleurs (brouillon=gris, en_attente=orange, verifiee=bleu, validee=vert, rejetee=rouge)
- [ ] Pagination si > 20 fiches
- [ ] Responsive (desktop first)

## Technical Notes

- Utiliser les composants shadcn/ui existants (table, button, select, badge)
- Suivre le pattern de `CampagnesPage.tsx`
- Appel API via `api.get('/prospections-intensives', { params })`
- Navigation via React Router

## Testing

- Test de rendu : le tableau affiche les fiches
- Test de filtrage : les filtres retournent les bonnes résultats
- Test de navigation : le lien détail fonctionne
