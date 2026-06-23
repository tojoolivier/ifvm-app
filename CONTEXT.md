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
| Interface web | React + TypeScript |
| Application mobile | React Native (Expo) |

### Modèle de synchronisation

**Ownership-based sync avec versioning serveur.**
Chaque fiche appartient à son créateur. Le serveur est source de vérité. Les conflits (rare : supervision côté serveur + modification simultanée terrain) sont flaggés et tranchés par un superviseur.
Détail : `docs/adr/ADR-002-sync.md`.

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

## Fichiers clés

| Fichier | Contenu |
|---------|---------|
| `data/sql/schema.sql` | DDL PostgreSQL complet |
| `data/sql/schema_sqlite.sql` | DDL SQLite adapté (tablette) |
| `docs/adr/ADR-001-stack.md` | Choix PostgreSQL + FastAPI + React |
| `docs/adr/ADR-002-sync.md` | Stratégie de synchronisation offline |
| `docs/adr/ADR-003-mobile.md` | React Native vs PWA |
