# Prompt Claude Code — toute la partie web IFVM

Colle ce prompt dans Claude Code à la racine du dépôt `ifvm-app`.

---

Tu travailles sur le dépôt IFVM (FastAPI + React/Vite + React Native/Expo). Ton périmètre est
**l'intégralité de l'application web** `frontend/` : aligner le shell et les écrans existants sur la
maquette de supervision, et construire les trois écrans qui n'existent pas encore. Ne touche pas à
`mobile/`.

## Lis d'abord
- `design_handoff_web/README.md` — la spécification écran par écran avec les tokens exacts
- `design_handoff_web/Prototype Web IFVM.dc.html` — la maquette des 11 écrans (référence visuelle, pas du code à copier)
- `frontend/src/router.tsx`, `frontend/src/components/Layout.tsx`, `frontend/src/index.css`, `frontend/src/components/ui/*`
- `frontend/src/pages/*.tsx` — ce qui existe déjà, avant de créer quoi que ce soit
- `backend/app/presentation/{traitement,prospection,referentiel,campagne}_routes.py` — le contrat d'API réel
- `frontend/src/lib/prospection-{fiche-lecture,syntheses,carte}.ts` — la logique de présentation déjà testée

## Règles de travail
- TDD : test rouge d'abord (Vitest + Testing Library, comme `ProspectionDetailPage.test.tsx`).
- Sépare les commits structurels des commits de comportement.
- Réutilise `components/ui/*` (button, card, table, tabs, select, switch, stepper…) ; n'ajoute aucune
  bibliothèque UI. Si une primitive manque, ajoute-la dans `components/ui/` au même format.
- Ne casse aucun test existant ; la suite doit rester verte.
- Un lot = une PR, dans l'ordre 1 → 6, avec un arrêt pour revue à chaque fin de lot.
- Si le backend contredit la maquette, signale-le au lieu de trancher en silence : la maquette a été
  alignée sur le modèle, pas l'inverse.

## Lot 0 — Correctifs bloquants (petit, à passer en premier)
1. `Layout.tsx` pointe vers `/validation-finale`, route absente de `router.tsx` : elle tombe sur
   `{ path: '*', element: <LoginPage /> }`. Déclare la route vers `ValidationFinalePage` et couvre-la
   par un test de routage.
2. Ajoute une vraie route 404 au lieu du renvoi silencieux vers `LoginPage`.

## Lot 1 — Socle visuel
Les tokens de `index.css` sont ceux de shadcn par défaut, pas la palette IFVM. Remplace-les par la
palette du README (vert `#235a36`, fond `#faf7ef`, surfaces `#fff`/`#fffdf8`, bordure `#e7e0cd`,
ambre `#e89b2b` / `#fdf6e7` / `#f0e2bf`, danger `#c0412b`), charge Archivo + IBM Plex Mono, et
étends `tailwind.config` (couleurs sémantiques, `font-mono` = IBM Plex Mono).
Extrais deux composants partagés : `StatusBadge` (5 statuts, mapping exact du README) et
`DataTable` (en-tête uppercase `600 9.5px` sur `#faf7ef`, lignes cliquables, colonnes numériques en
mono alignées à droite). Mets `DesignSystemPage` à jour : elle doit devenir la preuve visuelle du lot.
Refais `Layout.tsx` : sidebar `236px` avec compteurs par entrée, header `66px` avec fil d'Ariane,
titre, pilule de campagne active et pilule « N fiches en attente ». Le sélecteur « rôle simulé » de la
maquette est un outil de prototype : le vrai rôle vient de `useCurrentUser()`.

## Lot 2 — Traitements (`/traitements`, `/traitements/:id`)
Aucun écran web n'existe alors que le backend est complet.
- Liste sur `GET /traitements` avec filtres `type_traitement`, `prospection_id`, `chef_equipe_id`,
  `reprenable` portés par `useSearchParams`.
- Fiche détail en **lecture seule** : en-tête vert avec pilule « Lecture seule » quand
  `statut = validee`, bandeau du snapshot de cibles avec lien vers la prospection d'origine,
  rotations (aérien) ou produits utilisés (terrestre), moyens & protection, impacts & risque,
  panneau Surfaces, panneau Signatures horodatées, chaîne de reprise.
- Les champs dérivés (`surface_traitee_ha`, `surface_cumulee_ha`, `surface_restante_ha`,
  `total_pesticide_l`, `nb_rotations`) sont affichés, jamais saisis.
- Matrice de signatures : un rôle n'apparaît signataire que si son champ est renseigné ; l'agent
  encadreur ne signe jamais — affiche « ne signe pas ».
- Traite 403 / 404 / 409 / 422 avec le message serveur, pas un message générique.
Ajoute l'entrée de navigation pour les rôles admin, chef et vérificateur.

## Lot 3 — Utilisateurs & stations en un écran à onglets
`UsersPage` et `StationPage` sont deux routes distinctes ; la maquette les réunit sur `/administration`
avec deux onglets et un bouton d'ajout contextuel. Conserve les redirections depuis `/users` et
`/stations`. `StationPage.tsx` fait 39 ko : découpe-le avant de le déplacer.

## Lot 4 — Référentiels (`/referentiels`)
Écran d'administration à 7 entités (pesticides, cultures, codes stades, postes acridiens, stations
fixes, utilisateurs équipe, campagnes) : navigation latérale, table d'enregistrements, formulaire
d'édition, panneau « fraîcheur terrain » sur `GET /referentiel/pull`.
**Le backend n'a pas les écritures.** Ne les invente pas côté client : commence par la partie
lisible (`GET /postes-acridiens`, `GET /stations`, `GET /referentiel/pull`, CRUD `campagnes` qui
existe), affiche l'état API réel par entité comme dans la maquette, et **propose le plan des routes
d'écriture manquantes avant de coder le backend** (CRUD + `actif` en désactivation logique, jamais de
suppression physique : le pull hors-ligne ne transporte que des upserts).
Signale dans la PR les deux écarts de modèle : `pesticide` n'a pas de colonne pour la matière active
ni la dose de référence ; `culture` et `code_stade` sont synchronisées mais jamais lues côté mobile.

## Lot 5 — Fiche de vol & relevé météo — décision produit à confirmer, ne tranche pas seul
La maquette décrit un écran de rapprochement vol ↔ rotations (par n° de cuve) et un relevé météo
quotidien conditionnant l'autorisation de traitement (seuil : vent > 5 m/s ou pluie le jour même).
**Rien de tout cela n'existe en base ni en API.** Rédige une note de cadrage : modèles
`fiche_vol` / `vol` / `releve_meteo`, clé de rapprochement, propriétaire de la saisie météo,
effet du seuil sur la fiche de traitement (avertissement ou blocage). Demande l'arbitrage avant
toute migration.

## Lot 6 — Re-style des écrans existants
Une fois le socle du lot 1 en place, passe `DashboardPage`, `CampagnesPage`, `ProspectionsPage`,
`ProspectionDetailPage`, `ValidationFinalePage`, `SynthesesPage` sur `StatusBadge` / `DataTable` et
la grille de la maquette (`1fr 320px` pour la saisie, `1fr 316px` pour la fiche de lecture,
`300px 1fr` pour la validation, `1.4fr 1fr` pour les synthèses). Comportement inchangé : ce lot est
purement structurel, les tests existants doivent passer sans modification.
`NouvelleProspectionPage.tsx` fait 68 ko : découpe-le par section avant de le re-styler, dans un
commit structurel séparé.
