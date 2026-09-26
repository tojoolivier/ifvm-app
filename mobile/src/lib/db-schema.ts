import type { Migration } from './db-migrations';
import { appliquerBaseline } from './db-baseline';
import { PROSPECTION_DDL } from './prospection-schema';

/**
 * Schéma des données saisies sur l'appareil (#676) : traitements, vols,
 * saisies de site aérien et de stock. Le référentiel n'en fait pas partie (cache jetable, #675).
 *
 * Ajouter un changement = ajouter une étape à la fin, numéro suivant, en SQL direct :
 *
 *   { version: 2, nom: 'prospection-note', up: (db) => db.execAsync('ALTER TABLE prospection ADD COLUMN note TEXT') }
 *
 * Jamais d'introspection, jamais de modification d'une étape publiée. Un champ échangé avec le
 * backend impose ensuite `npm run generate:api-types` puis `npm run check:schema-drift`.
 */
export const MIGRATIONS_CAPTURES: readonly Migration[] = [
  {
    version: 1,
    nom: 'schema-de-base',
    up: appliquerBaseline,
  },
  {
    // Ancien module Prospection supprimé (#726), avant sa réécriture (#681) : on ne migre aucun
    // brouillon. `traitement.prospection_id` n'a pas de clé étrangère, donc rien d'autre à toucher.
    version: 2,
    nom: 'suppression-tables-prospection',
    up: async (db) => {
      await db.execAsync(`
        DROP TABLE IF EXISTS prospection_operation_aerienne;
        DROP TABLE IF EXISTS prospection_infestation;
        DROP TABLE IF EXISTS prospection_population;
        DROP TABLE IF EXISTS prospection_capture;
        DROP TABLE IF EXISTS prospection;
      `);
    },
  },
  {
    // Stockage de la réécriture (#722) : corps JSON typé par le contrat OpenAPI, cf. `prospection-schema.ts`.
    version: 3,
    nom: 'stockage-prospection',
    up: (db) => db.execAsync(PROSPECTION_DDL),
  },
  {
    // Filtre « Qu'avez-vous observé ? » (#701) : état d'écran du brouillon, jamais envoyé au serveur, donc hors
    // contrat OpenAPI. Un JSON par fiche (1:1, jamais filtré par morceaux en SQL) ; NULL = étape pas encore faite.
    version: 4,
    nom: 'prospection-filtre-observation',
    up: (db) => db.execAsync('ALTER TABLE prospection ADD COLUMN filtre_observation TEXT'),
  },
];
