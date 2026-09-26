/**
 * Schéma local des fiches de prospection (#722), écrit par la migration 3 de `db-schema.ts`.
 *
 * Choix : **le contrat OpenAPI reste la seule description des champs**. Une fiche est stockée comme
 * son corps JSON (`ProspectionCreate` sans ses listes), ses populations / captures / infestations /
 * opérations aériennes comme un JSON par ligne (`PopulationCreate`, …). Un champ ajouté côté backend
 * arrive donc avec `npm run generate:api-types`, sans colonne à recopier ni migration — la dérive
 * « colonne oubliée côté mobile » (bug `phase`) ne peut plus se produire sur le corps.
 *
 * Ne sont des colonnes que ce que SQL doit filtrer, trier ou joindre : l'état (`statut`,
 * `statut_sync`), la revalidation (`revalide_de_id`, `validated_at`) et quelques clés de lecture.
 * `check:schema-drift` vérifie que chaque colonne « miroir » est bien un champ du contrat.
 */
export const PROSPECTION_DDL = `
    CREATE TABLE IF NOT EXISTS prospection (
      id TEXT PRIMARY KEY NOT NULL,
      type_prospection TEXT NOT NULL,
      campagne_id TEXT NOT NULL,
      equipe_id TEXT NOT NULL,
      station_id TEXT,
      n_fiche TEXT,
      date_prospection TEXT NOT NULL,
      statut TEXT NOT NULL DEFAULT 'brouillon',
      statut_sync TEXT NOT NULL DEFAULT 'local',
      revalide_de_id TEXT,
      vol_id TEXT,
      validated_at TEXT,
      server_updated_at TEXT,
      corps TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Une fiche n'est revalidée qu'une fois (même garde que l'index partiel du serveur).
    CREATE UNIQUE INDEX IF NOT EXISTS uq_prospection_revalide_de_id
      ON prospection(revalide_de_id) WHERE revalide_de_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS ix_prospection_statut ON prospection(statut, statut_sync);

    CREATE TABLE IF NOT EXISTS prospection_population (
      prospection_id TEXT NOT NULL REFERENCES prospection(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      espece TEXT NOT NULL,
      categorie TEXT NOT NULL,
      corps TEXT NOT NULL,
      PRIMARY KEY (prospection_id, position)
    );

    CREATE TABLE IF NOT EXISTS prospection_capture (
      prospection_id TEXT NOT NULL REFERENCES prospection(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      espece TEXT NOT NULL,
      corps TEXT NOT NULL,
      PRIMARY KEY (prospection_id, position)
    );

    CREATE TABLE IF NOT EXISTS prospection_infestation (
      prospection_id TEXT NOT NULL REFERENCES prospection(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      type_cible TEXT NOT NULL,
      corps TEXT NOT NULL,
      PRIMARY KEY (prospection_id, position)
    );

    CREATE TABLE IF NOT EXISTS prospection_operation_aerienne (
      prospection_id TEXT NOT NULL REFERENCES prospection(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      type_operation TEXT NOT NULL,
      corps TEXT NOT NULL,
      PRIMARY KEY (prospection_id, position)
    );
`;
