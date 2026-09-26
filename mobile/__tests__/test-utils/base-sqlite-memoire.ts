import { DatabaseSync } from 'node:sqlite';

import { MIGRATIONS_CAPTURES } from '../../src/lib/db-schema';

type Param = string | number | null;

/**
 * Une vraie base SQLite en mémoire derrière l'API `expo-sqlite` que les dépôts utilisent : les
 * tests de stockage exécutent le vrai SQL et les vraies migrations, au lieu de mocker chaque requête.
 */
export async function creerBaseMemoire() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  let profondeur = 0;

  const db = {
    execAsync: async (sql: string) => void sqlite.exec(sql),
    runAsync: async (sql: string, params: Param[] = []) => void sqlite.prepare(sql).run(...params),
    getAllAsync: async (sql: string, params: Param[] = []) => sqlite.prepare(sql).all(...params),
    getFirstAsync: async (sql: string, params: Param[] = []) => sqlite.prepare(sql).get(...params) ?? null,
    withTransactionAsync: async (tache: () => Promise<void>) => {
      const imbriquee = profondeur++ > 0;
      if (!imbriquee) sqlite.exec('BEGIN');
      try {
        await tache();
        if (!imbriquee) sqlite.exec('COMMIT');
      } catch (erreur) {
        if (!imbriquee) sqlite.exec('ROLLBACK');
        throw erreur;
      } finally {
        profondeur--;
      }
    },
  };

  for (const migration of MIGRATIONS_CAPTURES) {
    // Toutes les étapes, baseline comprise : elle porte les tables des autres domaines (traitement…).
    await migration.up(db as never);
  }
  return db;
}
