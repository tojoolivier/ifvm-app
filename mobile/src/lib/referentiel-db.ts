import * as SQLite from 'expo-sqlite';

import { getDb } from './prospection-db';

let migrated = false;

/** Ouvre la base partagée et s'assure que les tables miroir du référentiel existent. */
export async function getReferentielDb(): Promise<SQLite.SQLiteDatabase> {
  const db = await getDb();
  if (!migrated) {
    await migrateReferentielTables(db);
    migrated = true;
  }
  return db;
}

/** Réservé aux tests : force la remigration au prochain `getReferentielDb()`. */
export function resetReferentielDbForTests(): void {
  migrated = false;
}

async function migrateReferentielTables(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS poste_acridien (
      id TEXT PRIMARY KEY NOT NULL,
      code TEXT NOT NULL,
      nom TEXT NOT NULL,
      region TEXT,
      actif INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS station_fixe (
      id TEXT PRIMARY KEY NOT NULL,
      code TEXT NOT NULL,
      nom TEXT NOT NULL,
      pa_id TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      altitude REAL,
      actif INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS ix_station_fixe_pa_id ON station_fixe(pa_id);

    CREATE TABLE IF NOT EXISTS utilisateur_equipe (
      id TEXT PRIMARY KEY NOT NULL,
      nom TEXT NOT NULL,
      prenom TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      pa_id TEXT,
      actif INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pesticide (
      id TEXT PRIMARY KEY NOT NULL,
      code TEXT NOT NULL,
      nom TEXT NOT NULL,
      actif INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS culture (
      id TEXT PRIMARY KEY NOT NULL,
      code TEXT NOT NULL,
      nom TEXT NOT NULL,
      actif INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS code_stade (
      id TEXT PRIMARY KEY NOT NULL,
      code TEXT NOT NULL,
      espece TEXT NOT NULL,
      libelle TEXT NOT NULL,
      actif INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS referentiel_sync_meta (
      entity_type TEXT PRIMARY KEY NOT NULL,
      last_pull_at TEXT
    );
  `);
}
