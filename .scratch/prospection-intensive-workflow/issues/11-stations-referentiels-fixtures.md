# Issue 11 — Référentiels : stations fixes, postes acridiens et fixtures

**Status:** ready-for-agent
**Priority:** high
**Depends on:** 01, 02

## Problem Statement

Le formulaire de création de fiche intensive (issue 06) exige une station fixe, mais la base de données ne dispose d'aucune table `station_fixe` ni `poste_acridien`. Le champ `station_id` dans `prospection` est un UUID nu sans contrainte de clé étrangère : n'importe quelle valeur UUID est acceptée, y compris des identifiants inexistants. De plus, les tests API utilisent des UUID aléatoires pour `station_id`, ce qui ne représente pas la réalité métier. L'interface web affiche un simple champ texte pour l'UUID de la station, empêchant toute recherche ou pré-remplissage des coordonnées.

## Solution

Créer les tables de référentiel `poste_acridien` et `station_fixe`, exposer deux endpoints de lecture seule (`GET /postes-acridiens`, `GET /stations`), ajouter la contrainte FK sur `prospection.station_id`, fournir un script de fixtures qui charge les données réelles (PA et stations de Madagascar), et mettre à jour le formulaire web avec une liste déroulante recherchable qui pré-remplit les coordonnées de la station choisie.

## User Stories

1. En tant que prospecteur sur le web, je veux sélectionner ma station fixe depuis une liste déroulante avec recherche par nom ou code, pour ne pas avoir à saisir manuellement un UUID.
2. En tant que prospecteur, je veux que les coordonnées GPS (latitude, longitude, altitude) et le PA de la station soient pré-remplis automatiquement quand je choisis une station, pour éviter les erreurs de saisie.
3. En tant que prospecteur, je veux que la liste des stations soit filtrée par le PA affecté à mon compte, pour ne voir que les stations pertinentes.
4. En tant qu'administrateur, je veux que la base de données soit pré-chargée avec la liste complète des postes acridiens et des stations fixes de Madagascar dès le déploiement, pour que les équipes puissent commencer à travailler immédiatement.
5. En tant que développeur, je veux que `prospection.station_id` soit une vraie FK vers `station_fixe.id` pour les prospections intensives, pour garantir l'intégrité référentielle des données.
6. En tant que développeur, je veux des fixtures pytest réalistes (PA + stations réels) dans le conftest, pour que les tests API exercent des scénarios représentatifs.
7. En tant que développeur backend, je veux une route `GET /stations` filtrable par `pa_id` et par recherche textuelle `q`, pour alimenter la liste déroulante du formulaire web.
8. En tant que développeur backend, je veux une route `GET /postes-acridiens` listant tous les PA avec leur code, nom et région, pour alimenter un éventuel filtre par PA dans le formulaire.
9. En tant que vérificateur ou validateur sur l'interface web, je veux voir le nom de la station (et non son UUID) dans la fiche de prospection, pour comprendre rapidement le contexte géographique.
10. En tant que développeur, je veux que le script de fixtures soit réexécutable sans erreur (idempotent), pour pouvoir réinitialiser l'environnement de développement.

## Implementation Decisions

### Schéma de la table `poste_acridien`

| Colonne | Type | Notes |
|---------|------|-------|
| id | UUID PK | `gen_random_uuid()` |
| code | TEXT NOT NULL UNIQUE | Code court IFVM (ex: `PA-BL-01`) |
| nom | TEXT NOT NULL | Nom complet du poste |
| region | TEXT | Région administrative (nullable) |
| created_at | TIMESTAMPTZ | `now()` |

### Schéma de la table `station_fixe`

| Colonne | Type | Notes |
|---------|------|-------|
| id | UUID PK | `gen_random_uuid()` |
| code | TEXT NOT NULL UNIQUE | Code court (ex: `ST-BL-001`) |
| nom | TEXT NOT NULL | Nom descriptif |
| pa_id | UUID FK → poste_acridien | NOT NULL |
| latitude | NUMERIC NOT NULL | WGS84 |
| longitude | NUMERIC NOT NULL | WGS84 |
| altitude | NUMERIC | nullable, en mètres |
| actif | BOOLEAN NOT NULL DEFAULT true | Permet de désactiver une station sans la supprimer |
| created_at | TIMESTAMPTZ | `now()` |

### Contrainte FK à ajouter sur `prospection`

Ajouter `FOREIGN KEY (station_id) REFERENCES station_fixe(id)` sur la table `prospection`. Cette FK est nullable (les prospections extensives / validation n'ont pas de station fixe).

La règle métier « station obligatoire pour l'intensive » reste une validation applicative (domain layer), pas une contrainte SQL (la même colonne sert les trois types de prospection).

### Migration Alembic

Migration `0004_add_referentiel_station.py` :
1. Créer `poste_acridien`
2. Créer `station_fixe` avec FK vers `poste_acridien`
3. Ajouter la contrainte FK sur `prospection.station_id → station_fixe.id` (avec `DEFERRABLE INITIALLY DEFERRED` pour que l'ordre d'insertion en fixtures ne pose pas de problème)

### API — endpoints de lecture seule

**`GET /postes-acridiens`**
- Retourne la liste triée par `code`
- Aucun paramètre de filtre nécessaire (liste courte, ~30 PA)
- Réponse : `[{ id, code, nom, region }]`

**`GET /stations`**
- Paramètres optionnels : `pa_id` (UUID), `q` (recherche textuelle sur `code` + `nom`, insensible à la casse), `actif` (bool, défaut `true`)
- Retourne : `[{ id, code, nom, pa_id, pa_code, pa_nom, latitude, longitude, altitude }]` (jointure avec PA pour éviter un second appel)
- Trié par `code`

**`GET /stations/{station_id}`**
- Retourne la station ou 404

Ces endpoints sont en lecture seule (pas de création/modification via l'API — les stations sont gérées par fixtures/admin SQL).

### Fixtures

Script `backend/app/fixtures.py` (ou `backend/fixtures/load_stations.py`), appelable par :
```
docker compose exec backend python -m app.fixtures
```

Format source : JSON embarqué dans le script ou fichier `backend/fixtures/referentiel.json` versionné dans le dépôt.

Structure du JSON :
```json
{
  "postes_acridiens": [
    { "code": "PA-BL-01", "nom": "Bekily", "region": "Androy" }
  ],
  "stations_fixes": [
    { "code": "ST-BL-001", "nom": "Manambaro Nord", "pa_code": "PA-BL-01",
      "latitude": -24.123, "longitude": 45.678, "altitude": 320 }
  ]
}
```

Le script est **idempotent** : utilise `INSERT … ON CONFLICT (code) DO UPDATE SET …` pour chaque ligne.

Les données réelles proviennent de la conversion des fichiers FlatGeobuf présents dans `data/`. Un script de conversion one-shot (hors scope de cette issue) les extrait vers le JSON.

Pour cette issue, un jeu de données de **~5 PA et ~15 stations** représentatives suffit comme base de départ. L'import complet sera traité séparément.

### Fixtures pytest

Dans `conftest.py`, remplacer le `station_id = uuid.uuid4()` dans les tests par une fixture `station_id` qui insère une vraie `StationFixeModel` + `PosteAcridienModel` dans la base de test, et retourne son UUID.

### Frontend — liste déroulante station

Remplacer le champ texte UUID dans `NouvelleProspectionPage` par un `<select>` natif (ou une liste filtrée) alimenté par `GET /stations`. Au choix d'une station, pré-remplir `latitude`, `longitude`, `altitude` depuis les données retournées par l'API.

L'implémentation peut rester simple (select HTML + filtre côté client sur les ~200 stations d'un PA) sans nécessiter un composant combobox complexe.

## Testing Decisions

**Bonne pratique** : tester le comportement observable via l'API HTTP, pas l'implémentation interne (pas de test direct sur le repository ou le modèle SQLAlchemy).

### Tests à écrire

**`tests/test_referentiel_api.py`** (nouveau fichier, suit le pattern de `test_prospection_api.py`)

- `GET /postes-acridiens` retourne la liste (au moins 1 PA depuis les fixtures)
- `GET /stations` sans filtre retourne les stations actives
- `GET /stations?pa_id=<id>` filtre par PA
- `GET /stations?q=manambaro` retourne les stations dont le nom/code contient "manambaro" (insensible à la casse)
- `GET /stations/<id>` retourne la bonne station
- `GET /stations/<uuid_inexistant>` retourne 404
- `POST /prospections` avec un `station_id` valide (depuis fixture) → 201
- `POST /prospections` avec un `station_id` UUID inventé → 422 ou 409 (violation FK)

**Fixture pytest commune** : ajouter dans `conftest.py` :
- `fixture poste_acridien` → insère un PA, retourne le modèle
- `fixture station_fixe` → insère une station rattachée au PA, retourne le modèle
- `fixture station_id` → retourne `station_fixe.id` (remplace les `uuid.uuid4()` actuels)

Le pattern conftest existant (fixtures async sur base PostgreSQL réelle) est à réutiliser directement.

## Out of Scope

- Import automatique depuis les fichiers FlatGeobuf (`data/*.fgb`) — script de conversion séparé
- CRUD admin pour gérer les stations via l'interface web
- Stations ponctuelles (utilisées par les prospections extensives et de validation) — traitées avec l'issue extensive
- Stations météo — référentiel distinct, hors workflow prospection intensive
- Géométrie spatiale PostGIS (polygones de zones) — les coordonnées GPS point suffisent pour cette issue
- Pagination sur `GET /stations` (le nombre de stations par PA est < 200)
- Application mobile — la sync des référentiels vers SQLite est traitée dans l'issue 09

## Further Notes

- La FK sur `prospection.station_id` étant nullable, les tests existants (`test_prospection_api.py`) qui passent un `station_id` UUID aléatoire invalide devront être mis à jour pour utiliser la nouvelle fixture `station_id`.
- Le test `test_create_intensive_sans_station_id_echoue` reste valide : la validation applicative (domain layer) doit rejeter une prospection intensive sans `station_id`.
- L'endpoint `GET /stations` est public pour les utilisateurs authentifiés, aucune restriction de rôle supplémentaire.
- Prévoir `pa_code` et `pa_nom` dans la réponse `GET /stations` pour éviter un second appel au frontend (jointure côté serveur).
