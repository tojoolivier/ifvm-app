import { DatabaseSync } from 'node:sqlite';

import { appliquerMigrations, type Migration } from '../src/lib/db-migrations';
import { LocalWriteError } from '../src/lib/errors';

/** SQLite réel derrière l'API async d'expo-sqlite. */
function ouvrir() {
  const sqlite = new DatabaseSync(':memory:');
  const db = {
    execAsync: async (sql: string) => void sqlite.exec(sql),
    runAsync: async (sql: string, p: unknown[] = []) => void sqlite.prepare(sql).run(...(p as never[])),
    getAllAsync: async (sql: string) => sqlite.prepare(sql).all(),
    getFirstAsync: async (sql: string) => sqlite.prepare(sql).get() ?? null,
    withTransactionAsync: async (tache: () => Promise<void>) => {
      sqlite.exec('BEGIN');
      try {
        await tache();
        sqlite.exec('COMMIT');
      } catch (erreur) {
        sqlite.exec('ROLLBACK');
        throw erreur;
      }
    },
  };
  return { sqlite, db: db as never };
}

const version = (sqlite: DatabaseSync) =>
  (sqlite.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;

const creer: Migration = {
  version: 1,
  nom: 'creer',
  up: async (db) => void (await db.execAsync('CREATE TABLE fiche (id TEXT PRIMARY KEY)')),
};
const ajouter: Migration = {
  version: 2,
  nom: 'ajouter',
  up: async (db) => void (await db.execAsync('ALTER TABLE fiche ADD COLUMN note TEXT')),
};

describe('appliquerMigrations', () => {
  it('applique les étapes dans l’ordre et avance user_version', async () => {
    const { sqlite, db } = ouvrir();

    await appliquerMigrations(db, [creer, ajouter]);

    expect(version(sqlite)).toBe(2);
    expect(sqlite.prepare('PRAGMA table_info(fiche)').all()).toHaveLength(2);
  });

  it('ne rejoue pas une étape déjà appliquée et garde les lignes', async () => {
    const { sqlite, db } = ouvrir();
    await appliquerMigrations(db, [creer]);
    sqlite.exec("INSERT INTO fiche (id) VALUES ('f1')");

    await appliquerMigrations(db, [creer, ajouter]);

    expect(sqlite.prepare('SELECT id, note FROM fiche').all()).toEqual([{ id: 'f1', note: null }]);
    expect(version(sqlite)).toBe(2);
  });

  it('une étape qui échoue est annulée en entier et la base reste à la version précédente', async () => {
    const { sqlite, db } = ouvrir();
    await appliquerMigrations(db, [creer]);
    const cassee: Migration = {
      version: 2,
      nom: 'cassee',
      up: async (d) => {
        await d.execAsync('ALTER TABLE fiche ADD COLUMN a TEXT');
        await d.execAsync('ALTER TABLE inconnue ADD COLUMN b TEXT');
      },
    };

    await expect(appliquerMigrations(db, [creer, cassee])).rejects.toBeInstanceOf(LocalWriteError);

    expect(version(sqlite)).toBe(1);
    expect(sqlite.prepare('PRAGMA table_info(fiche)').all()).toHaveLength(1);
  });

  it('refuse une numérotation à trou', async () => {
    const { db } = ouvrir();

    await expect(appliquerMigrations(db, [creer, { ...ajouter, version: 3 }])).rejects.toThrow(
      /numérotation/
    );
  });

  it('laisse intacte une base plus récente que le code', async () => {
    const { sqlite, db } = ouvrir();
    await appliquerMigrations(db, [creer, ajouter]);

    await appliquerMigrations(db, [creer]);

    expect(version(sqlite)).toBe(2);
  });
});
