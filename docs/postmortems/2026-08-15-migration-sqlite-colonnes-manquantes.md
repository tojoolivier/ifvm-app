# Postmortem — colonnes SQLite manquantes sur devices existants (iOS)

**Date** : 2026-08-15
**Sévérité** : bloquant terrain (crash `FunctionCallException` à l'ouverture de la prospection / création traitement)
**Détecté par** : rapport utilisateur (console error iOS), erreurs `FI-2026080x-*` en boucle

## Symptôme

Sur des devices iOS, `prepareAsync` échouait avec `SQLiteErrorException: Error code 1: no such column: surface_totale`, puis (après le premier correctif) `no such column: surface_station`. Aucun crash observé côté Android.

## Cause racine

`mobile/src/lib/prospection-db.ts` crée le schéma en deux temps :
1. `CREATE TABLE IF NOT EXISTS` — s'exécute uniquement si la table n'existe pas encore sur l'appareil.
2. `migrate<Table>Table()` — lit `PRAGMA table_info()` et exécute des `ALTER TABLE ADD COLUMN` pour chaque colonne listée manuellement dans un tableau `columnsToAdd`.

Le bug : à chaque ajout de colonne au `CREATE TABLE`, il faut aussi l'ajouter à la liste `columnsToAdd` de la fonction de migration correspondante. Cinq colonnes ont été ajoutées au DDL sans être répercutées dans la migration :

| Colonne | Table | Ajoutée au DDL | Fonction de migration | Oubliée depuis |
|---|---|---|---|---|
| `surface_totale` | `prospection_infestation` | avant 08-12 | `migrateInfestationTable` | création de la fonction |
| `surface_station`, `surface_prospectee`, `surface_infestee` | `prospection` | avant 07-11 | `migrateProspectionTable` | création de la fonction |
| `methode` | `prospection_population` | commit `0fc8ec4c` (2026-07-31) | `migratePopulationTable` (créée `25dee12b`, 2026-08-03 — donc *après* `methode`) | création de la fonction |

## Pourquoi iOS et pas Android ?

Ce n'est pas un bug de plateforme. `CREATE TABLE IF NOT EXISTS` ne recrée jamais une table existante, donc seul un appareil dont la base SQLite a été **créée avant** l'ajout d'une colonne au DDL peut être affecté — et seulement si la migration correspondante est incomplète. Les devices Android de test avaient une app réinstallée / données effacées plus récemment que le device iOS incriminé, donc leur base a été créée fraîche avec le schéma complet et n'a jamais eu besoin de passer par la migration incrémentale (qui, elle, était buggée). Un appareil Android avec une installation ancienne aurait été tout autant affecté.

## Correctif

Ajout des 5 colonnes manquantes aux `columnsToAdd` de `migrateProspectionTable`, `migrateInfestationTable`, `migratePopulationTable` dans `mobile/src/lib/prospection-db.ts`. Au prochain lancement, `PRAGMA table_info` détecte l'absence et applique l'`ALTER TABLE` sur les bases existantes — aucune perte de données, aucune réinstallation nécessaire côté terrain.

## Action de fond (pas encore faite)

Le `CREATE TABLE` (source de vérité "nouvelle install") et les fonctions `migrate*Table` (source de vérité "mise à jour incrémentale") sont deux listes de colonnes maintenues à la main, sans garde-fou qui empêche la divergence. Le même pattern s'est déjà reproduit 3 fois sur des colonnes/tables différentes. Options à évaluer :
- un test qui diff les colonnes du DDL `CREATE TABLE` contre celles listées dans la fonction `migrate*Table` correspondante, et échoue si une colonne du DDL n'est pas couverte par une entrée de migration ;
- ou remplacer le patron `columnsToAdd` manuel par une dérivation automatique depuis le DDL (parser les noms de colonnes du `CREATE TABLE` et générer les `ALTER TABLE ADD COLUMN IF NOT EXISTS` correspondants, si le driver SQLite le permet).

Tant que ce garde-fou n'existe pas, tout PR qui ajoute une colonne à une table déjà migrée quelque part (`prospection`, `prospection_infestation`, `prospection_population`) doit vérifier manuellement que la colonne est aussi ajoutée à la fonction `migrate*Table` correspondante.
