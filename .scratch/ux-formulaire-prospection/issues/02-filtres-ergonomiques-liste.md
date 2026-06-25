Status: done

## Parent

`.scratch/ux-formulaire-prospection/PRD.md`

## What to build

Refonte des filtres de `ProspectionsPage` pour qu'ils soient ergonomiques et partageables.

**Filtre station par nom/code** : remplacer le champ texte qui filtre par UUID par un champ qui recherche dans le nom et le code de la station (via l'API `/stations` déjà disponible). Afficher le résultat sous forme de sélection (nom — code) comme dans le formulaire de création.

**Persistance URL** : synchroniser tous les filtres (statut, campagne, station, date) avec les query params de l'URL (`?statut=brouillon&campagne=...`). Au chargement, lire les query params pour initialiser l'état. Permet de partager une vue filtrée par copier-coller de l'URL.

**Bouton "Effacer"** : un bouton unique remet tous les filtres à leur valeur vide et pousse l'URL propre.

**Compteur** : afficher le nombre de résultats ("12 prospections") avant le tableau, mis à jour après chaque filtre.

## Acceptance criteria

- [ ] Le filtre station recherche par nom ou code de station (pas par UUID)
- [ ] Les filtres actifs se reflètent dans l'URL (query params) et survivent à un F5
- [ ] Un lien avec filtres actifs copié dans un autre onglet restaure les mêmes filtres
- [ ] Le bouton "Effacer les filtres" reset tous les filtres et nettoie l'URL
- [ ] Le compteur de résultats est visible et à jour
- [ ] Pas de régression sur la pagination et le tri existants

## Blocked by

None — can start immediately
