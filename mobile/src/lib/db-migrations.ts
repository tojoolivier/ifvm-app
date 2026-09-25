import type * as SQLite from 'expo-sqlite';

import { LocalWriteError } from './errors';
import { logger } from './logger';

const log = logger.child({ module: 'db-migrations' });

/**
 * Une étape du schéma des données saisies sur l'appareil (captures, outbox, saisies de vol et de
 * site). Une étape = un changement, numérotée à la suite de la précédente, jamais modifiée une fois
 * publiée : une base « ancienne version » doit toujours pouvoir la rejouer telle quelle.
 */
export interface Migration {
  /** 1, 2, 3… sans trou : c'est la valeur écrite dans `PRAGMA user_version`. */
  version: number;
  nom: string;
  up: (db: SQLite.SQLiteDatabase) => Promise<void>;
}

/** Les numéros doivent se suivre : un trou ou un doublon est une erreur de code, levée à l'ouverture. */
function verifierNumerotation(migrations: readonly Migration[]): void {
  migrations.forEach((migration, index) => {
    if (migration.version !== index + 1) {
      throw new Error(
        `Migration « ${migration.nom} » : version ${migration.version}, ${index + 1} attendue (numérotation sans trou).`
      );
    }
  });
}

/**
 * Applique, dans l'ordre, les étapes dont le numéro dépasse `PRAGMA user_version`.
 *
 * Chaque étape et la mise à jour de `user_version` partagent une transaction : une étape qui échoue
 * est annulée en entier, la base reste à la version précédente, et l'échec est bruyant
 * (`LocalWriteError`, ADR-012) — mieux vaut refuser d'ouvrir que d'accepter des saisies dans un
 * schéma à moitié migré. Ces données restent des jours sans réseau : elles ne se reconstruisent pas.
 *
 * Une base plus récente que le code (retour arrière d'une mise à jour OTA) n'est pas touchée : les
 * étapes n'ajoutent que du schéma, l'ancien code continue de fonctionner.
 */
export async function appliquerMigrations(
  db: SQLite.SQLiteDatabase,
  migrations: readonly Migration[]
): Promise<void> {
  verifierNumerotation(migrations);

  const ligne = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const actuelle = ligne?.user_version ?? 0;
  const derniere = migrations.length;

  if (actuelle > derniere) {
    log.event('db.migration.base-plus-recente', { actuelle, connue: derniere });
    return;
  }

  for (const migration of migrations.filter((m) => m.version > actuelle)) {
    try {
      await db.withTransactionAsync(async () => {
        await migration.up(db);
        await db.execAsync(`PRAGMA user_version = ${migration.version}`);
      });
    } catch (error) {
      throw new LocalWriteError(
        `Migration ${migration.version} « ${migration.nom} » impossible — la base reste en version ${migration.version - 1}`,
        { cause: error }
      );
    }
    log.event('db.migration.appliquee', { version: migration.version, nom: migration.nom });
  }
}
