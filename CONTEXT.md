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

| Fiche | Sigle | Rôle | Fréquence |
|-------|-------|------|-----------|
| Prospection extensive | — | Relevé rapide multi-stations (2 par fiche papier) | Quotidien terrain |
| Prospection intensive | — | Relevé détaillé d'une station fixe | Hebdomadaire/campagne |
| Relevé météorologique | — | Données journalières par station météo | Quotidien |
| Compte-rendu de traitement | CRT | Rapport d'une opération de traitement | À chaque traitement |
| Fiche de vol | — | Journal journalier d'un aéronef (1 vol = 1 CRT) | À chaque vol |

### Clarification terminologique

- **Prospection de validation** : type de prospection lié aux stations `ponctuelle` (signalisation) — variante de la prospection extensive. À ne pas confondre avec :
- **Validation de fiche** : acte de supervision (chef_de_base/admin approuve une fiche) — concept à définir

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

| Rôle | Fiches accessibles |
|------|---------------------|
| `prospecteur` | Prospection extensive, Prospection intensive, Relevé météo |
| `chef_equipe` | CRT + toutes prospections (lecture/écriture) |
| `agent_encadreur` | CRT (lecture seule ou co-remplissage) |
| `pilote` | Fiche de vol |
| `mecanicien` | Fiche de vol |
| `chef_de_base` | Tout en lecture/écriture + validation + sync status |
| `admin` | Gestion utilisateurs + config postes acridiens + résolution conflits |

---

## Entités du modèle de données

```
poste_acridien
├── station (type: fixe | ponctuelle)
├── station_meteo
└── utilisateur (rôles: prospecteur, chef_equipe, agent_encadreur,
                         pilote, mecanicien, chef_de_base, admin)

releve_meteo → station_meteo
  └── mesure_meteo_jour (1 ligne / jour)

prospection_extensive → station (ponctuelle)
prospection_intensive → station (fixe)
  ├── capture          (espece × stade × sexe × phase × nombre)
  ├── population_acridien (densités diffuses/groupées, accouplements, ponte)
  ├── infestation      (taches, bandes, vols, essaims)
  ├── vegetation       (7 strates × attributs ORPAD)
  ├── humidite_sol
  └── texture_sol

compte_rendu_traitement (CRT)
  ├── → prospection_extensive OU prospection_intensive  (obligatoire)
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
