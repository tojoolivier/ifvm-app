# Écarts de modèle constatés sur `/referentiels` et plan des routes d'écriture manquantes

**Contexte** : Lot 4 (#124, `docs/design_handoff_web/README.md` §11) livre `/referentiels` en
lecture seule — nav latérale sur les 7 entités du payload `GET /referentiel/pull`, colonnes
dédiées labellisées FR par entité, panneau « fraîcheur terrain ». L'AC du lot interdit d'inventer
les écritures côté client tant que le backend ne les expose pas. Cet ADR consigne (1) les deux
écarts de modèle relevés dans le code réel et (2) le plan des routes d'écriture à construire, pour
qu'une session future n'ait pas à ré-auditer le backend avant de les coder.

## Écart 1 — `PesticideModel` sans matière active ni dose de référence

`backend/app/infrastructure/referentiel_model.py:44-52` : `PesticideModel` ne porte que `id`,
`code`, `nom`, `actif`, `created_at`, `updated_at`. La maquette (et l'usage terrain — un pesticide
sans matière active ni dose n'est pas exploitable pour calculer une dose à appliquer) suppose une
matière active et une dose de référence par pesticide. Aucune colonne actuelle ne les porte, côté
DB ni côté schéma Pydantic (`PesticideSyncRead`,
`backend/app/presentation/referentiel_schemas.py:67-73`).

**Conséquence pour une future migration** : ajouter `matiere_active: str` et
`dose_reference: numeric` (avec unité — à trancher côté produit, ex. `L/ha` ou `g/ha`) sur
`pesticide`, migration Alembic dédiée + colonnes nullable au départ (pesticides existants sans
valeur) puis reconciliation terrain. Suivre `relational-and-schema-design` avant d'écrire cette
migration (CLAUDE.md).

## Écart 2 — `culture` / `code_stade` synchronisées côté mobile mais jamais lues

`mobile/src/lib/referentiel-sync.ts` écrit bien `upsertCultures` et `upsertCodesStades` dans le
cache SQLite offline (les données descendent via `GET /referentiel/pull`), mais
`mobile/src/lib/referentiel-db.ts` n'expose aucune fonction `listCultures()` / `listCodesStades()`
pour les relire. Les deux tables sont donc écrites en pure perte côté mobile — aucun écran ne les
consomme encore.

**Conséquence** : avant de brancher un écran mobile sur cultures/codes-stades (ex. sélection de
culture/stade dans une prospection), ajouter les fonctions de lecture manquantes dans
`referentiel-db.ts` — pas un écart de modèle backend, un écart d'usage côté client seulement.

## Plan des routes d'écriture manquantes

Aucune écriture n'existe aujourd'hui pour `pesticide`, `culture`, `code_stade`,
`utilisateur_equipe`, `poste_acridien`, `station_fixe` — seul `campagne` a un CRUD complet
(`backend/app/presentation/campagne_routes.py`). Règle commune à toutes les entités listées
ci-dessous, alignée sur le fait que le pull offline (`GET /referentiel/pull`) ne transporte que des
upserts et n'a aucun mécanisme de suppression : **`actif` se désactive logiquement
(`PATCH .../{id}` avec `actif: false`), jamais de suppression physique (pas de route `DELETE`)**.
Chaque entité aura donc : `GET` liste (existe déjà pour `poste_acridien`/`station_fixe`), `GET /{id}`,
`POST` (création), `PUT`/`PATCH` (mise à jour des champs, y compris `actif`).

| Entité | Routes à ajouter | Notes |
|---|---|---|
| `poste_acridien` | `POST /postes-acridiens`, `PUT /postes-acridiens/{id}` | `GET` liste + `GET /{id}` existent déjà. |
| `station_fixe` | `POST /stations`, `PUT /stations/{id}` | `GET` liste + `GET /{id}` existent déjà. |
| `utilisateur_equipe` | `POST /utilisateurs-equipe`, `PUT /utilisateurs-equipe/{id}` | Aucune route `GET` dédiée n'existe non plus — seulement via `referentiel/pull`. Prévoir une route `GET` liste si un écran de gestion doit lister sans dépendre du pull complet. |
| `pesticide` | `POST /pesticides`, `PUT /pesticides/{id}` | Bloqué tant que l'Écart 1 (matière active / dose) n'est pas tranché côté produit — coder le CRUD sans ces champs créerait une dette immédiate. |
| `culture` | `POST /cultures`, `PUT /cultures/{id}` | — |
| `code_stade` | ~~`POST /codes-stades`, `PUT /codes-stades/{id}`~~ | **Livré (#131)**, avec `GET` liste et `GET /{id}`. Voir « Ordre » ci-dessous. |

**Écart noté en passant, hors périmètre de ce plan** : `campagne` expose un `DELETE
/{campagne_id}` (`campagne_routes.py:87-97`) qui fait une suppression physique
(`DeleteCampagne`/`repository`), incohérent avec la règle « `actif` en désactivation logique,
jamais de suppression physique » adoptée ci-dessus pour les nouvelles entités. À trancher
séparément si on veut harmoniser `campagne` avec les futures routes plutôt que documenter deux
politiques différentes.

## Décision

Le Lot 4 reste strictement lecture côté client. Ce document sert de référence pour la ou les
sessions futures qui coderont les écritures ci-dessus, entité par entité, chacune avec sa propre
migration Alembic (`relational-and-schema-design` avant d'écrire chaque migration) et son propre
CRUD REST suivant le modèle `campagne_routes.py`.

## Addendum #131 — la colonne « Ordre » existe déjà

L'issue #131 ouvrait la question : « la maquette affiche aussi une colonne « Ordre » (ordre
d'affichage) qui n'existe pas en base — à trancher : ajouter `ordre` à la migration, ou retirer la
colonne de l'UI ». La prémisse était fausse : `code_stade.ordre` (`Integer`, `NOT NULL`,
défaut `0`) est en base depuis la migration `0030_stade_capture_reference_code_stade.py`, il est
porté par `CodeStadeModel`, par le domaine `CodeStade` et déjà exposé par `CodeStadeSyncRead` dans
le pull hors-ligne. **Aucune migration n'était nécessaire ; la colonne reste dans l'UI**, où elle
est désormais éditable. Le tri des grilles n'est donc pas implicite : les dépôts trient par
`(categorie, sexe, ordre)`.

Deux invariants de `code_stade` sont gardés dans le use case plutôt que laissés remonter en
`IntegrityError` — `code` doit exister dans le vocabulaire `stade` (FK) et la place de grille
`(code, categorie, sexe, espece)` doit être libre (index unique `uq_code_stade_grille`). Les deux
répondent en `409`. Le schéma de lecture des routes d'administration, `CodeStadeRead`, est un
sur-ensemble de `CodeStadeSyncRead` (il ajoute `categorie`, `sexe`, `ordre`) : l'écran de gestion a
besoin des colonnes qui identifient la place de grille, que le pull n'a pas à détailler.
