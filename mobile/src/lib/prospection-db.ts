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
      phase TEXT,
      captures_nombre INTEGER,
      temps_capture INTEGER,
      densite_diffuse REAL,
      densite_groupee REAL,
      methode TEXT,
      accouplement TEXT,
      ponte TEXT,
      captures_sol INTEGER,
      captures_trans INTEGER,
      captures_greg INTEGER,
      stade_imago TEXT,
      essaim_observe INTEGER,
      densites_larve TEXT,
      tache_larvaire INTEGER,
      bande_larvaire INTEGER,
      interdistance REAL,
      deplacement TEXT,
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

    CREATE TABLE IF NOT EXISTS traitement (
      id TEXT PRIMARY KEY NOT NULL,
      prospection_id TEXT NOT NULL,
      numero_fiche TEXT,
      type_traitement TEXT NOT NULL,
      mode_traitement TEXT,
      date_traitement TEXT,
      date_validation TEXT,
      localite TEXT,
      region TEXT,
      district TEXT,
      commune TEXT,
      latitude REAL,
      longitude REAL,
      altitude REAL,
      kit_combinaison INTEGER,
      kit_gants INTEGER,
      kit_lunettes INTEGER,
      kit_masques INTEGER,
      kit_boite INTEGER,
      zones_exposees TEXT,
      hauteur_strate_herbeuse_m REAL,
      hauteur_strate_arboree_m REAL,
      recouvrement_percent REAL,
      empoisonnement INTEGER,
      empoisonnement_type TEXT,
      empoisonnement_mode TEXT,
      empoisonnement_autre TEXT,
      evaluation_risque TEXT,
      comportement_anormal INTEGER,
      comportement_non_cibles TEXT,
      mortalite INTEGER,
      mortalite_familles TEXT,
      observations TEXT,
      statut TEXT NOT NULL DEFAULT 'brouillon',
      statut_sync TEXT NOT NULL DEFAULT 'local',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS ix_traitement_prospection_id
      ON traitement(prospection_id);

    CREATE TABLE IF NOT EXISTS cible (
      traitement_id TEXT PRIMARY KEY NOT NULL REFERENCES traitement(id) ON DELETE CASCADE,
      espece TEXT,
      petites_larves REAL,
      grandes_larves REAL,
      vols_clairs_essaims REAL,
      repartition_population TEXT,
      surface_infestee_ha REAL
    );

    CREATE TABLE IF NOT EXISTS traitement_aerien (
      traitement_id TEXT PRIMARY KEY NOT NULL REFERENCES traitement(id) ON DELETE CASCADE,
      pilote TEXT,
      mecanicien TEXT,
      chef_de_base_id TEXT,
      consultant_international TEXT,
      nb_rotations INTEGER,
      total_pesticide_l REAL
    );

    CREATE TABLE IF NOT EXISTS rotation (
      id TEXT PRIMARY KEY NOT NULL,
      traitement_aerien_id TEXT NOT NULL REFERENCES traitement_aerien(traitement_id) ON DELETE CASCADE,
      numero INTEGER,
      numero_cuve TEXT,
      produit_id TEXT,
      quantite_l REAL,
      temperature_debut_c REAL,
      temperature_fin_c REAL,
      vent_debut_ms REAL,
      vent_fin_ms REAL
    );

    CREATE INDEX IF NOT EXISTS ix_rotation_traitement_aerien_id
      ON rotation(traitement_aerien_id);

    CREATE TABLE IF NOT EXISTS traitement_terrestre (
      traitement_id TEXT PRIMARY KEY NOT NULL REFERENCES traitement(id) ON DELETE CASCADE,
      heure_debut TEXT,
      heure_fin TEXT,
      vitesse_vent_ms REAL,
      direction_vent TEXT,
      temperature_c REAL,
      reprise_traitement INTEGER,
      traitement_origine_id TEXT,
      chef_equipe_id TEXT,
      agent_encadreur_id TEXT,
      consultant_international TEXT,
      surface_atomiseur_ha REAL,
      surface_disque_rotatif_ha REAL,
      surface_ulvamast_ha REAL,
      surface_restante_abandonnee INTEGER,
      motif_surface_restante_abandonnee TEXT,
      essence_litres REAL,
      nb_piles INTEGER,
      surface_traitee_ha REAL,
      surface_cumulee_ha REAL,
      surface_restante_ha REAL,
      total_pesticide_l REAL
    );

    CREATE TABLE IF NOT EXISTS produit_utilise (
      id TEXT PRIMARY KEY NOT NULL,
      traitement_terrestre_id TEXT NOT NULL REFERENCES traitement_terrestre(traitement_id) ON DELETE CASCADE,
      numero INTEGER,
      produit_id TEXT,
      quantite_l REAL
    );

    CREATE INDEX IF NOT EXISTS ix_produit_utilise_traitement_terrestre_id
      ON produit_utilise(traitement_terrestre_id);

    CREATE TABLE IF NOT EXISTS traitement_signature (
      id TEXT PRIMARY KEY NOT NULL,
      traitement_id TEXT NOT NULL REFERENCES traitement(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      signataire_nom TEXT,
      horodatage TEXT
    );

    CREATE INDEX IF NOT EXISTS ix_traitement_signature_traitement_id
      ON traitement_signature(traitement_id);
  `);

  // ==========================================
  // 2. MIGRATION : Ajout des colonnes manquantes
  // ==========================================
  await migrateProspectionTable(db);
  await migrateInfestationTable(db);
  await migratePopulationTable(db);
  await migrateTraitementTable(db);

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
    { name: 'pa_nom', type: 'TEXT' },
    { name: 'station_nom', type: 'TEXT' },
    { name: 'degats_cultures_pourcent', type: 'INTEGER' },
    { name: 'verdissement_pourcent', type: 'INTEGER' },
    { name: 'hauteur_herbe_cm', type: 'REAL' },
    { name: 'station_libre', type: 'TEXT' },
    { name: 'type_station', type: 'TEXT' },
    { name: 'verdure_strate', type: 'TEXT' },
    { name: 'signalement_source', type: 'TEXT' },
    { name: 'signalement_date', type: 'TEXT' },
    { name: 'signalement_description', type: 'TEXT' },
    { name: 'conclusion_validation', type: 'TEXT' },
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
    { name: 'interdistance_min', type: 'REAL' },
    { name: 'interdistance_max', type: 'REAL' },
    { name: 'interdistance_moy', type: 'REAL' },
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

// ==========================================
// MIGRATION POUR LA TABLE PROSPECTION_POPULATION
// ==========================================
async function migratePopulationTable(db: SQLite.SQLiteDatabase): Promise<void> {
  const tableInfo = await db.getAllAsync<{ name: string }>('PRAGMA table_info(prospection_population)');
  const columnNames = tableInfo.map(row => row.name);

  const columnsToAdd = [
    { name: 'phase', type: 'TEXT' },
    { name: 'captures_nombre', type: 'INTEGER' },
    { name: 'temps_capture', type: 'INTEGER' },
    { name: 'captures_sol', type: 'INTEGER' },
    { name: 'captures_trans', type: 'INTEGER' },
    { name: 'captures_greg', type: 'INTEGER' },
    { name: 'stade_imago', type: 'TEXT' },
    { name: 'essaim_observe', type: 'INTEGER' },
    { name: 'densites_larve', type: 'TEXT' },
    { name: 'tache_larvaire', type: 'INTEGER' },
    { name: 'bande_larvaire', type: 'INTEGER' },
    { name: 'interdistance', type: 'REAL' },
    { name: 'deplacement', type: 'TEXT' },
  ];

  for (const col of columnsToAdd) {
    if (!columnNames.includes(col.name)) {
      try {
        await db.execAsync(`ALTER TABLE prospection_population ADD COLUMN ${col.name} ${col.type};`);
      } catch (error) {
        console.warn(`[Migration] ⚠️ Impossible d'ajouter ${col.name} sur prospection_population:`, error);
      }
    }
  }
}

// ==========================================
// MIGRATION POUR LA TABLE TRAITEMENT
// ==========================================
/**
 * Aucune colonne n'a été ajoutée depuis la création de la table `traitement`
 * (le champ `observations` fait déjà partie du schéma de base). Cette fonction
 * existe malgré tout, en parité avec les autres tables, pour que le prochain
 * ajout de colonne suive le même patron ALTER-TABLE tolérant plutôt que
 * d'inventer une nouvelle convention.
 */
async function migrateTraitementTable(db: SQLite.SQLiteDatabase): Promise<void> {
  const tableInfo = await db.getAllAsync<{ name: string }>('PRAGMA table_info(traitement)');
  const columnNames = tableInfo.map(row => row.name);

  const columnsToAdd: { name: string; type: string }[] = [];

  for (const col of columnsToAdd) {
    if (!columnNames.includes(col.name)) {
      try {
        await db.execAsync(`ALTER TABLE traitement ADD COLUMN ${col.name} ${col.type};`);
      } catch (error) {
        console.warn(`[Migration] ⚠️ Impossible d'ajouter ${col.name} sur traitement:`, error);
      }
    }
  }
}