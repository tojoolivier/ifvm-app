# Handoff : application web IFVM (supervision) — intégralité du périmètre

## Objet
Spécification UI de **toute la partie web** du système IFVM (lutte antiacridienne) : 11 écrans de
supervision derrière un shell commun (sidebar + header contextuel), avec rôles simulés.
Le back-office web sert le pilotage (campagnes, prospections, traitements, synthèses,
administration) ; la saisie terrain reste sur le mobile.

## À propos des fichiers de design
`Prototype Web IFVM.dc.html` est une **référence de design en HTML** — une maquette
haute-fidélité de l'apparence et du comportement attendus, **pas du code à copier**. La tâche est de
**recréer ces écrans dans l'environnement existant du dépôt** `tojoolivier/ifvm-app` :
`frontend/` en React + TypeScript + Vite, React Router, TanStack Query, Tailwind + composants
shadcn/ui déjà présents dans `frontend/src/components/ui/`. Utiliser ces primitives et ces
patterns ; ne pas introduire une seconde bibliothèque UI.

Ouvrir la maquette : servir le dossier (`python -m http.server`) et ouvrir le `.dc.html` — le
sélecteur d'écran et de rôle est exposé en props (`startPage`, `role`).

## Fidélité
**Haute-fidélité.** Couleurs, typographie, espacements et états sont définitifs et doivent être
reproduits au pixel près avec les primitives du dépôt. Les données affichées sont fictives.

---

## État du dépôt (audit au 2026‑08‑15, `main` @0f41b817)

Existe déjà dans `frontend/src/pages/` : `DashboardPage`, `CampagnesPage`, `ProspectionsPage`,
`NouvelleProspectionPage`, `ProspectionDetailPage`, `ValidationFinalePage`, `SynthesesPage`,
`UsersPage`, `StationPage`, `CartePage`, `LoginPage`, `DesignSystemPage`.

Manque **entièrement** côté web :
| Écran de la maquette | État |
|---|---|
| Traitements (liste + fiche détail) | aucun composant web — backend complet |
| Fiche de vol & relevé météo | aucun composant web — **aucun backend** |
| Référentiels (7 entités, CRUD admin) | aucun composant web — **écritures API absentes** |

Anomalies relevées, à corriger :
1. `Layout.tsx` expose un lien `/validation-finale` que `router.tsx` ne déclare pas : la route
   tombe sur `{ path: '*', element: <LoginPage /> }` et déconnecte visuellement l'utilisateur.
2. Le shell actuel (`Layout.tsx`) est en vert Tailwind générique (`bg-green-800`, logo rond,
   pas de compteurs, pas de header contextuel) et ne correspond pas à la maquette.
3. `index.css` porte des tokens shadcn par défaut (gris/vert menthe `--primary: 152 65% 70%`) qui
   ne sont pas la palette IFVM ci-dessous.
4. Utilisateurs et Stations sont deux pages/routes distinctes ; la maquette les réunit en un écran
   à deux onglets.

---

## Design tokens

Couleurs
| Rôle | Hex |
|---|---|
| Vert IFVM (primaire, sidebar, chiffres clés) | `#235a36` |
| Vert foncé (hover lien) | `#1a4429` |
| Vert texte sur fond vert clair | `#3a5c43` |
| Fond application | `#faf7ef` |
| Fond page hors cadre | `#efeada` |
| Surface carte / header | `#fff` / `#fffdf8` |
| Bordure carte | `#e7e0cd` |
| Bordure champ | `#e0d9c4` |
| Séparateur interne | `#f1ecdd` / `#f4efe2` |
| Texte principal | `#16201a` |
| Texte secondaire | `#3a3a30` |
| Texte tertiaire | `#6f6a59` |
| Texte faible / labels | `#9a9484` |
| Ambre (alerte, attente) | `#e89b2b`, texte `#8a6d2f`, fond `#fdf6e7`, bordure `#f0e2bf` |
| Danger | `#c0412b`, texte `#a5341c`, fond `#fbe9e5`, bordure `#f0c4b9` |
| Bleu (vérifiée) | texte `#31567f`, fond `#eaf0f7`, bordure `#cdddef` |
| Vert clair (validée, panneaux d'aide) | fond `#eaf2ec`, bordure `#cfe0d4` |

Badges de statut (fond / texte / bordure) : brouillon `#f4efe2 / #6f6a59 / #e0d9c4` ·
en attente `#fdf6e7 / #8a6d2f / #f0e2bf` · vérifiée `#eaf0f7 / #31567f / #cdddef` ·
validée `#eaf2ec / #235a36 / #cfe0d4` · rejetée `#fbe9e5 / #a5341c / #f0c4b9`.
Forme : `padding 3px 9px`, `border-radius 20px`, `font 700 10px Archivo`.

Typographie — `Archivo` (400/500/600/700/800) pour l'UI, `IBM Plex Mono` (400→700) pour
tout ce qui est chiffre, code, identifiant, horodatage.
- Titre de page : `800 19px/1.2`, letter-spacing `-.3px`
- Fil d'Ariane : `600 9.5px`, uppercase, letter-spacing `1px`, `#9a9484`
- Titre de carte : `700 13–14px`
- Label de section : `600 9.5px`, uppercase, letter-spacing `1px`, `#9a9484`
- Corps : `500 12–12.5px`, interligne `1.55`
- En-tête de tableau : `600 9.5px`, uppercase, letter-spacing `.8px`, `#9a9484`, fond `#faf7ef`
- Cellule : `500 12px` (texte) / `600 12px IBM Plex Mono` (chiffres, alignés à droite)
- KPI : `700 30px/1.1 IBM Plex Mono` ; chiffre de panneau : `700 15–18px IBM Plex Mono`

Rayons : carte `11px`, panneau d'alerte `9–10px`, en-tête vert `12px`, champ/bouton `8–9px`,
badge/pilule `20px`. Aucune ombre portée — la hiérarchie passe par la bordure et le fond.
Espacements : gouttière de grille `14–20px`, pile verticale `16px`, padding de carte `16–20px`,
padding de cellule `11–12px` (`20px` en première et dernière colonne).
Cadre : largeur de référence `1440×920`, sidebar `236px`, header `66px`, contenu `padding 26px 28px 40px`.

---

## Shell commun

**Sidebar** (`236px`, fond `#235a36`, texte blanc)
- En-tête : carré `38px` blanc rayon `10px` portant « IFVM » en `800 12px` vert, puis
  « IFVM · Supervision » (`800 14px`) et « Lutte antiacridienne » (`500 10.5px`, blanc 62 %).
- Navigation : une ligne par écran, `padding 9px 11px`, rayon `8px`, puce `5px` à gauche,
  libellé, compteur à droite en `600 10px IBM Plex Mono`. Actif : fond `rgba(255,255,255,.14)`,
  texte blanc, poids 700, puce blanche. Inactif : texte blanc 72 %, poids 500.
  Compteurs de la maquette : campagnes 4, prospections 148, validation 7, traitements 36,
  vol 12, utilisateurs 23, référentiels 7 (à brancher sur les vrais totaux).
- Pied : bloc « Rôle simulé » (chips) — **outil de maquette uniquement**, à remplacer par le rôle
  réel de `useCurrentUser()` ; puis avatar initiales `26px`, nom, rôle, lien « Quitter ».

**Header** (`66px`, fond `#fffdf8`, bordure basse `#e7e0cd`) : fil d'Ariane + titre à gauche ;
à droite deux pilules — campagne active (`#eaf2ec`) et « N fiches en attente » (`#fdf6e7`, point
ambre `6px`).

**Accès par rôle** (matrice de la maquette, à confronter au backend avant de coder) :
- Admin : tous les écrans
- Chef : tableau de bord, campagnes, prospections (+ nouvelle), traitements, vol, synthèses, référentiels
- Vérificateur : tableau de bord, prospections, traitements, synthèses
- Prospecteur : tableau de bord, prospections, nouvelle prospection
- Validation finale : tableau de bord, validation finale, prospections, synthèses

---

## Écrans

### 1. Tableau de bord
Bande de 4 KPI (grille `repeat(4,1fr)`, gap `14px`) : prospections 148, surface infestée,
fiches en attente, traitements. Chaque carte : label uppercase, valeur `700 30px IBM Plex Mono`,
légende `500 11px #6f6a59`. Suivi de blocs d'activité et de files d'attente.
Existant : `DashboardPage.tsx` — à re-styler sur les tokens ci-dessus.

### 2. Campagnes
Texte d'introduction (`500 12.5px`, max `640px`) : une seule campagne active à la fois, elle cadre
prospections et traitements. Tableau des campagnes + création. CRUD backend complet
(`GET|POST /campagnes`, `GET|PUT|DELETE /campagnes/{id}`). Existant : `CampagnesPage.tsx`.

### 3. Prospections (liste)
Barre de filtres en carte (`#fff`, `padding 16px 18px`, `flex-wrap`, gap `14px`) : période, station,
espèce, statut, recherche. Tableau : n° de fiche (mono vert), station, date, prospecteur, espèce
(italique), surface infestée (mono, droite), statut (badge), « Ouvrir › ». Existant : `ProspectionsPage.tsx`.

### 4. Nouvelle prospection
Grille `1fr 320px`. Colonne principale : bandeau ambre d'avertissement, puis sections de saisie
(références, localisation, infestation imago/larve, méthode de comptage, dégâts, surfaces).
Colonne latérale : récapitulatif des valeurs dérivées et points bloquants.
Existant : `NouvelleProspectionPage.tsx` (68 ko — à découper avant d'y ajouter quoi que ce soit).

### 5. Détail prospection / fiche de lecture
Grille `1fr 316px`. En-tête vert (`#235a36`, rayon `12px`, `padding 20px 22px`, texte blanc) :
n° de fiche, station, statut. Bandeau `prospection.avertissements` (migration 0024) en ambre.
Blocs : références, infestation (spécialisation imago / larve), méthode de comptage,
interdistances min/max/moy, front (longueur, largeur, densités), stade dominant, taille de groupe,
dégâts, surfaces. Colonne latérale : piste de validation + actions. Vue imprimable A4 déjà en place
(`.fiche-imprimable` dans `index.css`). Existant : `ProspectionDetailPage.tsx`.

### 6. Validation finale
Grille `300px 1fr` : file des fiches à statuer à gauche (carte `#fff`, en-tête avec compteur), fiche
sélectionnée à droite avec actions valider / rejeter (motif obligatoire au rejet).
Existant : `ValidationFinalePage.tsx` — **non routée**, voir anomalie 1.

### 7. Traitements — **à construire**
Deux onglets (`padding 9px 16px`, rayon `9px`, `700 12px`) : liste / détail. Mention à droite :
« Chaque fiche est rattachée à une prospection validée ».

**Liste** — tableau : n° de fiche (mono `#235a36`), type (badge Aérien / Terrestre), mode, date
(mono), responsable, traitée (ha), restante (mono, ambre `#8a6d2f` si > 0), signatures (`3/4`),
« Ouvrir › ». Ligne cliquable, `border-top: 1px solid #f4efe2`.

**Détail (lecture seule après validation)** — grille `1fr 320px` :
- En-tête vert : `Jean-AERIEN-2026-08-12`, sous-titre « Aérien · mode Barrière · Beroroha ·
  validée le 2026‑08‑13 », pilule `🔒 Lecture seule` (`rgba(255,255,255,.16)`).
- Bandeau ambre : cibles = snapshot figé à la création, lien vers la prospection d'origine, surface
  infestée de référence.
- Carte **Rotations** (aérien) : en-tête « rapprochement fiche de vol par n° de cuve » + total
  « 4 rotations · 1 060 l » ; colonnes n° cuve, produit (+ matière active en gris), quantité (l),
  T° début → fin, vent début → fin. En terrestre, remplacer par **Produits utilisés**.
- Deux cartes côte à côte : *Moyens & protection* (liste de kits EPI, pastille `16px` rayon `4px`
  verte avec glyphe blanc `700 9px`, puis zones exposées) et *Impacts & évaluation du risque*
  (axes de risque avec badge de niveau, puis empoisonnement / comportement anormal / mortalité).
- Latéral : panneau **Surfaces** (`#eaf2ec`) — infestée (snapshot), traitée, cumulée, puis
  restante détachée par une bordure haute en ambre, et si abandon, encart ambre avec le motif ;
  panneau **Signatures** (rôle, nom, horodatage mono, badge d'état) ; panneau **Chaîne de reprise**
  (origine → fiche courante, une seule reprise possible par fiche d'origine).

Règles à faire respecter par l'UI : champs dérivés jamais saisissables
(`surface_traitee_ha`, `surface_cumulee_ha`, `surface_restante_ha`, `total_pesticide_l`,
`nb_rotations`) ; `surface_restante_ha > 0` ⇒ abandon oui/non, et si oui motif obligatoire ;
matrice de signatures « un rôle ne signe que si son champ est renseigné », l'agent encadreur ne
signe jamais ; après validation la fiche est immuable (`statut = validee`).

API (complète, ne pas la réinventer) : `GET /traitements` (filtres `type_traitement`,
`prospection_id`, `chef_equipe_id`, `reprenable`), `POST /traitements`, `GET /traitements/{id}`,
`POST|PUT|DELETE /traitements/{id}/rotations[/{id}]`, `POST|DELETE /traitements/{id}/produits[/{id}]`,
`POST /traitements/{id}/valider`, `POST /traitements/sync`. Erreurs à traiter : 403 rôle,
404 prospection / fiche d'origine, 409 numéro en conflit ou fiche déjà reprise ou verrouillée,
422 règle métier.

### 8. Fiche de vol & relevé météo — **à construire, backend inexistant**
Grille `1fr 1fr`.
- Gauche : carte **Fiche de vol · VOL‑2026‑0042** (sous-titre aéronef · pilote · base · date),
  tableau vol / décollage → atterrissage / durée / n° cuve / rapprochement (badge). Pied de carte
  ambre : « Le vol V4 n'a pas de rotation correspondante… » + bouton « Rapprocher »
  (`#fdf6e7`, bordure `#f0e2bf`, texte `#8a6d2f`). Puis panneau `#eaf2ec` à 3 colonnes :
  heures de vol `4 h 25`, pesticide embarqué `1 060 l`, rotations rapprochées `3 / 4` (en ambre).
- Droite : carte **Relevé météo · station ST‑014** (« Saisie quotidienne — conditionne
  l'autorisation de traitement »), tableau date / T° min / T° max / pluie (mm) / vent (m/s, en
  ambre au-delà du seuil) / traitement (badge autorisé-déconseillé). Encart ambre :
  « au-delà de 5 m/s de vent ou en cas de pluie le jour même, le traitement est déconseillé et la
  fiche porte un avertissement ».
- Le rapprochement se fait par **n° de cuve** entre vols et rotations aériennes.

### 9. Synthèses & export
Barre de filtres : période (`2026‑07‑01 → 2026‑08‑15`), groupement (chips espèce / station / mois),
boutons « Export CSV » (secondaire) et « Export rapport PDF » (`#235a36`).
Grille `1.4fr 1fr` : tableau *Agrégats par espèce* (espèce en italique, fiches, individus, densité
moyenne, surface infestée en vert) ; à droite carte *Couverture du traitement* (barres de progression
`height 6px`, rayon `4px`, piste `#f1ecdd`) et encart `#eaf2ec` décrivant le contenu de l'export
(une ligne par fiche, UTF‑8 avec BOM, séparateur « ; »). Existant : `SynthesesPage.tsx` +
`lib/prospection-syntheses.ts`.

### 10. Utilisateurs & stations
Deux onglets + bouton d'ajout contextuel (`#235a36`) aligné à droite.
- *Utilisateurs* : nom, email (mono), rôle (badge), station, fiches (mono, droite), actif
  (interrupteur `34×19`, rayon `12px`, pastille `15px` blanche ; actif = `#235a36`).
- *Stations* : code (mono vert), station, aire protégée, coordonnées (mono), prospections, état (badge).
Existant : `UsersPage.tsx` et `StationPage.tsx` — à réunir en un écran à onglets.

### 11. Référentiels — **à construire, écritures API absentes**
Grille `216px 1fr`.
- Colonne gauche : label « 7 référentiels » puis 7 cartes de navigation (`padding 11px 13px`,
  bordure `1.5px`, rayon `10px`) : libellé, nom de table en mono `10px`, pastille d'état API,
  compteur. Ordre : pesticides, cultures, codes stades, postes acridiens, stations fixes,
  utilisateurs équipe, campagnes.
- Colonne droite : carte d'en-tête (titre `800 17px`, nom de table, badge d'état API, description,
  encart ambre facultatif signalant l'écart backend) ; carte **Enregistrements** (bouton d'ajout
  vert, colonnes propres à l'entité, interrupteur Actif, « Mis à jour » en mono à droite, ligne
  sélectionnée marquée par `box-shadow: inset 3px 0 0`), pied de carte : « Désactiver plutôt que
  supprimer : le pull hors-ligne ne transporte que des upserts ». Puis grille `1fr 320px` :
  formulaire **Modifier** (champs sur 2 colonnes, hint ambre sous les champs concernés,
  interrupteur Actif, boutons Enregistrer / Annuler) et panneau `#eaf2ec` **Fraîcheur terrain**
  (date du dernier pull, bouton « Voir les agents en retard »).

Écarts backend visibles dans la maquette, à ne pas masquer :
- Seules lectures existantes : `GET /postes-acridiens`, `GET /stations`, `GET /stations/{id}`,
  `GET /referentiel/pull`. **Aucune écriture** pour pesticide, culture, code_stade,
  utilisateur_equipe, poste_acridien, station_fixe. Seul `campagne` a un CRUD complet.
- `pesticide` ne porte que `code`, `nom`, `actif` : la *matière active* et la *dose de référence*
  affichées n'ont pas de colonne.
- `culture` et `code_stade` sont synchronisées dans le SQLite mobile mais **jamais lues**
  (`listCultures()` n'existe pas dans `referentiel-db.ts`) : dégâts sur culture, zones exposées,
  stades et phases restent codés en dur.

---

## Interactions & comportement
- Navigation : React Router, routes en clair (voir Lots). Ligne de tableau entière cliquable
  (curseur `pointer`), pas de bouton isolé.
- Onglets : état local, pas de route dédiée (traitements, utilisateurs).
- Filtres : `useSearchParams` pour que la vue soit partageable.
- Chargement : squelettes respectant la hauteur des lignes (`hint-placeholder-count` de la maquette :
  6 lignes pour les listes, 4–5 pour les panneaux) — pas de spinner plein écran.
- Erreurs : bandeau ambre en tête de carte, message serveur repris tel quel.
- Vide : phrase dans la couleur `#9a9484`, jamais de carte vide.
- Hover : ligne de tableau `#faf7ef` ; bouton primaire `#1a4429` ; lien souligné.
- Aucune animation autre que la transition de couleur (`120ms ease`).
- Écran de référence `1440` px, dégradation propre jusqu'à `1180` px ; pas de vue mobile
  (le terrain a son application dédiée).

## Fichiers de ce bundle
- `Prototype Web IFVM.dc.html` — les 11 écrans (référence visuelle)
- `support.js` — runtime nécessaire pour ouvrir la maquette
- `PROMPT.md` — prompt à coller dans Claude Code, découpé en lots
