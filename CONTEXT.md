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
| Prospection extensive | — | Relevé rapide multi-stations (2 par fiche papier) | Quotidien terrain | Résultats de l'intensive (équipe surveillance) |
| Prospection de validation | — | Vérification d'un signalement | À la demande | Signalement agriculteur/non-specialiste |
| Relevé météorologique | — | Données journalières par station météo | Quotidien | Quotidien |
| Compte-rendu de traitement | CRT | Rapport d'une opération de traitement | À chaque traitement | Décision de traitement |
| Fiche de vol | — | Journal journalier d'un aéronef (1 vol = 1 CRT) | À chaque vol | Vol effectué |

### Chaînes de déclenchement

```
Campagne → Prospection Intensive → Équipe analyse → Prospection Extensive
Agriculteur → Signalement → Prospection de Validation
```

### Clarification terminologique

- **Prospection de validation** : type de prospection déclenchée par un **signalement d'agriculteur ou non-specialiste**. Vérification sur le terrain si le signalement est réel. Station `ponctuelle`.
- **Validation de fiche** : workflow en 3 étapes (voir ci-dessous). À ne pas confondre avec "prospection de validation".

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
  ├── statut: brouillon | en_attente | verifiee | validee | rejetee
  ├── statut_sync: local | synced | conflict
  ├── vegetation       (JSONB : 7 strates × attributs ORPAD — intensive, archival)
  ├── sol              (JSONB : humidité + texture — intensive, archival)
  ├── prospection_population (densités diffuses/groupées, captures, accouplement, ponte)  [queryable]
  ├── prospection_capture    (espece × categorie × sexe? × phase × stade × effectif)      [queryable]
  │                          └── sexe NULL pour extensive/validation (absorbe les 2 granularités)
  └── prospection_infestation (taches, bandes, vols, essaims)                             [queryable]

audit_log
  ├── fiche_type (intensive | extensive | validation | crt | vol | meteo)
  ├── fiche_id
  ├── auteur_id → utilisateur
  ├── action (creation | modification | soumission | verification | validation | rejet | commentaire)
  ├── details (JSON ou texte)
  └── created_at

compte_rendu_traitement (CRT)
  ├── → prospection  (obligatoire ; quel que soit le type_prospection)
  ├── crt_point_gps    (périmètre + 1ère passe)
  ├── crt_cible_espece
  ├── crt_zone_cible   (cultures, pâturage, apiculture…)
  ├── crt_moyens_humains
  ├── crt_moyens_materiels
  ├── crt_pesticide
  ├── crt_non_cible
  └── crt_habitat_proximite

fiche_vol → CRT (1-1)
  ├── fiche_vol_passage   (jusqu'à 20 passages/jour)
  ├── fiche_vol_cumul     (jour / décade / campagne)
  └── fiche_vol_pesticide
```

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
| `docs/adr/ADR-004-mobile-scaffolding.md` | Choix techniques du scaffolding mobile |
| `docs/services/mobile-app/overview.md` | Vue d'ensemble du service mobile |
| `docs/services/mobile-app/runbooks/development.md` | Procédures de développement mobile |
