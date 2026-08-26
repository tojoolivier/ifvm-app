import * as SQLite from 'expo-sqlite';
import { AppError, LocalReadError, LocalWriteError } from './errors';
import { logger } from './logger';

const DB_NAME = 'ifvm.db';

const log = logger.child({ module: 'prospection-db' });

/** Une colonne ajoutée après coup par une migration. */
interface Colonne {
  name: string;
  type: string;
}

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

/**
 * Ouverture et migration — le point du mobile où un silence coûte le plus cher.
 *
 * ADR-012 décision 2 : tout échec ici devient `LocalWriteError`. La classe
 * n'est pas un détail de journal, c'est ce qui décide du traitement — BLOQUER
 * plutôt qu'INFORMER — parce qu'une base non migrée signifie que **la saisie à
 * venir sera perdue**, pas seulement que la précédente est illisible.
 */
async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  let db: SQLite.SQLiteDatabase;

  try {
    db = await SQLite.openDatabaseAsync(DB_NAME);
  } catch (error) {
    throw new LocalWriteError(
      `Ouverture de la base locale ${DB_NAME} impossible`,
      { cause: error }
    );
  }

  // ==========================================
  // 1. CRÉATION DES TABLES (si elles n'existent pas)
  // ==========================================
  await creerTables(db);

  // ==========================================
  // 2. MIGRATION : Ajout des colonnes manquantes
  // ==========================================
  await ajouterColonnesManquantes(db, 'prospection', COLONNES_PROSPECTION);
  await ajouterColonnesManquantes(db, 'prospection_infestation', COLONNES_INFESTATION);
  await ajouterColonnesManquantes(db, 'prospection_population', COLONNES_POPULATION);
  await ajouterColonnesManquantes(db, 'traitement', COLONNES_TRAITEMENT);

  log.event('db.ouverte', { base: DB_NAME });

  // La migration a tourné sur le handle nu, pour garder ses messages d'échec
  // à elle ; les dépôts reçoivent le handle typé.
  return typerLesEchecs(db);
}

/**
 * Quelle classe du jeu fermé porte l'échec de quelle méthode SQLite.
 *
 * Une lecture ratée est `LocalReadError` : la donnée est déjà perdue, l'agent
 * n'a aucun recours. Une écriture ratée est `LocalWriteError` : l'agent est en
 * train de saisir et **perdra tout** s'il continue — d'où un traitement
 * BLOQUER là où la lecture se contente d'INFORMER (ADR-012 décision 3).
 */
type ConstructeurErreur = new (
  message: string,
  options?: { cause?: unknown }
) => AppError;

const CLASSE_PAR_METHODE: Record<string, ConstructeurErreur | undefined> = {
  getAllAsync: LocalReadError,
  getFirstAsync: LocalReadError,
  runAsync: LocalWriteError,
  execAsync: LocalWriteError,
  withTransactionAsync: LocalWriteError,
};

/**
 * Rend un handle qui type ses propres échecs.
 *
 * Les dépôts font une centaine d'appels SQLite **sans un seul `try`** : les
 * typer un par un, c'était cent occasions d'en oublier un — et un oubli ne se
 * voit pas, il produit juste un `(bug)` de plus dans le journal et un
 * « Signaler au support » là où l'agent méritait « Réessayer d'enregistrer ».
 * Le typage vit donc au seul endroit par lequel tous passent.
 *
 * **Le `this` de chaque méthode reste la vraie base**, y compris pour celles
 * qu'on n'enveloppe pas. Ce n'est pas une précaution de principe : lu dans
 * `node_modules/expo-sqlite`, `closeAsync()` fait
 * `unregisterDatabaseForDevToolsAsync(this)`, et un `this` valant l'enveloppe
 * au lieu de la base ne correspondrait à aucune entrée du registre. Le défaut
 * serait resté invisible — il est gardé par `__DEV__`, et **tous les tests
 * mockent `expo-sqlite` par des objets nus**, donc aucun n'aurait pu l'attraper.
 * C'est le motif que ce dépôt collectionne : du code d'apparence correcte que
 * rien n'exerce.
 *
 * Un `Proxy` plutôt qu'un `Object.create` : il lie le récepteur une fois pour
 * toutes, au lieu de laisser chaque méthode non listée hériter du mauvais.
 */
function typerLesEchecs(db: SQLite.SQLiteDatabase): SQLite.SQLiteDatabase {
  return new Proxy(db, {
    get(base, propriete) {
      const membre = Reflect.get(base, propriete, base) as unknown;

      if (typeof membre !== 'function') return membre;

      const appel = membre as (...a: unknown[]) => unknown;
      const Classe = CLASSE_PAR_METHODE[propriete as string];

      // Méthode hors du tableau : rendue telle quelle, mais liée à la base.
      if (!Classe) return appel.bind(base);

      return async (...args: unknown[]): Promise<unknown> => {
        try {
          return await appel.apply(base, args);
        } catch (error) {
          // Déjà typée : c'est le cas d'un `withTransactionAsync` dont le
          // rappel lève une `PreconditionError`. La réenvelopper ferait lire
          // « impossible d'enregistrer » à la place du message écrit pour
          // l'agent.
          if (error instanceof AppError) throw error;

          throw new Classe(`${String(propriete)} a échoué sur la base locale`, {
            cause: error,
          });
        }
      };
    },
  });
}

async function creerTables(db: SQLite.SQLiteDatabase): Promise<void> {
  try {
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
      surface_station REAL,
      surface_prospectee REAL,
      surface_infestee REAL,
      degats_cultures TEXT,
      derniere_pluie TEXT,
      intensite_pluie TEXT,
      vegetation TEXT,
      sol TEXT,
      ennemis_naturels TEXT,
      observations TEXT,
      avertissements TEXT,
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
      captures_solitaro_transiens INTEGER,
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
      surface_totale REAL,
      densite_min REAL,
      densite_max REAL,
      densite_moy REAL,
      interdistance REAL,
      comportement TEXT,
      direction_de TEXT,
      direction_vers TEXT,
      vent_de TEXT,
      vent_vitesse REAL,
      pullulation_nb INTEGER,
      taille_long REAL,
      taille_large REAL,
      taille_epaisseur REAL,
      essaim_en_vol INTEGER,
      essaim_pose INTEGER,
      type_essaim TEXT,
      nb_taches_bandes INTEGER,
      interdistance_m REAL,
      interdistance_min REAL,
      interdistance_max REAL,
      interdistance_moy REAL,
      surface_contaminee_ha REAL,
      type_larve TEXT,
      surface_infestee_pourcent REAL,
      stade_dominant TEXT,
      taille_groupe_m2 REAL,
      front_longueur_m REAL,
      front_largeur_m REAL,
      densite_max_front REAL,
      densite_moy_arriere_front REAL,
      heure_observation TEXT,
      densite_en_vol REAL,
      dimension_ha REAL
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
      updated_at TEXT NOT NULL,
      server_updated_at TEXT
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
  } catch (error) {
    throw new LocalWriteError(
      'Création du schéma local impossible',
      { cause: error }
    );
  }
}

/**
 * Ajoute les colonnes absentes d'une table, une par une.
 *
 * Un seul corps pour les quatre tables : les quatre fonctions `migrate*Table`
 * qu'il remplace étaient identiques au nom de table près, et le `catch` avalé
 * y avait donc été recopié quatre fois — c'est ce genre de duplication qui
 * fait qu'un silence se propage.
 *
 * **L'échec n'est plus avalé** (il l'était par `console.warn`). Une colonne
 * absente ne se voit pas : le code qui l'écrira plus tard échouera avec un
 * message SQLite incompréhensible, très loin d'ici — c'est exactement la
 * dérive de schéma qui a produit un écran blanc silencieux. Mieux vaut
 * refuser d'ouvrir la base et le dire.
 *
 * La trace est un `event`, donc persistée et gardée à l'export : une migration
 * est une opération critique et irréversible, et cette ligne est la seule
 * trace de ce qui a été joué sur l'appareil d'un agent. **Une ligne par
 * table, pas par colonne** : sur une installation neuve, les soixante-cinq
 * colonnes rempliraient l'anneau du logger à elles seules et pousseraient
 * dehors le contexte utile.
 */
async function ajouterColonnesManquantes(
  db: SQLite.SQLiteDatabase,
  table: string,
  colonnes: readonly Colonne[]
): Promise<void> {
  let existantes: string[];

  try {
    const info = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
    existantes = info.map((row) => row.name);
  } catch (error) {
    throw new LocalWriteError(
      `Schéma de la table ${table} illisible — migration impossible`,
      { cause: error }
    );
  }

  const manquantes = colonnes.filter((col) => !existantes.includes(col.name));

  log.detail('db.migration.verifiee', {
    table,
    colonnes: existantes.length,
    manquantes: manquantes.length,
  });

  for (const col of manquantes) {
    try {
      await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${col.name} ${col.type};`);
    } catch (error) {
      throw new LocalWriteError(
        `Colonne ${table}.${col.name} impossible à ajouter — la base est inutilisable en l’état`,
        { cause: error }
      );
    }
  }

  if (manquantes.length > 0) {
    log.event('db.migration.colonnes-ajoutees', {
      table,
      colonnes: manquantes.map((col) => col.name),
    });
  }
}

// ==========================================
// Colonnes ajoutées après coup, par table
// ==========================================

/** Colonnes ajoutées à `prospection` après sa création initiale. */
const COLONNES_PROSPECTION: readonly Colonne[] = [
  { name: 'region', type: 'TEXT' },
  { name: 'district', type: 'TEXT' },
  { name: 'commune', type: 'TEXT' },
  { name: 'za', type: 'TEXT' },
  { name: 'pa_code', type: 'TEXT' },
  { name: 'pa_nom', type: 'TEXT' },
  { name: 'station_nom', type: 'TEXT' },
  { name: 'surface_station', type: 'REAL' },
  { name: 'surface_prospectee', type: 'REAL' },
  { name: 'surface_infestee', type: 'REAL' },
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
  { name: 'avertissements', type: 'TEXT' },
  // Horodatage ISO complet (date + heure + fuseau) de l'acquisition GPS sur l'écran
  // Observations — distinct de `prospection_infestation.heure_observation` (HH:mm par
  // cible d'infestation, sans lien avec le GPS). L'heure HH:mm affichée est dérivée de
  // cette valeur à la lecture, jamais stockée séparément.
  { name: 'heure_observation_at', type: 'TEXT' },
];

/** Colonnes ajoutées à `prospection_infestation` après sa création initiale. */
const COLONNES_INFESTATION: readonly Colonne[] = [
  { name: 'espece', type: 'TEXT' },
  { name: 'direction_de', type: 'TEXT' },
  { name: 'pullulation_nb', type: 'INTEGER' },
  { name: 'surface_totale', type: 'REAL' },
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
  { name: 'surface_infestee_pourcent', type: 'REAL' },
  { name: 'stade_dominant', type: 'TEXT' },
  { name: 'taille_groupe_m2', type: 'REAL' },
  { name: 'front_longueur_m', type: 'REAL' },
  { name: 'front_largeur_m', type: 'REAL' },
  { name: 'densite_max_front', type: 'REAL' },
  { name: 'densite_moy_arriere_front', type: 'REAL' },
  { name: 'heure_observation', type: 'TEXT' },
  { name: 'densite_en_vol', type: 'REAL' },
  { name: 'dimension_ha', type: 'REAL' },
];

/** Colonnes ajoutées à `prospection_population` après sa création initiale. */
const COLONNES_POPULATION: readonly Colonne[] = [
  { name: 'phase', type: 'TEXT' },
  { name: 'captures_nombre', type: 'INTEGER' },
  { name: 'temps_capture', type: 'INTEGER' },
  { name: 'methode', type: 'TEXT' },
  { name: 'captures_sol', type: 'INTEGER' },
  { name: 'captures_trans', type: 'INTEGER' },
  { name: 'captures_greg', type: 'INTEGER' },
  { name: 'captures_solitaro_transiens', type: 'INTEGER' },
  { name: 'stade_imago', type: 'TEXT' },
  { name: 'essaim_observe', type: 'INTEGER' },
  { name: 'densites_larve', type: 'TEXT' },
  { name: 'tache_larvaire', type: 'INTEGER' },
  { name: 'bande_larvaire', type: 'INTEGER' },
  { name: 'interdistance', type: 'REAL' },
  { name: 'deplacement', type: 'TEXT' },
  { name: 'surface_contaminee_ha', type: 'REAL' },
  // Extensif imagos uniquement — type de cible, État/Comportement (par espèce, cf.
  // migration backend 0033) : remplace essaim_observe (2 états) par les 3 mêmes valeurs
  // que le type_cible de l'Infestation intensive.
  { name: 'type_cible', type: 'TEXT' },
  { name: 'direction_de', type: 'TEXT' },
  { name: 'direction_vers', type: 'TEXT' },
  { name: 'etat', type: 'TEXT' },
  { name: 'essaim_en_vol', type: 'INTEGER' },
  { name: 'essaim_pose', type: 'INTEGER' },
];

/** Colonnes ajoutées à `traitement` après sa création initiale. */
const COLONNES_TRAITEMENT: readonly Colonne[] = [
  { name: 'server_updated_at', type: 'TEXT' },
];
