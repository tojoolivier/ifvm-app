import type { Migration } from './db-migrations';
import { appliquerBaseline } from './db-baseline';

/**
 * Schéma des données saisies sur l'appareil (#676) : captures de prospection, traitements, vols,
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
];
