import * as SQLite from 'expo-sqlite';

const DB_NAME = 'ifvm.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openAndMigrate();
  }
  return dbPromise;
}

export function resetDbForTests(): void {
  dbPromise = null;
}

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);

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
      verdissement REAL,
      hauteur_strate REAL,
      pullulation_nb INTEGER,
      interdistance REAL,
      taille_info TEXT,
      essaim_type TEXT,
      essaim_vol_dir_de TEXT,
      essaim_vol_dir_vers TEXT,
      essaim_pose INTEGER,
      surface_contaminee REAL,
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
      espece TEXT,
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
      direction_de TEXT,
      direction_vers TEXT,
      vent_de TEXT,
      vent_vitesse REAL
    );

    CREATE INDEX IF NOT EXISTS ix_prospection_infestation_prospection_id
      ON prospection_infestation(prospection_id);
  `);

  // ============================================================
  // MIGRATIONS - Ajouter les colonnes manquantes
  // ============================================================
  
  // 1. Ajouter la colonne espece à prospection_infestation
  const infestationColumns = await db.getAllAsync<{ name: string }>(
    "PRAGMA table_info(prospection_infestation)"
  );
  const infestationColumnNames = new Set(infestationColumns.map(c => c.name));

  if (!infestationColumnNames.has('espece')) {
    await db.execAsync("ALTER TABLE prospection_infestation ADD COLUMN espece TEXT");
    console.log('✅ Colonne espece ajoutée à prospection_infestation');
  }

  if (!infestationColumnNames.has('direction_de')) {
    await db.execAsync("ALTER TABLE prospection_infestation ADD COLUMN direction_de TEXT");
    console.log('✅ Colonne direction_de ajoutée à prospection_infestation');
  }

  // 2. Ajouter les colonnes de la migration 0005 à prospection
  const prospectionColumns = await db.getAllAsync<{ name: string }>(
    "PRAGMA table_info(prospection)"
  );
  const prospectionColumnNames = new Set(prospectionColumns.map(c => c.name));

  const newColumns = [
    { name: 'verdissement', type: 'REAL' },
    { name: 'hauteur_strate', type: 'REAL' },
    { name: 'pullulation_nb', type: 'INTEGER' },
    { name: 'interdistance', type: 'REAL' },
    { name: 'taille_info', type: 'TEXT' },
    { name: 'essaim_type', type: 'TEXT' },
    { name: 'essaim_vol_dir_de', type: 'TEXT' },
    { name: 'essaim_vol_dir_vers', type: 'TEXT' },
    { name: 'essaim_pose', type: 'INTEGER' },
    { name: 'surface_contaminee', type: 'REAL' },
  ];

  for (const col of newColumns) {
    if (!prospectionColumnNames.has(col.name)) {
      await db.execAsync(`ALTER TABLE prospection ADD COLUMN ${col.name} ${col.type}`);
      console.log(`✅ Colonne ${col.name} ajoutée à prospection`);
    }
  }

  return db;
}

export interface DraftProspection {
  id: string;
  type_prospection: string;
  campagne_id: string;
  prospecteur_id: string;
  station_id: string | null;
  n_releve: string | null;
  n_fiche: string | null;
  n_message: string | null;
  especes: string | null;
  capture_started_at: string | null;
  grilles_completees: string | null;
  date_prospection: string;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  biotope: string | null;
  surf_station: number | null;
  surf_prospectee: number | null;
  surf_infestee: number | null;
  degats_cultures: string | null;
  derniere_pluie: string | null;
  intensite_pluie: string | null;
  vegetation: string | null;
  sol: string | null;
  verdissement: number | null;
  hauteur_strate: number | null;
  ennemis_naturels: string | null;
  pullulation_nb: number | null;
  interdistance: number | null;
  taille_info: string | null;
  essaim_type: string | null;
  essaim_vol_dir_de: string | null;
  essaim_vol_dir_vers: string | null;
  essaim_pose: boolean | null;
  surface_contaminee: number | null;
  observations: string | null;
  statut: string;
  statut_sync: string;
  created_at: string;
  updated_at: string;
}