import * as SQLite from 'expo-sqlite';

const DB_NAME = 'ifvm.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/** Ouvre (et migre au besoin) la base locale, en la mémorisant entre appels. */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openAndMigrate();
  }
  return dbPromise;
}

/** Réservé aux tests : force la réouverture de la base au prochain `getDb()`. */
export function resetDbForTests(): void {
  dbPromise = null;
}

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);

  // ==========================================
  // 1. CRÉATION DES TABLES (si elles n'existent pas)
  // ==========================================
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS prospection (
      id TEXT PRIMARY KEY NOT NULL,
      type_prospection TEXT NOT NULL,
      campagne_id TEXT NOT NULL,
      prospecteur_id TEXT NOT NULL,
      station_id TEXT,
      n_releve TEXT,
      n_fiche TEXT,
      n_message TEXT,
      especes TEXT,
      capture_started_at TEXT,
      grilles_completees TEXT,
      date_prospection TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      altitude REAL,
      biotope TEXT,
      surf_station REAL,
      surf_prospectee REAL,
      surf_infestee REAL,
      degats_cultures TEXT,
      derniere_pluie TEXT,
      intensite_pluie TEXT,
      vegetation TEXT,
      sol TEXT,
      ennemis_naturels TEXT,
      observations TEXT,
      statut TEXT NOT NULL DEFAULT 'brouillon',
      statut_sync TEXT NOT NULL DEFAULT 'local',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prospection_capture (
      id TEXT PRIMARY KEY NOT NULL,
      prospection_id TEXT NOT NULL REFERENCES prospection(id) ON DELETE CASCADE,
      espece TEXT NOT NULL,
      categorie TEXT NOT NULL,
      sexe TEXT,
      phase TEXT NOT NULL,
      stade TEXT NOT NULL,
      effectif INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS ix_prospection_capture_prospection_id
      ON prospection_capture(prospection_id);

    CREATE TABLE IF NOT EXISTS prospection_population (
      id TEXT PRIMARY KEY NOT NULL,
      prospection_id TEXT NOT NULL REFERENCES prospection(id) ON DELETE CASCADE,
      espece TEXT NOT NULL,
      categorie TEXT NOT NULL,
      densite_diffuse REAL,
      densite_groupee REAL,
      methode TEXT,
      accouplement TEXT,
      ponte TEXT,
      UNIQUE(prospection_id, espece, categorie)
    );

    CREATE INDEX IF NOT EXISTS ix_prospection_population_prospection_id
      ON prospection_population(prospection_id);

    CREATE TABLE IF NOT EXISTS prospection_infestation (
      id TEXT PRIMARY KEY NOT NULL,
      prospection_id TEXT NOT NULL REFERENCES prospection(id) ON DELETE CASCADE,
      type_cible TEXT NOT NULL,
      taille_min REAL,
      taille_max REAL,
      taille_moy REAL,
      surface_tot REAL,
      densite_min REAL,
      densite_max REAL,
      densite_moy REAL,
      interdistance REAL,
      comportement TEXT,
      direction_vers TEXT,
      vent_de TEXT,
      vent_vitesse REAL
    );

    CREATE INDEX IF NOT EXISTS ix_prospection_infestation_prospection_id
      ON prospection_infestation(prospection_id);
  `);

  // ==========================================
  // 2. MIGRATION : Ajout des colonnes manquantes
  // ==========================================
  await migrateProspectionTable(db);
  await migrateInfestationTable(db);

  return db;
}

// ==========================================
// MIGRATION POUR LA TABLE PROSPECTION
// ==========================================
async function migrateProspectionTable(db: SQLite.SQLiteDatabase): Promise<void> {
  console.log('[Migration] Vérification des colonnes de prospection...');
  
  const tableInfo = await db.getAllAsync<{ name: string }>('PRAGMA table_info(prospection)');
  const columnNames = tableInfo.map(row => row.name);
  console.log('[Migration] Colonnes existantes:', columnNames);

  const columnsToAdd = [
    { name: 'region', type: 'TEXT' },
    { name: 'district', type: 'TEXT' },
    { name: 'commune', type: 'TEXT' },
    { name: 'za', type: 'TEXT' },
    { name: 'pa_code', type: 'TEXT' },
    { name: 'degats_cultures_pourcent', type: 'INTEGER' },
    { name: 'verdissement_pourcent', type: 'INTEGER' },
    { name: 'hauteur_herbe_cm', type: 'REAL' },
  ];

  for (const col of columnsToAdd) {
    if (!columnNames.includes(col.name)) {
      console.log(`[Migration] Ajout de la colonne ${col.name}...`);
      try {
        await db.execAsync(`ALTER TABLE prospection ADD COLUMN ${col.name} ${col.type};`);
        console.log(`[Migration] ✅ Colonne ${col.name} ajoutée`);
      } catch (error) {
        console.warn(`[Migration] ⚠️ Impossible d'ajouter ${col.name}:`, error);
      }
    } else {
      console.log(`[Migration] ⏭️ Colonne ${col.name} existe déjà`);
    }
  }
}

// ==========================================
// MIGRATION POUR LA TABLE PROSPECTION_INFESTATION
// ==========================================
async function migrateInfestationTable(db: SQLite.SQLiteDatabase): Promise<void> {
  console.log('[Migration] Vérification des colonnes de prospection_infestation...');
  
  const tableInfo = await db.getAllAsync<{ name: string }>('PRAGMA table_info(prospection_infestation)');
  const columnNames = tableInfo.map(row => row.name);
  console.log('[Migration] Colonnes existantes:', columnNames);

  const columnsToAdd = [
    { name: 'espece', type: 'TEXT' },
    { name: 'direction_de', type: 'TEXT' },
    { name: 'pullulation_nb', type: 'INTEGER' },
    { name: 'taille_long', type: 'REAL' },
    { name: 'taille_large', type: 'REAL' },
    { name: 'taille_epaisseur', type: 'REAL' },
    { name: 'essaim_en_vol', type: 'INTEGER' },
    { name: 'essaim_pose', type: 'INTEGER' },
    { name: 'type_essaim', type: 'TEXT' },
    { name: 'nb_taches_bandes', type: 'INTEGER' },
    { name: 'interdistance_m', type: 'REAL' },
    { name: 'surface_contaminee_ha', type: 'REAL' },
    { name: 'type_larve', type: 'TEXT' },
    { name: 'surf_infestee_pourcent', type: 'REAL' },
  ];

  for (const col of columnsToAdd) {
    if (!columnNames.includes(col.name)) {
      console.log(`[Migration] Ajout de la colonne ${col.name} sur prospection_infestation...`);
      try {
        await db.execAsync(`ALTER TABLE prospection_infestation ADD COLUMN ${col.name} ${col.type};`);
        console.log(`[Migration] ✅ Colonne ${col.name} ajoutée`);
      } catch (error) {
        console.warn(`[Migration] ⚠️ Impossible d'ajouter ${col.name}:`, error);
      }
    } else {
      console.log(`[Migration] ⏭️ Colonne ${col.name} existe déjà`);
    }
  }
}