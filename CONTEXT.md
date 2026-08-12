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
| Fiche de vol | — | Journal journalier d'un aéronef (1 vol = 1 CRT) | À chaque vol | Vol effectué |

### Chaînes de déclenchement

```
Campagne → Prospection Intensive → Équipe analyse → Prospection Extensive
Agriculteur → Signalement → Prospection de Validation
```

### Clarification terminologique

- **Prospection de validation** : type de prospection déclenchée par un **signalement d'agriculteur ou non-specialiste**. Vérification sur le terrain si le signalement est réel. Station `ponctuelle`.
- **Validation de fiche** : workflow en 3 étapes (voir ci-dessous). À ne pas confondre avec "prospection de validation".
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

```
Région
  └── District
        └── Commune rurale (C/R)
              └── Poste Acridien (PA)  ← entité de gestion IFVM
                    ├── Station fixe       (prospection intensive)
                    ├── Station ponctuelle (prospection extensive / validation)
                    └── Station météo      (référentiel distinct)
```

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
- Codes stades d'espèces (LMC: A1-A5, NSE: L1-L7)

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
  │                          └── stade contraint par espece : LMC ⇒ A1-A5, NSE ⇒ L1-L7
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

fiche_vol → traitement (1-1, hors périmètre — future table)
  ├── fiche_vol_passage   (jusqu'à 20 passages/jour)
  ├── fiche_vol_cumul     (jour / décade / campagne)
  └── fiche_vol_pesticide
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
| `docs/services/mobile-app/overview.md` | Vue d'ensemble du service mobile |
| `docs/services/mobile-app/runbooks/development.md` | Procédures de développement mobile |
