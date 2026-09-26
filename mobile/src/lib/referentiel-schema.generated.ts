// Fichier généré par `npm run generate:referentiel-schema` depuis api-schema.generated.ts.
// Ne pas modifier à la main : la couche locale se déclare dans scripts/referentiel-schema.config.js.

/** Tables du cache jetable du référentiel (DROP + pull complet quand la version change). */
export const REFERENTIEL_TABLES = [
  'poste_acridien',
  'station_fixe',
  'utilisateur_equipe',
  'pesticide',
  'culture',
  'code_stade',
  'campagne',
  'lieu_aerien',
  'equipe',
  'equipe_membre',
  'site_aerien',
  'aeronef',
  'equipe_aeronef',
] as const;

/** Empreinte du DDL : change dès que le contrat ou la couche locale change. */
export const REFERENTIEL_SCHEMA_VERSION = '7ad79cb27f01';

export const REFERENTIEL_DDL = `
CREATE TABLE IF NOT EXISTS poste_acridien (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL,
  nom TEXT NOT NULL,
  za_id TEXT NOT NULL,
  actif INTEGER NOT NULL,
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
  commune TEXT NOT NULL,
  district TEXT NOT NULL,
  region TEXT NOT NULL,
  actif INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_station_fixe_pa_id ON station_fixe(pa_id);

CREATE TABLE IF NOT EXISTS utilisateur_equipe (
  id TEXT PRIMARY KEY NOT NULL,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  role TEXT NOT NULL,
  sigle TEXT,
  pa_id TEXT,
  actif INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pesticide (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL,
  nom TEXT NOT NULL,
  matiere_active TEXT,
  dose_reference TEXT,
  type_produit TEXT,
  actif INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS culture (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL,
  nom TEXT NOT NULL,
  actif INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS code_stade (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL,
  categorie TEXT NOT NULL,
  sexe TEXT,
  espece TEXT,
  libelle TEXT NOT NULL,
  ordre REAL NOT NULL,
  actif INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campagne (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  actif INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lieu_aerien (
  id TEXT PRIMARY KEY NOT NULL,
  type_lieu TEXT NOT NULL,
  nom TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  altitude REAL,
  actif INTEGER NOT NULL,
  equipe_aerienne_id TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS equipe (
  id TEXT PRIMARY KEY NOT NULL,
  nom TEXT NOT NULL,
  type TEXT NOT NULL,
  actif INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS equipe_membre (
  equipe_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  fonction TEXT NOT NULL,
  nom TEXT,
  prenom TEXT,
  PRIMARY KEY (equipe_id, user_id)
);

CREATE INDEX IF NOT EXISTS ix_equipe_membre_user_id ON equipe_membre(user_id);

CREATE TABLE IF NOT EXISTS site_aerien (
  id TEXT PRIMARY KEY NOT NULL,
  parent_site_id TEXT,
  equipe_id TEXT,
  numero TEXT NOT NULL,
  localite TEXT NOT NULL,
  actif INTEGER NOT NULL,
  latitude REAL,
  longitude REAL,
  altitude REAL,
  date_debut_position TEXT,
  updated_at TEXT NOT NULL,
  statut_sync TEXT NOT NULL DEFAULT 'synced'
);

CREATE INDEX IF NOT EXISTS ix_site_aerien_equipe_id ON site_aerien(equipe_id);

CREATE TABLE IF NOT EXISTS aeronef (
  id TEXT PRIMARY KEY NOT NULL,
  immatriculation TEXT NOT NULL,
  societe TEXT NOT NULL,
  volume_cuve_l REAL NOT NULL,
  actif INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS equipe_aeronef (
  id TEXT PRIMARY KEY NOT NULL,
  equipe_id TEXT NOT NULL,
  aeronef_id TEXT NOT NULL,
  date_debut TEXT NOT NULL,
  date_fin TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_equipe_aeronef_equipe_id ON equipe_aeronef(equipe_id);
`;
