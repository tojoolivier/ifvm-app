# Issue 10 — Dashboard et statistiques

**Status:** ready-for-agent  
**Priority:** low  
**Depends on:** 02, 04

## Description

Implémenter un tableau de bord avec des statistiques sur les fiches de prospection intensive.

## Acceptance Criteria

- [ ] Page d'accueil (`/`) avec widgets de statistiques
- [ ] Nombre de fiches par statut (brouillon, en_attente, verifiee, validee, rejetee)
- [ ] Nombre de fiches par campagne
- [ ] Nombre de fiches par station (top 10)
- [ ] Nombre de fiches par prospecteur
- [ ] Taux de validation / rejet
- [ ] Graphique d'évolution dans le temps (si bibliothèque de graphiques installée)
- [ ] Filtre par campagne

## Technical Notes

- Utiliser les composants shadcn/ui (card)
- Les graphiques sont à décider (Chart.js, Nivo, ECharts) — ADR-005 mentionne "À décider"
- Pour le moment, afficher des compteurs simples (pas de graphiques)
- Les données sont calculées côté serveur via une API dédiée ou agrégées côté client

## Testing

- Test de rendu : les compteurs s'affichent
- Test de données : les compteurs sont corrects
- Test de filtrage : le filtre campagne fonctionne
