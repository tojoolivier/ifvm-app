import { getDb } from './prospection-db';
import { generateId } from './id';

export type TypeProspection = 'intensive' | 'extensive' | 'validation';

export interface DraftProspectionInput {
  id: string;
  typeProspection: TypeProspection;
  campagneId: string;
  prospecteurId: string;
  dateProspection: string; // ISO date (yyyy-mm-dd)
  stationId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  altitude?: number | null;
  surfStation?: number | null;
  surfProspectee?: number | null;
  surfInfestee?: number | null;
}

export interface DraftProspection {
  id: string;
  type_prospection: string;
  campagne_id: string;
  prospecteur_id: string;
  station_id: string | null;
  n_fiche: string | null;
  especes: string | null;
  capture_started_at: string | null;
  date_prospection: string;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  surf_station: number | null;
  surf_prospectee: number | null;
  surf_infestee: number | null;
  degats_cultures: string | null;
  vegetation: string | null;
  sol: string | null;
  statut: string;
  statut_sync: string;
  created_at: string;
  updated_at: string;
}

export interface ReferenceUpdateInput {
  latitude: number;
  longitude: number;
  altitude: number | null;
  surfStation: number;
  surfProspectee: number;
  surfInfestee: number;
  nFiche: string;
}

/** Crée une fiche brouillon en local (SQLite), sans dépendance réseau. */
export async function createDraftProspection(
  input: DraftProspectionInput
): Promise<DraftProspection> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO prospection (
      id, type_prospection, campagne_id, prospecteur_id, station_id,
      date_prospection, latitude, longitude, altitude,
      surf_station, surf_prospectee, surf_infestee,
      statut, statut_sync, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'brouillon', 'local', ?, ?)`,
    [
      input.id,
      input.typeProspection,
      input.campagneId,
      input.prospecteurId,
      input.stationId ?? null,
      input.dateProspection,
      input.latitude ?? null,
      input.longitude ?? null,
      input.altitude ?? null,
      input.surfStation ?? null,
      input.surfProspectee ?? null,
      input.surfInfestee ?? null,
      now,
      now,
    ]
  );

  const created = await getProspection(input.id);
  if (!created) {
    throw new Error('Échec de la création de la fiche brouillon locale');
  }
  return created;
}

/** Persiste la position GPS, les surfaces et le n° de fiche saisis à l'écran Référence. */
export async function updateProspectionReference(
  id: string,
  input: ReferenceUpdateInput
): Promise<DraftProspection> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE prospection SET
      latitude = ?, longitude = ?, altitude = ?,
      surf_station = ?, surf_prospectee = ?, surf_infestee = ?,
      n_fiche = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.latitude,
      input.longitude,
      input.altitude,
      input.surfStation,
      input.surfProspectee,
      input.surfInfestee,
      input.nFiche,
      now,
      id,
    ]
  );

  const updated = await getProspection(id);
  if (!updated) {
    throw new Error('Échec de la mise à jour de la fiche brouillon locale');
  }
  return updated;
}

/** Persiste la sélection espèces/stades saisie à l'écran Filtre espèces. */
export async function updateProspectionEspeces(id: string, especes: string): Promise<DraftProspection> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    'UPDATE prospection SET especes = ?, updated_at = ? WHERE id = ?',
    [especes, now, id]
  );

  const updated = await getProspection(id);
  if (!updated) {
    throw new Error('Échec de la mise à jour de la fiche brouillon locale');
  }
  return updated;
}

/** Démarre le chrono de la session de captures (n'écrase pas un chrono déjà démarré). */
export async function startCaptureTimer(id: string): Promise<DraftProspection> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    "UPDATE prospection SET capture_started_at = ?, updated_at = ? WHERE id = ? AND capture_started_at IS NULL",
    [now, now, id]
  );

  const updated = await getProspection(id);
  if (!updated) {
    throw new Error('Échec de la mise à jour de la fiche brouillon locale');
  }
  return updated;
}

export interface VegetationUpdateInput {
  vegetation: string;
  sol: string;
  degatsCultures: string | null;
}

/** Persiste la végétation, le sol et les dégâts culture saisis à l'écran Végétation & sol (JSONB archival, cf. ADR-006). */
export async function updateProspectionVegetation(
  id: string,
  input: VegetationUpdateInput
): Promise<DraftProspection> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    'UPDATE prospection SET vegetation = ?, sol = ?, degats_cultures = ?, updated_at = ? WHERE id = ?',
    [input.vegetation, input.sol, input.degatsCultures, now, id]
  );

  const updated = await getProspection(id);
  if (!updated) {
    throw new Error('Échec de la mise à jour de la fiche brouillon locale');
  }
  return updated;
}

export interface CaptureRow {
  espece: 'LMC' | 'NSE';
  categorie: 'imago' | 'larve';
  sexe: 'F' | 'M';
  phase: string; // phénotype : solitaire | solitaro_trans | transiens | gregaire
  stade: string; // A1, A234, A3¼… selon l'espece/sexe
  effectif: number;
}

/** Remplace les lignes `prospection_capture` d'une grille (espece/categorie) par le comptage courant. */
export async function saveProspectionCaptures(
  prospectionId: string,
  espece: string,
  categorie: string,
  rows: CaptureRow[]
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'DELETE FROM prospection_capture WHERE prospection_id = ? AND espece = ? AND categorie = ?',
    [prospectionId, espece, categorie]
  );
  for (const row of rows) {
    await db.runAsync(
      `INSERT INTO prospection_capture (id, prospection_id, espece, categorie, sexe, phase, stade, effectif)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [generateId(), prospectionId, espece, categorie, row.sexe, row.phase, row.stade, row.effectif]
    );
  }
}

/** Relit les lignes `prospection_capture` d'une grille (espece/categorie) donnée. */
export async function listProspectionCaptures(
  prospectionId: string,
  espece: string,
  categorie: string
): Promise<CaptureRow[]> {
  const db = await getDb();
  return db.getAllAsync<CaptureRow>(
    'SELECT espece, categorie, sexe, phase, stade, effectif FROM prospection_capture WHERE prospection_id = ? AND espece = ? AND categorie = ?',
    [prospectionId, espece, categorie]
  );
}

/** Relit toutes les lignes `prospection_capture` d'une fiche, toutes grilles espèce/catégorie confondues. */
export async function listAllProspectionCaptures(prospectionId: string): Promise<CaptureRow[]> {
  const db = await getDb();
  return db.getAllAsync<CaptureRow>(
    'SELECT espece, categorie, sexe, phase, stade, effectif FROM prospection_capture WHERE prospection_id = ?',
    [prospectionId]
  );
}

/** Marque la fiche brouillon comme complète (statut 'en_attente'), indépendamment de l'état réseau. */
export async function completeProspection(id: string): Promise<DraftProspection> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync("UPDATE prospection SET statut = 'en_attente', updated_at = ? WHERE id = ?", [now, id]);

  const updated = await getProspection(id);
  if (!updated) {
    throw new Error('Échec de la mise à jour de la fiche brouillon locale');
  }
  return updated;
}

/** Marque la fiche comme synchronisée avec le serveur, après succès de l'envoi. */
export async function markProspectionSynced(id: string): Promise<DraftProspection> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync("UPDATE prospection SET statut_sync = 'synced', updated_at = ? WHERE id = ?", [now, id]);

  const updated = await getProspection(id);
  if (!updated) {
    throw new Error('Échec de la mise à jour de la fiche brouillon locale');
  }
  return updated;
}

/** Relit une fiche locale par id, ou `null` si elle n'existe pas. */
export async function getProspection(id: string): Promise<DraftProspection | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<DraftProspection>(
    'SELECT * FROM prospection WHERE id = ?',
    [id]
  );
  return row ?? null;
}

/** Liste les fiches encore à l'état brouillon, les plus récentes en premier. */
export async function listDraftProspections(): Promise<DraftProspection[]> {
  const db = await getDb();
  return db.getAllAsync<DraftProspection>(
    "SELECT * FROM prospection WHERE statut = 'brouillon' ORDER BY updated_at DESC"
  );
}

/** Liste les fiches locales les plus récentes, tous statuts confondus (pour l'accueil). */
export async function listRecentProspections(limit = 20): Promise<DraftProspection[]> {
  const db = await getDb();
  return db.getAllAsync<DraftProspection>(
    'SELECT * FROM prospection ORDER BY updated_at DESC LIMIT ?',
    [limit]
  );
}

/** Compte les fiches locales pas encore synchronisées avec le serveur. */
export async function countUnsyncedProspections(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM prospection WHERE statut_sync != 'synced'"
  );
  return row?.count ?? 0;
}
