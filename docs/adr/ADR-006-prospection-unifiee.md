# ADR-006 — Prospection : table unique discriminée plutôt qu'une table par type

**Statut :** Accepté  
**Date :** 2026-06-24

## Contexte

Le domaine compte trois fiches de prospection : **intensive** (relevé détaillé d'une
station fixe), **extensive** (relevé rapide ponctuel) et **validation** (vérification d'un
signalement). La modélisation initiale prévoyait une table dédiée par type, en commençant
par `prospection_intensive`.

En affinant le modèle, un fait s'impose : les trois fiches partagent le **même tronc**
(références, position, densités, captures par phase/stade, infestation). L'intensive en est
la version la plus détaillée ; l'extensive et la validation sont des versions allégées,
parfois de simples résumés. Une table par type triplerait ce tronc commun ainsi que toute
la logique transverse (statut de workflow, statut de synchronisation, audit).

## Contraintes

- Un **seul chemin de synchronisation** mobile → serveur est souhaitable (cf. ADR-002).
- Le workflow de validation (statut, audit) doit pouvoir s'appliquer à n'importe quel type,
  même si la PRD courante ne l'active que pour l'intensive.
- Certaines données doivent être **requêtables/agrégées** (densités, comptages par
  phase/stade, surfaces infestées) ; d'autres ne sont jamais filtrées, seulement
  affichées/archivées (végétation par strate, sol).
- L'intensive ajoute des dimensions absentes des autres types : `sexe` (F/M) sur les
  comptages, sous-stades `A3-1/4…A3-4/4`, larves `L6/L7`.

## Décision : table unique `prospection` discriminée par `type_prospection`

Une seule table master `prospection`, discriminée par
`type_prospection ∈ ('intensive','extensive','validation')`, porte le tronc commun et
les colonnes de workflow (`statut`, `statut_sync`, `verified_by/at`, `validated_by/at`).
Le détail propre à un type vit :

- en **colonnes nullables** du master pour les attributs simples ;
- en **JSONB** sur le master pour ce qui est purement archival et jamais filtré
  (`vegetation` : 7 strates × attributs ORPAD ; `sol` : humidité + texture) ;
- en **tables enfants normalisées** pour ce qui doit être requêté :
  `prospection_population`, `prospection_capture`, `prospection_infestation`
  (FK `ON DELETE CASCADE`).

Point pivot du design : **`prospection_capture.sexe` est nullable**. La même table de
comptage sert l'intensive (F/M renseignés, sous-stades) et l'extensive/validation
(`sexe` NULL). C'est ce qui rend l'unification possible sans table de comptage par type.

Décisions de modélisation associées (voir `CONTEXT.md`) :

- `campagne_id` **NOT NULL** pour tous les types (toujours la campagne en cours).
- Position : `station_id` si elle correspond à une station connue, sinon `latitude/longitude`
  ponctuels — les deux mécanismes coexistent selon le cas.
- `stade` est un VARCHAR contrôlé, **contraint par l'espèce** (LMC ⇒ `A1-A5`, NSE ⇒ `L1-L7`),
  garanti par validation applicative plutôt que par un CHECK croisé.
- Unité d'enregistrement = le **relevé** (1 ligne) ; le « 2 par feuille » de l'extensive est
  un artefact de mise en page papier, regroupé via `n_fiche`.

## Alternatives écartées

| Alternative | Raison du rejet |
|-------------|-----------------|
| Une table par type (`prospection_intensive`, `_extensive`, `_validation`) | Triple le tronc commun et la logique statut/sync/audit ; trois chemins de sync à maintenir |
| Table master + une table « détail » par type | Garde la duplication des comptages/densités ; complexifie les requêtes d'agrégation cross-type |
| Tout en JSONB sur une seule table | Perd la capacité de requêter/agréger densités et comptages ; contraintes d'intégrité impossibles |
| Héritage SQLAlchemy (joined/single-table polymorphism) | Surcouche ORM peu lisible ; le discriminateur explicite + colonnes nullables suffit et reste transparent en SQL |

## Conséquences

- Un seul jeu de colonnes `statut_sync` (cf. ADR-002) et un seul endpoint de sync couvrent
  les trois types ; les vues par type deviennent de simples filtres `WHERE type_prospection = …`.
- Les colonnes nullables sont nombreuses ; leur pertinence par type n'est pas garantie par le
  schéma seul → la **validation applicative** porte les règles conditionnelles
  (ex. `intensive` ⇒ `vegetation`/`sol` attendus, `sexe` renseigné).
- `audit_log` reste **générique** (`fiche_type`, `fiche_id` sans FK) et couvre les trois
  types de prospection comme les autres fiches (CRT, vol, météo).
- **Dette à résorber** : ADR-002 et toute référence à `prospection_intensive`
  (ex. `fiche_conflict_archive.table_name`) doivent être repointées vers `prospection`.
- Relation `categorie` (imago/larve) ↔ `stade` laissée implicite pour l'instant ; à clarifier
  avant d'écrire les validations de saisie.
