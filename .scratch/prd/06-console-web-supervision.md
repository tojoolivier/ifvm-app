# PRD — Écran 6 : Console web IFVM — Supervision & grille complète

## Contexte

Les superviseurs IFVM ont besoin de consulter les fiches soumises par les prospecteurs, de vérifier les données, de valider ou renvoyer pour correction, et d'exporter. L'écran large permet d'afficher la grille de captures complète (72 cases) que le mobile ne peut pas montrer en une fois.

## Problème utilisateur

> « Je reçois des dizaines de fiches par semaine. Je dois vérifier rapidement les données de capture, voir la localisation sur la carte, et valider ou retourner la fiche au prospecteur. »

## Objectif

Fournir une interface de supervision web qui présente la grille complète, la carte de localisation, les calculs automatiques et les actions de validation en une seule vue.

## Utilisateurs cibles

- **Superviseur IFVM** (profil principal) — agent de supervision, sur desktop/tablette
- **Analyste** — consultation et export des données

## Fonctionnalités requises

### F1 — Sidebar de navigation
- Tableau de bord | Fiches | Carte des infestations | Synthèses & export | Prospecteurs
- Compteur "File de synchro" : fiches reçues en attente de validation
- Thème sombre (`#16201A`)

### F2 — Header de fiche
- Numéro de fiche, commune, date, heure, prospecteur
- Badge statut : À valider / Validée / À corriger
- Actions : Exporter PDF | Valider la fiche

### F3 — Grille de captures complète
- Tableau HTML : Phénotype × Phase (A1..A5), séparé ♀ / ♂
- ♂ : colonnes A2-A4 fusionnées (A234)
- Ligne de total automatique (fond `#16201A`, blanc)
- Surlignage de la phase dominante (fond `#235A36`)
- Calculs affichés sous le tableau :
  - Densité diffuse (/ha)
  - Densité groupée (/m²)
  - Phase dominante (avec alerte visuelle rouge si Transiens ou Grégaire)

### F4 — Carte de localisation
- Carte en colonne droite (330 px)
- Point rouge sur les coordonnées GPS de la fiche
- Cercle pointillé rouge pour la zone d'infestation estimée
- Coordonnées affichées sous la carte

### F5 — Synthèse infestation
- Surface infestée (ha)
- Type d'infestation (Bande larvaire / Essaim / Diffus…)
- Niveau d'infestation (Faible / Moyen / Élevé)

### F6 — Actions de validation
- "Valider la fiche" : change le statut → Validée, notifie le prospecteur
- "Retourner pour correction" : ajoute un commentaire et notifie
- "Exporter PDF" : génère la fiche de lecture A4 (voir Écran 7)

## Design & UX

- Layout 2 colonnes : grille (60 %) + carte/synthèse (40 %)
- Sidebar fixe à gauche, scrollable à droite
- Fond papier `#FAF7EF` pour le contenu principal
- Responsive tablette (min 900 px)

## Critères d'acceptation

- [ ] La grille affiche les 72 cases correctement calculées depuis les données mobiles
- [ ] Les totaux par ligne et colonne sont recalculés en temps réel à l'édition
- [ ] La carte est centrée sur les coordonnées GPS de la fiche
- [ ] Le badge statut se met à jour immédiatement après validation
- [ ] L'export PDF génère un document conforme à la fiche de lecture (Écran 7)
- [ ] Les fiches de la file de synchro apparaissent dans la sidebar sans rechargement

## Questions ouvertes

- Faut-il permettre au superviseur de modifier les données saisies (correction) ou seulement valider/rejeter ?
- Quels rôles peuvent valider ? (superviseur uniquement, ou aussi chef de zone ?)
- La carte doit-elle afficher les fiches voisines pour contexte géographique ?
