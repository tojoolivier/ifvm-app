# Issue 01 — Modèle de données : prospection unifiée, statuts et audit log

**Status:** ready-for-agent  
**Priority:** high  
**Depends on:** none

## Description

Mettre en place le modèle de données du domaine prospection en **fusionnant les trois types**
(intensive, extensive, validation) dans **une seule table `prospection`** discriminée par
`type_prospection`, plutôt que d'avoir une table dédiée par type.

Raison de la fusion (re-challenge de la modélisation initiale `prospection_intensive`) :
- Les trois fiches partagent le même tronc (références, densités, captures, infestation).
- L'intensive est une version **plus détaillée** ; l'extensive et la validation sont **plus légères**
  (parfois de simples résumés).
- Une table unique évite de tripler le tronc commun et la logique de statut/sync, et n'impose
  qu'un seul chemin de synchronisation mobile→serveur.

Le détail propre à un type vit soit dans des **colonnes nullables** du master, soit dans des
**tables enfants** (normalisées si on veut requêter dessus, JSONB si c'est de l'archivage).

Cette issue ajoute aussi les colonnes de **workflow de validation** (statut, audit) portées par le master.

## Schéma cible

### Table `prospection` (master, commun aux 3 types)

| Colonne | Type | Notes |
|---------|------|-------|
| id | UUID PK | `gen_random_uuid()` |
| type_prospection | TEXT NOT NULL | CHECK `('intensive','extensive','validation')` |
| campagne_id | UUID FK → campagne | **NOT NULL** — toujours la campagne en cours (tous types, y c. validation) |
| prospecteur_id | UUID FK → utilisateur | NOT NULL (créateur) |
| station_id | UUID FK → station | nullable (fixe pour intensive) |
| n_releve | TEXT | nullable |
| n_fiche | TEXT | nullable |
| n_message | TEXT | nullable (extensive) |
| date_prospection | DATE NOT NULL | |
| latitude | NUMERIC | nullable (relevé ponctuel) |
| longitude | NUMERIC | nullable |
| altitude | NUMERIC | nullable (intensive) |
| biotope | TEXT | nullable (type de station, extensive) |
| surf_station | NUMERIC | nullable (ha) |
| surf_prospectee | NUMERIC | nullable (ha) |
| surf_infestee | NUMERIC | nullable (ha) |
| degats_cultures | TEXT | nullable — CHECK `('nuls','faibles','moyens','forts')` |
| derniere_pluie | DATE | nullable (extensive) |
| intensite_pluie | TEXT | nullable (extensive) |
| vegetation | JSONB | nullable — 7 strates × attributs ORPAD (intensive, archival) |
| sol | JSONB | nullable — humidité + texture (intensive, archival) |
| ennemis_naturels | TEXT | nullable |
| observations | TEXT | nullable |
| statut | TEXT NOT NULL DEFAULT `'brouillon'` | CHECK `('brouillon','en_attente','verifiee','validee','rejetee')` |
| statut_sync | TEXT NOT NULL DEFAULT `'local'` | CHECK `('local','synced','conflict')` |
| verified_by | UUID FK → utilisateur | nullable |
| verified_at | TIMESTAMPTZ | nullable |
| validated_by | UUID FK → utilisateur | nullable |
| validated_at | TIMESTAMPTZ | nullable |
| created_at | TIMESTAMPTZ NOT NULL DEFAULT `now()` | |
| updated_at | TIMESTAMPTZ NOT NULL DEFAULT `now()` | `onupdate` |

> Les colonnes `vegetation` et `sol` sont en **JSONB** (hybride assumé) : jamais filtrées par
> strate/texture individuelle, uniquement affichées/archivées. Tout ce qui doit être **requêté/agrégé**
> (densités, comptages par phase) vit dans les tables enfants normalisées ci-dessous.

### Table `prospection_population` (densités niveau population — queryable)

Une ligne par (prospection × espèce × catégorie).

| Colonne | Type | Notes |
|---------|------|-------|
| id | UUID PK | |
| prospection_id | UUID FK → prospection | NOT NULL, ON DELETE CASCADE |
| espece | TEXT NOT NULL | CHECK `('LMC','NSE')` |
| categorie | TEXT NOT NULL | CHECK `('imago','larve')` |
| densite_diffuse | NUMERIC | nullable (/ha) |
| densite_groupee | NUMERIC | nullable (/m²) |
| captures_nombre | INTEGER | nullable |
| temps_capture | INTEGER | nullable (minutes, intensive) |
| accouplement | TEXT | nullable — CHECK `('neant','rare','peu','beaucoup','dominant')` |
| ponte | TEXT | nullable — même échelle |

Contrainte : `UNIQUE (prospection_id, espece, categorie)`.

### Table `prospection_capture` (matrice de comptage — queryable, absorbe les 2 granularités)

Une ligne par cellule de comptage. `sexe` NULL pour l'extensive/validation.

| Colonne | Type | Notes |
|---------|------|-------|
| id | UUID PK | |
| prospection_id | UUID FK → prospection | NOT NULL, ON DELETE CASCADE |
| espece | TEXT NOT NULL | CHECK `('LMC','NSE')` |
| categorie | TEXT NOT NULL | CHECK `('imago','larve')` |
| sexe | TEXT | **nullable** — CHECK `('F','M')` (rempli en intensive, NULL en extensive) |
| phase | TEXT NOT NULL | CHECK `('solitaire','solitaro_trans','transiens','gregaire')` |
| stade | TEXT NOT NULL | VARCHAR libre contrôlé : `A1..A5`, `A3-1/4..A3-4/4`, `L1..L7` |
| effectif | INTEGER NOT NULL DEFAULT 0 | |

> `stade` est un VARCHAR (et non un ENUM rigide) car l'intensive ajoute les sous-stades
> `A3-1/4 … A3-4/4` et les larves `L6/L7` absents de l'extensive.
>
> **Contrainte métier** : le préfixe de `stade` est déterminé par l'**espèce** —
> `LMC ⇒ A1-A5` (+ sous-stades), `NSE ⇒ L1-L7`. À garantir par validation applicative
> (un CHECK SQL croisé `espece`/`stade` est possible mais lourd à maintenir vu les sous-stades).

### Table `prospection_infestation` (taches / bandes / vols / essaims — queryable)

| Colonne | Type | Notes |
|---------|------|-------|
| id | UUID PK | |
| prospection_id | UUID FK → prospection | NOT NULL, ON DELETE CASCADE |
| espece | TEXT | nullable — CHECK `('LMC','NSE')` |
| type_cible | TEXT NOT NULL | CHECK `('tache_larvaire','bande_larvaire','vol_clair','essaim')` |
| taille_min / taille_max / taille_moy | NUMERIC | nullable |
| surface_tot | NUMERIC | nullable (ha) |
| densite_min / densite_max / densite_moy | NUMERIC | nullable |
| interdistance | NUMERIC | nullable (m) |
| comportement | TEXT | nullable — CHECK `('repos','deplacement')` |
| direction_de / direction_vers | TEXT | nullable |
| vent_de | TEXT | nullable |
| vent_vitesse | NUMERIC | nullable |

### Table `audit_log` (générique, non liée à un seul type de fiche)

| Colonne | Type | Notes |
|---------|------|-------|
| id | UUID PK | |
| fiche_type | TEXT NOT NULL | `('intensive','extensive','validation','crt','vol','meteo')` |
| fiche_id | UUID NOT NULL | (pas de FK : générique multi-tables) |
| auteur_id | UUID FK → utilisateur | NOT NULL |
| action | TEXT NOT NULL | CHECK `('creation','modification','soumission','verification','validation','rejet','commentaire')` |
| details | JSONB | nullable (champs modifiés, commentaire…) |
| created_at | TIMESTAMPTZ NOT NULL DEFAULT `now()` | |

### Index

- `prospection (type_prospection, statut)` — listing filtré par type + statut
- `prospection (campagne_id)`
- `prospection (prospecteur_id)`
- `prospection_population (prospection_id)`, `prospection_capture (prospection_id)`, `prospection_infestation (prospection_id)`
- `audit_log (fiche_type, fiche_id)`

## Acceptance Criteria

- [ ] Table `prospection` créée (master unifié, colonne `type_prospection` + workflow `statut`/`statut_sync` + `campagne_id`, `verified_by/at`, `validated_by/at`)
- [ ] Tables enfants `prospection_population`, `prospection_capture`, `prospection_infestation` créées avec FK `ON DELETE CASCADE`
- [ ] Table `audit_log` créée avec tous les champs
- [ ] Contraintes CHECK sur `type_prospection`, `statut`, `statut_sync`, `degats_cultures`, `espece`, `categorie`, `phase`, `sexe`, `action`
- [ ] `vegetation` et `sol` en JSONB sur le master
- [ ] Migration Alembic créée et testée (suit le pattern `0002_add_campagne.py`)
- [ ] Modèles SQLAlchemy mis à jour (Infrastructure layer) — `ProspectionModel` + enfants
- [ ] Domaine `Prospection` mis à jour (Domain layer)

## Technical Notes

- Suivre le pattern existant dans `backend/app/infrastructure/campagne_model.py` (SQLAlchemy 2.0 `Mapped`/`mapped_column`).
- Réutiliser les conventions de `backend/alembic/versions/0001_initial.py` : `gen_random_uuid()`, `TIMESTAMP(timezone=True)`, CHECK constraints nommées (`ck_<table>_<col>`).
- `audit_log` est générique : `fiche_id` n'a **pas** de FK (il référence plusieurs tables selon `fiche_type`).
- Le workflow (statut) de **cette** PRD ne concerne que l'intensive ; les colonnes vivent néanmoins sur le master partagé et serviront aux autres types dans des PRD ultérieurs.
- `sexe` nullable sur `prospection_capture` est la clé qui permet à la **même** table de servir l'intensive (F/M) et l'extensive/validation (NULL).

## Testing

- Test de migration : les 5 tables sont créées correctement (upgrade puis downgrade).
- Test de contraintes : INSERT avec `type_prospection` invalide → échec ; `statut` invalide → échec ; `sexe` hors `('F','M')` → échec.
- Test de cascade : suppression d'une `prospection` supprime ses enfants.
- Test d'unicité : double `(prospection_id, espece, categorie)` dans `prospection_population` → échec.
