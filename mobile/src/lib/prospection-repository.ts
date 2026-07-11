import { getDb } from './prospection-db';

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
  date_prospection: string;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  surf_station: number | null;
  surf_prospectee: number | null;
  surf_infestee: number | null;
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
