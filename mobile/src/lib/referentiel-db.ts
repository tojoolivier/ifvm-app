import * as SQLite from 'expo-sqlite';

import { getDb } from './prospection-db';
import { ReferentialError } from './errors';

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

export interface PosteAcridien {
  id: string;
  code: string;
  nom: string;
  zaId: string;
}

export interface StationFixe {
  id: string;
  code: string;
  nom: string;
  paId: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  commune: string;
  district: string;
  region: string;
}

/** Liste des PA actifs, triés par nom — alimente le sélecteur "Manuel" du PA. */
export async function listPostesAcridiens(): Promise<PosteAcridien[]> {
  const db = await getReferentielDb();
  return db.getAllAsync<PosteAcridien>(
    'SELECT id, code, nom, za_id as zaId FROM poste_acridien WHERE actif = 1 ORDER BY nom'
  );
}

/** Stations actives d'un PA donné — alimente le sélecteur "Manuel" de la station. */
export async function listStationsByPoste(paId: string): Promise<StationFixe[]> {
  const db = await getReferentielDb();
  return db.getAllAsync<StationFixe>(
    'SELECT id, code, nom, pa_id as paId, latitude, longitude, altitude, commune, district, region FROM station_fixe WHERE pa_id = ? AND actif = 1 ORDER BY nom',
    [paId]
  );
}

export interface StadeGrille {
  code: string;
  libelle: string;
}

/**
 * Stades d'une grille de saisie, dans l'ordre du référentiel. C'est le référentiel
 * synchronisé — et non une liste écrite en dur dans l'écran — qui décide quels stades
 * existent : une liste locale finit par diverger de ce que le backend accepte (#201).
 *
 * Toute grille valide a des stades. Un résultat vide signifie que le référentiel local
 * n'a pas encore été synchronisé, et l'erreur est typée ici plutôt que laissée à
 * l'écran : sans cela, la grille s'affiche vide et muette, et l'agent croit avoir perdu
 * sa saisie (ADR-012 — le typage se fait à la source).
 */
export async function listStadesGrille(
  espece: string,
  categorie: 'imago' | 'larve',
  sexe: 'F' | 'M' | null
): Promise<StadeGrille[]> {
  const db = await getReferentielDb();
  const stades = await db.getAllAsync<StadeGrille>(
    `SELECT code, libelle FROM code_stade
     WHERE actif = 1 AND categorie = ?
       AND (sexe IS NULL OR sexe = ?)
       AND (espece IS NULL OR espece = ?)
     ORDER BY ordre`,
    [categorie, sexe, espece]
  );
  if (stades.length === 0) {
    throw new ReferentialError(
      `Aucun stade ${categorie} connu pour ${espece} sur cet appareil.`
    );
  }
  return stades;
}

export interface Pesticide {
  id: string;
  code: string;
  nom: string;
}

/** Pesticides actifs, triés par nom — alimente les chips "Produit" des rotations/produits utilisés. */
export async function listPesticides(): Promise<Pesticide[]> {
  const db = await getReferentielDb();
  return db.getAllAsync<Pesticide>('SELECT id, code, nom FROM pesticide WHERE actif = 1 ORDER BY nom');
}

export interface UtilisateurEquipe {
  id: string;
  nom: string;
  prenom: string;
}

export type RoleUtilisateurEquipe = 'chef_de_base' | 'chef_equipe' | 'agent_encadreur';

/** Utilisateurs actifs d'un rôle donné, triés par nom — alimente les chips de sélection des écrans traitement. */
export async function listUtilisateursByRole(role: RoleUtilisateurEquipe): Promise<UtilisateurEquipe[]> {
  const db = await getReferentielDb();
  return db.getAllAsync<UtilisateurEquipe>(
    'SELECT id, nom, prenom FROM utilisateur_equipe WHERE actif = 1 AND role = ? ORDER BY nom',
    [role]
  );
}

export interface CampagneLocal {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
}

/** Campagnes connues du référentiel local — alimente `pickCurrentCampagneId` hors-ligne (ADR-007). */
export async function listCampagnesLocal(): Promise<CampagneLocal[]> {
  const db = await getReferentielDb();
  return db.getAllAsync<CampagneLocal>(
    'SELECT id, name, start_date, end_date FROM campagne ORDER BY start_date DESC'
  );
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Station active la plus proche d'une position GPS — résout le mode "Auto" du PA/station. */
export async function findNearestStation(latitude: number, longitude: number): Promise<StationFixe | null> {
  const db = await getReferentielDb();
  const stations = await db.getAllAsync<StationFixe>(
    'SELECT id, code, nom, pa_id as paId, latitude, longitude, altitude, commune, district, region FROM station_fixe WHERE actif = 1'
  );
  if (stations.length === 0) return null;

  let nearest = stations[0];
  let bestDistance = haversineKm(latitude, longitude, nearest.latitude, nearest.longitude);
  for (const station of stations.slice(1)) {
    const distance = haversineKm(latitude, longitude, station.latitude, station.longitude);
    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = station;
    }
  }
  return nearest;
}

async function migrateReferentielTables(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS poste_acridien (
      id TEXT PRIMARY KEY NOT NULL,
      code TEXT NOT NULL,
      nom TEXT NOT NULL,
      za_id TEXT,
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
      commune TEXT,
      district TEXT,
      region TEXT,
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

    -- Place d'un code de stade dans une grille de saisie. Un même code y figure
    -- plusieurs fois (A1 est un stade femelle et un stade mâle) ; espece/sexe NULL
    -- valent « toutes espèces » / « non sexé ».
    CREATE TABLE IF NOT EXISTS code_stade (
      id TEXT PRIMARY KEY NOT NULL,
      code TEXT NOT NULL,
      categorie TEXT,
      sexe TEXT,
      espece TEXT,
      libelle TEXT NOT NULL,
      ordre INTEGER NOT NULL DEFAULT 0,
      actif INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS campagne (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS referentiel_sync_meta (
      entity_type TEXT PRIMARY KEY NOT NULL,
      last_pull_at TEXT
    );
  `);

  // Installs antérieurs à l'introduction de la Zone Anti-Acridienne (ZA) et de
  // commune/district/region par station : poste_acridien/station_fixe existent déjà sans ces
  // colonnes (CREATE TABLE IF NOT EXISTS ne les touche pas) — on les ajoute au besoin.
  await addColumnsIfMissing(db, 'poste_acridien', [{ name: 'za_id', type: 'TEXT' }]);
  await addColumnsIfMissing(db, 'station_fixe', [
    { name: 'commune', type: 'TEXT' },
    { name: 'district', type: 'TEXT' },
    { name: 'region', type: 'TEXT' },
  ]);
  await migrateCodeStade(db);
}

/**
 * `code_stade` ne portait que (code, espece NOT NULL) : il ne pouvait pas décrire les
 * grilles, et refuserait désormais les stades valables pour les deux espèces
 * (espece = NULL). SQLite ne sait pas relâcher un NOT NULL — la table étant un simple
 * cache du référentiel, on la recrée et on remet son curseur à zéro pour que la
 * prochaine synchro la repeuple entièrement.
 */
async function migrateCodeStade(db: SQLite.SQLiteDatabase): Promise<void> {
  const colonnes = await db.getAllAsync<{ name: string; notnull: number }>(
    'PRAGMA table_info(code_stade)'
  );
  const espece = colonnes.find((c) => c.name === 'espece');
  const aJour = colonnes.some((c) => c.name === 'categorie') && espece?.notnull === 0;
  if (aJour) return;

  await db.execAsync(`
    DROP TABLE IF EXISTS code_stade;
    CREATE TABLE code_stade (
      id TEXT PRIMARY KEY NOT NULL,
      code TEXT NOT NULL,
      categorie TEXT,
      sexe TEXT,
      espece TEXT,
      libelle TEXT NOT NULL,
      ordre INTEGER NOT NULL DEFAULT 0,
      actif INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );
  `);
  await db.runAsync("DELETE FROM referentiel_sync_meta WHERE entity_type = 'codes_stades'");
}

async function addColumnsIfMissing(
  db: SQLite.SQLiteDatabase,
  table: string,
  columns: { name: string; type: string }[]
): Promise<void> {
  const tableInfo = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  const existing = new Set(tableInfo.map((row) => row.name));
  for (const col of columns) {
    if (!existing.has(col.name)) {
      await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${col.name} ${col.type};`);
    }
  }
}
