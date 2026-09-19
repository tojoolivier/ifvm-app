# CONTEXT — Système de gestion acridienne IFVM

## Domaine

L'**IFVM** (Ivotoerana Famongorana ny Valala eto Madagasikara) est le centre national de lutte antiacridienne de Madagascar. Ce projet informatise la chaîne terrain-bureau : collecte des données sur tablette, synchronisation vers un serveur central, consultation et analyse web.

### Deux espèces cibles

| Sigle | Espèce |
|-------|--------|
| LMC | *Locusta migratoria capito* |
| NSE | *Nomadacris septemfasciata* |
| mixte | Les deux simultanément |

### Cinq fiches terrain

| Fiche | Sigle | Rôle | Fréquence | Déclencheur |
|-------|-------|------|-----------|-------------|
| Prospection intensive | — | Relevé détaillé d'une station fixe | Hebdomadaire/campagne | Planifiée dans la campagne |
| Prospection extensive | — | Relevé rapide ponctuel (la feuille papier en répète 2 ; en base 1 relevé = 1 ligne) | Quotidien terrain | Résultats de l'intensive (équipe surveillance) |
| Prospection de validation | — | Vérification d'un signalement | À la demande | Signalement agriculteur/non-specialiste |
| Relevé météorologique | — | Données journalières par station météo | Quotidien | Quotidien |
| Compte-rendu de traitement | CRT | Rapport d'une opération de traitement (table `traitement` — voir note ci-dessous) | À chaque traitement | Décision de traitement |
| Fiche de vol | — | Journal journalier d'un aéronef, tous types de vols confondus | Quotidien (1 fiche / jour / aéronef) | Vol effectué |

### Chaînes de déclenchement

```
Campagne → Prospection Intensive → Équipe analyse → Prospection Extensive
Agriculteur → Signalement → Prospection de Validation
```

### Clarification terminologique

- **Prospection de validation** : type de prospection déclenchée par un **signalement d'agriculteur ou non-specialiste**. Vérification sur le terrain si le signalement est réel. Station `ponctuelle`.
- **Validation de fiche** : workflow en 3 étapes (voir ci-dessous). À ne pas confondre avec "prospection de validation".
- **Vol** vs **rotation** vs **fiche de vol**. Un **vol** est un déplacement unitaire de
  l'aéronef, du décollage à l'atterrissage, et porte un **type de vol**. Une **rotation**
  (`traitement_rotation`, côté CRT) est le cycle d'épandage d'**une cuve**. Ce ne sont pas le même
  fait : une rotation exige **au minimum une mise en place et une application**, donc **au moins
  deux vols**. La **fiche de vol** est le journal d'une journée pour un aéronef donné : elle
  regroupe tous ses vols, y compris ceux qui ne se rattachent à aucun traitement.
  Le terme « passage » n'est pas retenu.

- **Les cinq types de vol** :

  | Type | Définition |
  |------|-----------|
  | `PROSPECTION` | vol rattaché à une fiche de prospection |
  | `MEP` (mise en place) | du stand de remplissage jusqu'au bloc à traiter |
  | `APPLICATION` | épandage ou pulvérisation du pesticide |
  | `CONVOYAGE` | transit entre deux points (Tana → Toliara, stand → base aérienne) |
  | `DIVERS` | rinçage, maintenance aérienne, autre |

  Seuls `MEP` et `APPLICATION` se rattachent à une rotation ; `PROSPECTION` se rattache à une
  prospection ; `CONVOYAGE` et `DIVERS` ne se rattachent à rien.

- **`fiche_vol` : le nom retient la feuille, la table représente un fait.** Une fiche de vol
  regroupe les vols d'un aéronef sur **une journée** — le regroupement est déterminé par
  `(jour, aéronef)`, pas par la feuille : il existe que quelqu'un la remplisse ou non. Le nom
  est donc une **exception de vocabulaire**, retenue parce que « fiche de vol » est le mot du
  terrain, et non une exception de modélisation. Comme pour le CRT (voir `traitement`
  ci-dessous), l'identité du **document** vit dans `numero_fiche`, pas dans le nom de la table.
  Une seconde fiche le même jour pour le même appareil n'est pas censée exister ; elle n'est
  pourtant pas refusée — bloquer un pilote hors-ligne coûterait plus cher que la numéroter.

- **Base aérienne** vs **stand de remplissage**. Deux lieux distincts d'une même journée de vol,
  chacun relevé en position (lat/lon/alt captées automatiquement, hors ligne) et nommé à la main.
  Ni l'un ni l'autre n'est un **poste acridien** ou une **station fixe**.

- **Équipe aérienne** et **aéronef** (migrations 0066, 0072, 0075). Une équipe aérienne = un
  chef de base (seul compte utilisateur de l'équipe) + un pilote, un mécanicien (noms libres),
  un consultant international facultatif, des autres membres en nombre variable, et **un
  aéronef** (hélicoptère : immatriculation, société, volume de cuve — table `aeronef`,
  relation 1:1, `immatriculation` en est la clé candidate). Une équipe possède sa base
  principale (`base_aerienne.equipe_id`), ses bases secondaires (héritées de la principale) et
  ses stands (`stand_remplissage.equipe_aerienne_id`). **Seul le chef de base de l'équipe (ou
  un admin) crée ses lieux**, rattachés d'office à SON équipe (contrôle serveur, 403 sinon).
  Créer une fiche de vol commence par choisir l'équipe : chef de base, pilote, mécanicien,
  consultant, immatriculation et société de l'hélicoptère s'en déduisent (le serveur fait
  autorité et les **copie** sur la fiche — snapshot du jour, jamais recalculé), et seuls les
  lieux de cette équipe sont proposés (`LieuVolHorsEquipeError`, 422 sinon). Le référentiel de
  lieux de la fiche de vol reste `base_aerienne`/`stand_remplissage` (décision 0064), distinct
  de `lieu_aerien` (prospection/traitement).

- **Pilote** et **mécanicien** sont **externes à l'IFVM** (compagnie aérienne ou Armée malgache) :
  ce sont des noms, pas des comptes `utilisateur`. Seul le **chef de base** est un agent IFVM. Le
  **consultant international** signe lorsqu'il intervient.

- **Relevé** vs **fiche papier** : l'unité d'enregistrement en base est le **relevé** (un point, une ligne `prospection`). La feuille papier de l'extensive juxtapose **2** relevés par commodité d'impression ; en base ils deviennent **2 lignes distinctes** (regroupables via `n_fiche`).

### Workflow de validation d'une fiche intensive

**Règle métier** : une seule campagne en cours à la fois.

```
Prospecteur (app mobile)
    └── remplit et soumet la fiche
        └── Statut: "En attente"
            └── Vérificateur (autre équipe)
                └── vérifie + commentaires (audit log)
                    └── Statut: "Vérifié"
                        └── Validation finale (autre équipe, interface web)
                            ├── Valide → Statut: "Validé" ✓
                            └── Rejette → Statut: "Rejeté" ✗
```

**Statuts de fiche** : `Brouillon → En attente → Vérifié → Validé | Rejeté`

**Synchronisation** (offline/online) : axe **indépendant** du workflow de validation. Géré séparément.

**Audit log** : journal d'activité automatique, enregistre les modifications et commentaires.

**Vérificateur** : autre équipe que le prospecteur. Pas de "renvoi pour correction" — communication via commentaires dans l'audit log.

### Hiérarchie géographique

Deux axes distincts, qui se croisent au niveau de la station — à ne pas confondre :

- **Géographie administrative de Madagascar** (fixe, indépendante de l'IFVM) :
  `Région → District → Commune rurale (C/R)`.
- **Hiérarchie organisationnelle IFVM** (zones de lutte, indépendante du découpage
  administratif) : `Zone Anti-Acridienne (ZA) → Poste Acridien (PA) → Station`.

```
Zone Anti-Acridienne (ZA)         Région
  └── Poste Acridien (PA)           └── District
        ├── Station fixe                  └── Commune rurale (C/R)  ──┐
        ├── Station ponctuelle                                        │
        └── Station météo (référentiel distinct)                      │
              │                                                       │
              └── chaque station porte sa propre Commune ─────────────┘
```

**Un PA n'a pas de région/district uniques** : ses stations peuvent appartenir à des
communes, districts, voire régions administratives différents (ex. le PA "Amboasary"
a des stations en région Androy ET Anosy). La commune (et donc le district et la
région) est un attribut de la **station**, pas du PA ni de la ZA — modélisé par
`station_fixe.commune_id → commune → district → region` (voir
`docs/adr/ADR-013-referentiel-za-station-import.md` pour la justification et l'origine
des données : import réel du réseau intensif, 6 ZA / 17 PA / 97 stations fixes).

Une ZA regroupe plusieurs PA (ex. ZA "Befandriana sud" → PA "Ankaraobato",
"Tanandava") ; participation totale des deux côtés (tout PA appartient à une ZA, toute
ZA a au moins un PA observé).

---

## Architecture technique

Voir les ADR dans `docs/adr/` pour les décisions et leurs justifications.

### Stack

| Couche | Technologie |
|--------|-------------|
| Base de données centrale | PostgreSQL 16 |
| Base de données locale (tablette) | SQLite (via Expo SQLite) |
| API backend | FastAPI (Python) |
| Interface web | React + TypeScript + shadcn/ui |
| Application mobile | React Native (Expo) |

### Modèle de synchronisation

**Ownership-based sync avec versioning serveur.**
Chaque fiche appartient à son créateur. Le serveur est source de vérité. Les conflits (rare : modification simultanée terrain + serveur) sont flaggés et tranchés par l'**admin** depuis l'**interface web**.
Détail : `docs/adr/ADR-002-sync.md`.

### Contraintes offline

- **Durée max hors-ligne** : 1 semaine de campagne terrain
- **Stockage** : non limitant (~700 Ko pour 1 semaine à 10 fiches/jour)
- **Intégrité** : la transactionnalité SQLite (ACID) protège contre les écritures interrompues (crash, batterie morte)

### Données de référence pré-chargées

Avant de partir sur le terrain, l'app doit télécharger :

**Niveau 1 (indispensable)** :
- Profil utilisateur (nom, rôle, PA affecté)
- Liste des Postes Acridiens (id, code, nom)
- Stations fixes du PA du prospecteur
- Équipe (autres utilisateurs de son PA)

**Niveau 2 (indispensable)** :
- Noms de pesticides disponibles
- Types de cultures / zones cibles
- Codes stades (`code_stade`) : où chaque stade se saisit — catégorie, sexe, espèce, ordre.
  Le vocabulaire lui-même vit dans `stade`, cible de la FK `prospection_capture.stade`.
  Un même code appartient à plusieurs grilles (A1 est un stade ♀ *et* ♂) ; `espece`/`sexe`
  à NULL valent « toutes espèces » / « non sexé ». Seuls L6 et L7 sont propres à NSE.
  Les grilles de saisie du mobile se construisent depuis cette table, jamais depuis une
  liste écrite en dur — c'est cette divergence qui a fait échouer #201.

### Gestion des conflits

- **Qui tranche** : l'admin
- **Depuis où** : interface web
- **Comment** : choix d'une des deux versions OU fusion manuelle
- **Archivage** : l'autre version va dans `fiche_conflict_archive`
- Pas de rôle "superviseur" dans le système

### Application mobile — rôles et écrans

Chaque rôle a un dashboard adapté dans l'app mobile :

| Rôle | Fiches accessibles | Description |
|------|---------------------|-------------|
| `prospecteur` | Prospection extensive, Prospection intensive, Relevé météo | Remplit et soumet les fiches terrain |
| `verificateur` | Prospection intensive (vérification) | Autre équipe — vérifie les fiches soumises |
| `validation_finale` | Prospection intensive (validation web) | Autre équipe — valide ou rejette sur l'interface web |
| `chef_equipe` | CRT + toutes prospections (lecture/écriture) | Encadre l'équipe terrain |
| `agent_encadreur` | CRT (lecture seule ou co-remplissage) | Co-remplissage CRT |
| `pilote` | Fiche de vol | Pilote d'aéronef |
| `mecanicien` | Fiche de vol | Mécanicien d'aéronef |
| `chef_de_base` | Tout en lecture/écriture + validation + sync status | Supervise son PA |
| `admin` | Gestion utilisateurs + config postes acridiens + résolution conflits | Configuration système |

---

## Entités du modèle de données

```
poste_acridien
├── station (type: fixe | ponctuelle)
├── station_meteo
└── utilisateur (rôles: prospecteur, verificateur, validation_finale, chef_equipe,
                         agent_encadreur, pilote, mecanicien, chef_de_base, admin)

releve_meteo → station_meteo
  └── mesure_meteo_jour (1 ligne / jour)

prospection → station (fixe pour intensive, ponctuelle pour extensive/validation)
  ├── type_prospection: intensive | extensive | validation   (table unique discriminée)
  ├── campagne_id   OBLIGATOIRE — toujours la campagne en cours (règle « une seule campagne »)
  ├── localisation  station_id si la position correspond à une station connue,
  │                 sinon latitude/longitude ponctuels (les deux mécanismes, selon le cas)
  ├── statut: brouillon | en_attente | verifiee | validee | rejetee
  ├── statut_sync: local | synced | conflict
  ├── vegetation       (JSONB : 7 strates × attributs ORPAD — intensive, archival)
  ├── sol              (JSONB : humidité + texture — intensive, archival)
  ├── prospection_population (densités diffuses/groupées, captures, accouplement, ponte)  [queryable]
  ├── prospection_capture    (espece × categorie × sexe? × phase × stade × effectif)      [queryable]
  │                          ├── sexe NULL pour extensive/validation (absorbe les 2 granularités)
  │                          └── stade → FK vers `stade.code` (le référentiel fait autorité, cf. ci-dessous)
  └── prospection_infestation (taches, bandes, vols, essaims)                             [queryable]

audit_log
  ├── fiche_type (intensive | extensive | validation | traitement | vol | meteo)
  ├── fiche_id
  ├── auteur_id → utilisateur
  ├── action (creation | modification | soumission | verification | validation | rejet | commentaire)
  ├── details (JSON ou texte)
  └── created_at

traitement (ex-CRT — le sigle CRT désigne le compte-rendu affiché à l'utilisateur
            via numero_fiche, pas la table, qui représente l'événement de traitement
            lui-même ; voir docs/data-model-traitement-v2.md)
  ├── → prospection      (obligatoire ; quel que soit le type_prospection)
  ├── type_traitement    (AERIEN | TERRESTRE — discriminant de spécialisation disjointe totale)
  ├── zones_exposées, végétation, empoisonnement, évaluation du risque, comportement
  │   anormal, mortalité (JSONB / colonnes inchangées depuis le CRT à plat d'origine)
  ├── cible              (1-1, weak entity, snapshot à la création)
  │   └── espece (LMC | NSE | MELANGE — domaine volontairement plus large que
  │               prospection.espece, cf. note ci-dessous)
  ├── traitement_aerien  (1-1 si type_traitement=AERIEN)
  │   └── traitement_rotation (1-N, une cuve = une ligne, produit_id → pesticide)
  ├── traitement_terrestre (1-1 si type_traitement=TERRESTRE)
  │   ├── traitement_produit_utilise (1-N, produit_id → pesticide)
  │   └── traitement_origine_id (auto-réf traitement.id, reprise de traitement —
  │                               pointe vers la fiche précédente immédiate, pas la racine)
  └── traitement_signature (1-N selon rôle : PILOTE | MECANICIEN | CHEF_DE_BASE |
                             CHEF_EQUIPE | CONSULTANT_INTERNATIONAL)

fiche_vol (hors périmètre — future table ; cadrage : docs/adr/ADR-011)
  ├── 1 fiche par jour et par aéronef (compagnie, immatriculation, base aérienne,
  │   stand de remplissage, observations)
  ├── vol (1-N)   type_vol : PROSPECTION | MEP | APPLICATION | CONVOYAGE | DIVERS
  │   ├── → prospection          (si type_vol = PROSPECTION)
  │   └── → traitement_rotation  (si type_vol ∈ MEP | APPLICATION ; N:1 —
  │                               une rotation = 1 MEP + 1 application)
  └── fiche_vol_signature (1-N) — même patron que traitement_signature
                          (PILOTE | MECANICIEN | CHEF_DE_BASE | CONSULTANT_INTERNATIONAL)

  Durées de vol et cumuls (jour / semaine / mois / total) sont dérivés : jamais stockés.
```

> **Domaine `espece` : `cible` vs `prospection`.** `prospection.espece` et
> `prospection_population.espece` n'autorisent que `LMC|NSE` : une observation de terrain
> porte toujours sur une seule espèce à la fois. `cible.espece` (sur `traitement`) autorise
> en plus `MELANGE`, qui signifie que le traitement couvre une zone où **LMC et NSE sont
> présentes simultanément** — ce n'est pas une 3ᵉ espèce, c'est un fait propre à l'échelle
> du traitement (zone mixte), pas à celle de l'observation. La divergence de domaine entre
> les deux tables est donc intentionnelle, pas un oubli (le formulaire papier source a
> bien une case "Mélange" distincte de LMC/NSE).

> **Spécialisation `traitement_aerien`/`traitement_terrestre`.** Method 1 (spécialisation
> disjointe totale) : `type_traitement` est le discriminant, une ligne `traitement` a
> exactement une ligne fille correspondante. Détail complet du modèle et des décisions
> de conception dans `docs/data-model-traitement-v2.md`.

---

## Application mobile — structure technique

L'app mobile est initialisée dans `mobile/` avec Expo Router, NativeWind, et TypeScript strict.

### Structure de navigation

```
mobile/src/app/
├── _layout.tsx          # Root layout (Stack)
├── (tabs)/
│   ├── _layout.tsx      # Bottom tabs (écrans principaux)
│   ├── index.tsx        # Dashboard
│   └── explore.tsx      # Exploration
└── (auth)/
    ├── _layout.tsx      # Stack authentification
    └── login.tsx        # Page de connexion
```

### Stack technique mobile

| Composant | Technologie | Référence |
|-----------|-------------|-----------|
| Framework | Expo SDK 56 | `mobile/package.json` |
| Navigation | Expo Router (file-based) | `mobile/src/app/` |
| Styles | NativeWind v4 (Tailwind CSS) | `mobile/tailwind.config.js` |
| Types | TypeScript strict | `mobile/tsconfig.json` |
| Build | EAS Build (APK sideload) | `mobile/eas.json` |
| Variables d'env | `EXPO_PUBLIC_API_URL` | `mobile/.env` |

> **Contrat `EXPO_PUBLIC_API_URL` / `ROOT_PATH`.** En local, `EXPO_PUBLIC_API_URL=http://localhost:8000`
> (ou `http://10.0.2.2:8000` sur émulateur Android, cf. `mobile/.env`) pointe directement sur le
> backend FastAPI, qui expose ses routes **sans préfixe** (`app.include_router(..., prefix="")`
> dans `backend/app/main.py`, ex. `GET /equipes-aeriennes`, pas `/api/equipes-aeriennes`).
> En preview/production (`mobile/eas.json`), `EXPO_PUBLIC_API_URL=https://ifvm.orakotondravao.com/api`
> suppose qu'un reverse proxy placé devant le backend **retire le préfixe `/api`** avant de
> transmettre la requête à uvicorn — c'est ce même préfixe que `ROOT_PATH` (variable backend,
> cf. `.env.example`) sert uniquement à réintégrer dans les URLs générées par FastAPI (docs
> OpenAPI, redirections), pas à faire le routing lui-même (`ProxyHeadersMiddleware` d'uvicorn ne
> gère que `X-Forwarded-For`/`-Proto`, pas le strip de préfixe). **Si le reverse proxy en
> production ne retire pas `/api`, toutes les routes referentiels/fiches-vol renvoient 404**
> côté mobile (symptôme observé : `equipes-aeriennes`, `referentiels-aeriens`) — c'est une
> config d'infra externe au repo, à vérifier sur le serveur, pas un bug applicatif.

### Commandes essentielles

```bash
cd mobile
npm start          # Serveur de développement
npm test           # Tests de validation
npx tsc --noEmit   # Vérification TypeScript
```

### Documentation détaillée

| Document | Chemin |
|----------|--------|
| Service Overview | `docs/services/mobile-app/overview.md` |
| Runbook développement | `docs/services/mobile-app/runbooks/development.md` |
| ADR Scaffolding | `docs/adr/ADR-004-mobile-scaffolding.md` |

---

## Fichiers clés

| Fichier | Contenu |
|---------|---------|
| `data/sql/schema.sql` | DDL PostgreSQL complet |
| `data/sql/schema_sqlite.sql` | DDL SQLite adapté (tablette) |
| `docs/adr/ADR-001-stack.md` | Choix PostgreSQL + FastAPI + React |
| `docs/adr/ADR-002-sync.md` | Stratégie de synchronisation offline |
| `docs/adr/ADR-003-mobile.md` | React Native vs PWA |
| `docs/adr/ADR-006-prospection-unifiee.md` | Table unique discriminée pour les 3 types de prospection |
| `docs/adr/ADR-004-mobile-scaffolding.md` | Choix techniques du scaffolding mobile |
| `docs/adr/ADR-008-gestion-erreurs-mobile.md` | Hook centralisé obligatoire pour toute erreur/précondition sur écran mobile |
| `docs/adr/ADR-012-eradication-erreurs-silencieuses-mobile.md` | Jeu fermé de 7 erreurs typées, logger unifié, affichage, export des logs et lint bloquant — achève ADR-008 |
| `docs/services/mobile-app/overview.md` | Vue d'ensemble du service mobile |
| `docs/services/mobile-app/runbooks/development.md` | Procédures de développement mobile |
