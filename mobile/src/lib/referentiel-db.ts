import * as SQLite from 'expo-sqlite';

import { getDb } from './prospection-db';
import { ReferentialError } from './errors';
import { REFERENTIEL_DDL, REFERENTIEL_SCHEMA_VERSION, REFERENTIEL_TABLES } from './referentiel-schema.generated';

/**
 * Migration en cours ou terminée. C'est une **promesse** mémoïsée, pas un booléen :
 * deux `_layout` montent le pull automatique, donc deux appels concurrents arrivent ici.
 * Avec un drapeau posé après coup, le second rejouait la migration pendant que le
 * premier écrivait — et depuis que la migration de `code_stade` contient un `DROP TABLE`,
 * cette course effaçait les lignes tout juste synchronisées (#201).
 */
let basePrete: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Ouvre la base partagée et s'assure que les tables miroir du référentiel existent.
 *
 * La mémoïsation couvre **aussi** l'ouverture de la base : la poser après un `await`
 * laissait deux appels concurrents franchir la garde et migrer tous les deux. Depuis que
 * la migration de `code_stade` contient un `DROP TABLE`, cette course effaçait les lignes
 * que la synchro venait d'écrire — d'où une « synchro réussie » suivie d'une grille de
 * stades vide (#201).
 */
export async function getReferentielDb(): Promise<SQLite.SQLiteDatabase> {
  if (!basePrete) {
    basePrete = (async () => {
      const db = await getDb();
      await preparerSchema(db);
      return db;
    })();
    // Un échec ne doit pas rester mémoïsé : le prochain appel réessaie.
    basePrete.catch(() => {
      basePrete = null;
    });
  }
  return basePrete;
}

/** Réservé aux tests : force la remigration au prochain `getReferentielDb()`. */
export function resetReferentielDbForTests(): void {
  basePrete = null;
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

/**
 * Résout le nom d'une station par son id, active ou non — #localite-traitement-
 * poste-acridien-autre-agent : `ProspectionRead` (réponse serveur) n'expose pas
 * `station_nom` (contrairement à `prospecteur_nom`, résolu côté backend), donc
 * une fiche intensive matérialisée depuis un AUTRE agent ne peut le connaître
 * qu'en le retrouvant ici, dans le référentiel local déjà synchronisé — jamais
 * filtré sur `actif` : une station depuis désactivée doit rester résolvable
 * pour l'historique d'une prospection existante, ce n'est pas une sélection.
 */
export async function getStationById(id: string): Promise<StationFixe | null> {
  const db = await getReferentielDb();
  return db.getFirstAsync<StationFixe>(
    'SELECT id, code, nom, pa_id as paId, latitude, longitude, altitude, commune, district, region FROM station_fixe WHERE id = ?',
    [id]
  );
}

export interface StadeGrille {
  code: string;
  libelle: string;
}

export interface EtatTableReferentiel {
  table: string;
  lignes: number;
}

/** Tables miroir du référentiel, dans l'ordre d'affichage du diagnostic. */
const TABLES_REFERENTIEL = [
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
];

/**
 * Nombre de lignes par table miroir — diagnostic affiché sur l'écran Synchronisation.
 * « Synchro réussie » ne dit rien de ce qui a atterri : sans ce compte, une table vide
 * reste invisible et se confond avec un bug d'écran (#201).
 */
export async function compterReferentielLocal(): Promise<EtatTableReferentiel[]> {
  const db = await getReferentielDb();
  const etats: EtatTableReferentiel[] = [];
  for (const table of TABLES_REFERENTIEL) {
    const row = await db.getFirstAsync<{ n: number }>(`SELECT count(*) AS n FROM ${table}`);
    etats.push({ table, lignes: row?.n ?? 0 });
  }
  return etats;
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
  matiere_active: string | null;
  dose_reference: string | null;
  type_produit: string | null;
}

/**
 * Mode de traitement -> type de produit à proposer : BARRIERE n'affiche que les
 * produits barrière, TOTAL (couverture totale) que les produits de choc — un
 * traitement barrière posé avec un produit de choc (et inversement) n'a pas l'effet
 * recherché. IRREGULIER n'a pas de restriction (`null` : tous les actifs).
 */
export function typeProduitAttendu(
  modeTraitement: 'TOTAL' | 'BARRIERE' | 'IRREGULIER' | null | undefined
): 'produit_choc' | 'produit_barriere' | null {
  if (modeTraitement === 'BARRIERE') return 'produit_barriere';
  if (modeTraitement === 'TOTAL') return 'produit_choc';
  return null;
}

/**
 * Pesticides actifs, triés par nom — alimente les chips "Produit" des rotations/
 * produits utilisés. Filtré par `modeTraitement` (cf. `typeProduitAttendu`) : un
 * pesticide dont `type_produit` n'est pas encore renseigné au référentiel est exclu
 * pour BARRIERE/TOTAL (ne correspond positivement à aucun des deux), mais reste
 * proposé pour IRREGULIER (aucune restriction).
 */
export async function listPesticides(
  modeTraitement?: 'TOTAL' | 'BARRIERE' | 'IRREGULIER' | null
): Promise<Pesticide[]> {
  const db = await getReferentielDb();
  const attendu = typeProduitAttendu(modeTraitement);
  return db.getAllAsync<Pesticide>(
    `SELECT id, code, nom, matiere_active, dose_reference, type_produit FROM pesticide
     WHERE actif = 1 AND (? IS NULL OR type_produit = ?)
     ORDER BY nom`,
    [attendu, attendu]
  );
}

export interface UtilisateurEquipe {
  id: string;
  nom: string;
  prenom: string;
}

export type RoleUtilisateurEquipe =
  | 'chef_de_base'
  | 'chef_equipe'
  | 'agent_encadreur'
  | 'pilote'
  | 'mecanicien'
  | 'consultant_international';

/** Utilisateurs actifs d'un rôle donné, triés par nom — alimente les chips de sélection des écrans
 * traitement, ainsi que les signatures Pilote/Chef de Base de l'écran Observations (extensif aérien). */
export async function listUtilisateursByRole(role: RoleUtilisateurEquipe): Promise<UtilisateurEquipe[]> {
  const db = await getReferentielDb();
  return db.getAllAsync<UtilisateurEquipe>(
    'SELECT id, nom, prenom FROM utilisateur_equipe WHERE actif = 1 AND role = ? ORDER BY nom',
    [role]
  );
}

export interface EquipeLocale {
  id: string;
  nom: string;
  type: 'terrestre' | 'aerien';
  nb_membres: number;
}

const SELECT_EQUIPE_LOCALE = `SELECT e.id, e.nom, e.type,
       (SELECT count(*) FROM equipe_membre m WHERE m.equipe_id = e.id) AS nb_membres
     FROM equipe e`;

/**
 * Équipes actives dont l'utilisateur est membre (`equipe_membre.user_id`) — alimente le choix de
 * l'équipe de travail (#641). Une équipe désactivée n'est plus proposée à la saisie.
 */
export async function listEquipesDeUtilisateur(userId: string): Promise<EquipeLocale[]> {
  const db = await getReferentielDb();
  return db.getAllAsync<EquipeLocale>(
    `${SELECT_EQUIPE_LOCALE}
     WHERE e.actif = 1
       AND EXISTS (SELECT 1 FROM equipe_membre m WHERE m.equipe_id = e.id AND m.user_id = ?)
     ORDER BY e.nom`,
    [userId]
  );
}

/** Toutes les équipes actives : l'administrateur choisit son équipe de travail sans en être membre. */
export async function listToutesEquipes(): Promise<EquipeLocale[]> {
  const db = await getReferentielDb();
  return db.getAllAsync<EquipeLocale>(`${SELECT_EQUIPE_LOCALE} WHERE e.actif = 1 ORDER BY e.nom`);
}

/** Une équipe par id, active ou non — un brouillon garde l'équipe d'origine même désactivée depuis. */
export async function getEquipeLocale(id: string): Promise<EquipeLocale | null> {
  const db = await getReferentielDb();
  return db.getFirstAsync<EquipeLocale>(`${SELECT_EQUIPE_LOCALE} WHERE e.id = ?`, [id]);
}

export interface CampagneLocal {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
}

/**
 * Campagnes actives du référentiel local — alimente `pickCurrentCampagneId` hors-ligne
 * (ADR-007). Une campagne désactivée (`actif = 0`) reste dans le cache pour l'historique
 * mais ne doit plus être proposée à la saisie (#137).
 */
export async function listCampagnesLocal(): Promise<CampagneLocal[]> {
  const db = await getReferentielDb();
  return db.getAllAsync<CampagneLocal>(
    'SELECT id, name, start_date, end_date FROM campagne WHERE actif = 1 ORDER BY start_date DESC'
  );
}

export interface Culture {
  id: string;
  code: string;
  nom: string;
}

/**
 * Cultures actives du référentiel local, triées par nom. Alimente les « dégâts sur
 * culture » (prospection) : c'est le référentiel synchronisé — et non une liste écrite
 * en dur dans l'écran — qui décide quelles cultures existent. `culture` descend déjà
 * dans le SQLite via `GET /referentiel/pull` mais n'était jamais relue (#135).
 */
export async function listCultures(): Promise<Culture[]> {
  const db = await getReferentielDb();
  return db.getAllAsync<Culture>(
    'SELECT id, code, nom FROM culture WHERE actif = 1 ORDER BY nom'
  );
}

export interface LieuAerien {
  id: string;
  type_lieu: string;
  nom: string;
}

/**
 * Lieux aériens actifs du référentiel local, triés par nom. Consommé par
 * `LieuAerienField` (#prospection-extensive-aerienne-lieu-aerien) pour
 * suggérer les lieux existants au champ « Base » de la Prospection Extensive
 * Aérienne — en lecture hors-ligne uniquement (le cache local, alimenté par
 * la synchronisation périodique du référentiel) ; aucune FK n'est
 * réintroduite, le champ reste du texte libre (migration backend 0063).
 */
export async function listLieuxAeriens(): Promise<LieuAerien[]> {
  const db = await getReferentielDb();
  return db.getAllAsync<LieuAerien>(
    'SELECT id, type_lieu, nom FROM lieu_aerien WHERE actif = 1 ORDER BY nom'
  );
}

export interface CodeStade {
  id: string;
  code: string;
  categorie: string | null;
  sexe: string | null;
  espece: string | null;
  libelle: string;
  ordre: number;
}

/**
 * Codes de stade actifs du référentiel local, dans l'ordre du référentiel. Alimente
 * les usages qui recensent les stades/phases (zones exposées, stade dominant, phases du
 * compteur). Contrairement à `listStadesGrille`, aucune projection espèce/sexe ici :
 * la liste brute du référentiel, à charge à l'appelant de filtrer. `code_stade`
 * descend déjà dans le SQLite mais n'était relu que par `listStadesGrille` (#135).
 */
export async function listCodesStades(): Promise<CodeStade[]> {
  const db = await getReferentielDb();
  return db.getAllAsync<CodeStade>(
    'SELECT id, code, categorie, sexe, espece, libelle, ordre FROM code_stade WHERE actif = 1 ORDER BY ordre'
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

export interface StationLaPlusProche {
  station: StationFixe;
  /** Distance haversine (km) entre la position donnée et cette station —
   * #station-intensive-hors-perimetre (reference.tsx) : sert à détecter qu'aucune
   * station connue n'est réellement à proximité. */
  distanceKm: number;
}

/** Station active la plus proche d'une position GPS — résout le mode "Auto" du PA/station. */
export async function findNearestStation(
  latitude: number,
  longitude: number
): Promise<StationLaPlusProche | null> {
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
  return { station: nearest, distanceKm: bestDistance };
}

/**
 * Métadonnées du cache : curseurs `since` et version du schéma généré. Les saisies de vol, de site et
 * de stock ne sont plus créées ici mais par les migrations numérotées (`migrations-captures.ts`).
 */
const DDL_LOCAL = `
    CREATE TABLE IF NOT EXISTS referentiel_sync_meta (
      entity_type TEXT PRIMARY KEY NOT NULL,
      last_pull_at TEXT
    );

    -- Version du schéma généré du référentiel : quand elle change, le cache est reconstruit.
    CREATE TABLE IF NOT EXISTS referentiel_schema_version (
      id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
      version TEXT NOT NULL
    );
`;

/**
 * Le référentiel est un cache jetable (#675) : son DDL est généré depuis le contrat OpenAPI
 * (`referentiel-schema.generated.ts`) et il n'a aucune migration. Si la version de schéma stockée
 * diffère de celle du code, on jette les tables du cache, on les recrée et on remet les curseurs
 * `since` à zéro — le prochain pull est complet. Les tables de saisie ne sont jamais touchées.
 */
async function preparerSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(DDL_LOCAL);

  const stockee = await db.getFirstAsync<{ version: string }>(
    'SELECT version FROM referentiel_schema_version WHERE id = 1'
  );
  if (stockee?.version === REFERENTIEL_SCHEMA_VERSION) {
    // Rien à reconstruire ; rejouer le DDL (idempotent) répare une création interrompue.
    await db.execAsync(REFERENTIEL_DDL);
    return;
  }
  await reconstruireReferentiel(db);
}

/**
 * Remplace tout le cache du référentiel par ce qu'écrit `remplir` (« Tout réinitialiser », Figma
 * « Réinitialisation »), **dans une seule transaction** : les tables sont jetées puis recréées, les
 * curseurs `since` remis à zéro, et seuls les sites créés hors-ligne restent. Si `remplir` échoue — ou
 * que l'app est tuée en route — tout est annulé et l'ancien cache est intact : vider puis écrire hors
 * transaction laisserait l'appareil sans stades ni pesticides en plein terrain. Les tables de saisie
 * (brouillons, fiches en attente d'envoi) ne sont jamais touchées.
 */
export async function remplacerReferentiel(remplir: (db: SQLite.SQLiteDatabase) => Promise<void>): Promise<void> {
  const db = await getReferentielDb();
  await db.withTransactionAsync(async () => {
    await viderTablesReferentiel(db);
    await remplir(db);
  });
}

type LigneSite = Record<string, unknown>;

async function reconstruireReferentiel(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(() => viderTablesReferentiel(db));
}

/** À appeler dans une transaction : jette et recrée les tables miroir, en gardant les sites en attente. */
async function viderTablesReferentiel(db: SQLite.SQLiteDatabase): Promise<void> {
  // Un site créé hors-ligne (#643) vit dans une table de cache mais n'existe que sur l'appareil :
  // on le met de côté avant le DROP et on le réinsère.
  const colonnes = await db.getAllAsync<{ name: string }>('PRAGMA table_info(site_aerien)');
  const sitesEnAttente: LigneSite[] = colonnes.some((c) => c.name === 'statut_sync')
    ? await db.getAllAsync<LigneSite>("SELECT * FROM site_aerien WHERE statut_sync <> 'synced'")
    : [];

  for (const table of REFERENTIEL_TABLES) {
    await db.execAsync(`DROP TABLE IF EXISTS ${table};`);
  }
  await db.execAsync(REFERENTIEL_DDL);
  await db.runAsync('DELETE FROM referentiel_sync_meta');

  const nouvelles = new Set(
    (await db.getAllAsync<{ name: string }>('PRAGMA table_info(site_aerien)')).map((c) => c.name)
  );
  for (const site of sitesEnAttente) {
    const cles = Object.keys(site).filter((cle) => nouvelles.has(cle));
    await db.runAsync(
      `INSERT INTO site_aerien (${cles.join(', ')}) VALUES (${cles.map(() => '?').join(', ')})`,
      cles.map((cle) => site[cle] as SQLite.SQLiteBindValue)
    );
  }

  await db.runAsync(
    `INSERT INTO referentiel_schema_version (id, version) VALUES (1, ?)
     ON CONFLICT(id) DO UPDATE SET version = excluded.version`,
    [REFERENTIEL_SCHEMA_VERSION]
  );
}
