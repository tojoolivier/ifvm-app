import { getDb, DraftProspection } from './prospection-db';
import { generateId } from './id';

export type TypeProspection = 'intensive' | 'extensive' | 'validation';
export type { DraftProspection };

export interface DraftProspectionInput {
  id: string;
  typeProspection: TypeProspection;
  campagneId: string;
  prospecteurId: string;
  dateProspection: string;
  stationId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  altitude?: number | null;
  surfStation?: number | null;
  surfProspectee?: number | null;
  surfInfestee?: number | null;
}

export interface ReferenceUpdateInput {
  typeProspection: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  nReleve: string | null;
  nMessage: string | null;
  surfStation: number;
  surfProspectee: number;
  surfInfestee: number;
  nFiche: string;
  dateProspection: string;
}

export interface VegetationUpdateInput {
  vegetation: string;
  sol: string;
  degatsCultures: string | null;
  verdissement: number | null;
  hauteurStrate: number | null;  
}

export interface EssaimUpdateInput {
  essaim_type: string | null;
  essaim_vol_dir_de: string | null;
  essaim_vol_dir_vers: string | null;
  essaim_pose: boolean | null;
  surface_contaminee: number | null;
}

export interface PullulationUpdateInput {
  pullulation_nb: number | null;
  interdistance: number | null;
  taille_info: string | null;
}

export interface CaptureRow {
  espece: 'LMC' | 'NSE';
  categorie: 'imago' | 'larve';
  sexe: 'F' | 'M' | null;
  phase: string;
  stade: string;
  effectif: number;
}

export interface PopulationRow {
  espece: 'LMC' | 'NSE';
  categorie: 'imago' | 'larve';
  densite_diffuse: number | null;
  densite_groupee: number | null;
  methode: string | null;
  accouplement: string | null;
  ponte: string | null;
}

export interface InfestationRow {
  espece: string | null;
  type_cible: string;
  taille_min: number | null;
  taille_max: number | null;
  taille_moy: number | null;
  surface_tot: number | null;
  densite_min: number | null;
  densite_max: number | null;
  densite_moy: number | null;
  interdistance: number | null;
  comportement: string | null;
  direction_vers: string | null;
  vent_de: string | null;
  vent_vitesse: number | null;
}

/** Crée une fiche brouillon en local (SQLite) */
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

/** Persiste la position GPS, les surfaces et les champs de référence */
export async function updateProspectionReference(
  id: string,
  input: ReferenceUpdateInput
): Promise<DraftProspection> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE prospection SET
      type_prospection = ?,
      latitude = ?, longitude = ?, altitude = ?,
      n_releve = ?, n_message = ?,
      surf_station = ?, surf_prospectee = ?, surf_infestee = ?,
      n_fiche = ?, date_prospection = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.typeProspection,
      input.latitude,
      input.longitude,
      input.altitude,
      input.nReleve,
      input.nMessage,
      input.surfStation,
      input.surfProspectee,
      input.surfInfestee,
      input.nFiche,
      input.dateProspection,
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

/** Persiste la sélection espèces/stades */
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

/** Démarre le chrono de la session de captures */
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

/** Marque une grille comme terminée */
export async function markGrilleCompleted(id: string, grilleKey: string): Promise<DraftProspection> {
  const db = await getDb();
  const now = new Date().toISOString();

  const current = await getProspection(id);
  const existing: unknown = current?.grilles_completees ? JSON.parse(current.grilles_completees) : [];
  const completed = new Set<string>(Array.isArray(existing) ? existing : []);
  completed.add(grilleKey);

  await db.runAsync('UPDATE prospection SET grilles_completees = ?, updated_at = ? WHERE id = ?', [
    JSON.stringify([...completed]),
    now,
    id,
  ]);

  const updated = await getProspection(id);
  if (!updated) {
    throw new Error('Échec de la mise à jour de la fiche brouillon locale');
  }
  return updated;
}

/** Persiste la végétation, le sol, les dégâts culture et les champs généraux */
export async function updateProspectionVegetation(
  id: string,
  input: VegetationUpdateInput
): Promise<DraftProspection> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE prospection SET 
      vegetation = ?, sol = ?, degats_cultures = ?,
      verdissement = ?, hauteur_strate = ?,
      updated_at = ?
     WHERE id = ?`,
    [
      input.vegetation,
      input.sol,
      input.degatsCultures,
      input.verdissement,
      input.hauteurStrate,
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

/** Persiste les données essaim */
export async function updateProspectionEssaim(
  id: string,
  input: EssaimUpdateInput
): Promise<DraftProspection> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE prospection SET 
      essaim_type = ?, essaim_vol_dir_de = ?, essaim_vol_dir_vers = ?,
      essaim_pose = ?, surface_contaminee = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.essaim_type,
      input.essaim_vol_dir_de,
      input.essaim_vol_dir_vers,
      input.essaim_pose ? 1 : 0,
      input.surface_contaminee,
      now,
      id,
    ]
  );

  const updated = await getProspection(id);
  if (!updated) {
    throw new Error('Échec de la mise à jour des données essaim');
  }
  return updated;
}

/** Persiste les données pullulation */
export async function updateProspectionPullulation(
  id: string,
  input: PullulationUpdateInput
): Promise<DraftProspection> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE prospection SET 
      pullulation_nb = ?, interdistance = ?, taille_info = ?, updated_at = ?
     WHERE id = ?`,
    [input.pullulation_nb, input.interdistance, input.taille_info, now, id]
  );

  const updated = await getProspection(id);
  if (!updated) {
    throw new Error('Échec de la mise à jour des données pullulation');
  }
  return updated;
}

/** Remplace les lignes prospection_capture d'une grille */
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

/** Relit les lignes prospection_capture d'une grille */
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

/** Relit toutes les lignes prospection_capture d'une fiche */
export async function listAllProspectionCaptures(prospectionId: string): Promise<CaptureRow[]> {
  const db = await getDb();
  return db.getAllAsync<CaptureRow>(
    'SELECT espece, categorie, sexe, phase, stade, effectif FROM prospection_capture WHERE prospection_id = ?',
    [prospectionId]
  );
}

/** Relit la ligne prospection_population d'une espece/categorie */
export async function getProspectionPopulation(
  prospectionId: string,
  espece: string,
  categorie: string
): Promise<PopulationRow | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<PopulationRow>(
    'SELECT espece, categorie, densite_diffuse, densite_groupee, methode, accouplement, ponte FROM prospection_population WHERE prospection_id = ? AND espece = ? AND categorie = ?',
    [prospectionId, espece, categorie]
  );
  return row ?? null;
}

/** Insère ou remplace la ligne prospection_population */
export async function saveProspectionPopulation(prospectionId: string, row: PopulationRow): Promise<void> {
  const db = await getDb();
  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM prospection_population WHERE prospection_id = ? AND espece = ? AND categorie = ?',
    [prospectionId, row.espece, row.categorie]
  );
  if (existing) {
    await db.runAsync(
      'UPDATE prospection_population SET densite_diffuse = ?, densite_groupee = ?, methode = ?, accouplement = ?, ponte = ? WHERE id = ?',
      [row.densite_diffuse, row.densite_groupee, row.methode, row.accouplement, row.ponte, existing.id]
    );
  } else {
    await db.runAsync(
      `INSERT INTO prospection_population (id, prospection_id, espece, categorie, densite_diffuse, densite_groupee, methode, accouplement, ponte)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        generateId(),
        prospectionId,
        row.espece,
        row.categorie,
        row.densite_diffuse,
        row.densite_groupee,
        row.methode,
        row.accouplement,
        row.ponte,
      ]
    );
  }
}

/** Relit la ligne `prospection_infestation` d'une fiche, ou `null` si absente. */
export async function getProspectionInfestation(prospectionId: string): Promise<InfestationRow | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<InfestationRow>(
    `SELECT espece, type_cible, taille_min, taille_max, taille_moy, surface_tot,
            densite_min, densite_max, densite_moy, interdistance,
            comportement, direction_vers, vent_de, vent_vitesse
     FROM prospection_infestation WHERE prospection_id = ?`,
    [prospectionId]
  );
  return row ?? null;
}

/** Insère ou remplace l'unique ligne `prospection_infestation` d'une fiche. */
export async function saveProspectionInfestation(prospectionId: string, row: InfestationRow): Promise<void> {
  const db = await getDb();
  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM prospection_infestation WHERE prospection_id = ?',
    [prospectionId]
  );
  const values = [
    row.espece ?? null,  // ← AJOUTÉ
    row.type_cible,
    row.taille_min,
    row.taille_max,
    row.taille_moy,
    row.surface_tot,
    row.densite_min,
    row.densite_max,
    row.densite_moy,
    row.interdistance,
    row.comportement,
    row.direction_vers,
    row.vent_de,
    row.vent_vitesse,
  ];
  if (existing) {
    await db.runAsync(
      `UPDATE prospection_infestation SET
        espece = ?, type_cible = ?, taille_min = ?, taille_max = ?, taille_moy = ?, surface_tot = ?,
        densite_min = ?, densite_max = ?, densite_moy = ?, interdistance = ?,
        comportement = ?, direction_vers = ?, vent_de = ?, vent_vitesse = ?
       WHERE id = ?`,
      [...values, existing.id]
    );
  } else {
    await db.runAsync(
      `INSERT INTO prospection_infestation (
        id, prospection_id, espece, type_cible, taille_min, taille_max, taille_moy, surface_tot,
        densite_min, densite_max, densite_moy, interdistance,
        comportement, direction_vers, vent_de, vent_vitesse
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [generateId(), prospectionId, ...values]
    );
  }
}

/** Marque la fiche brouillon comme complète (statut 'en_attente') */
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

/** Marque la fiche comme synchronisée */
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

/** Relit une fiche locale par id */
export async function getProspection(id: string): Promise<DraftProspection | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<DraftProspection>(
    'SELECT * FROM prospection WHERE id = ?',
    [id]
  );
  return row ?? null;
}

/** Liste les fiches encore à l'état brouillon */
export async function listDraftProspections(): Promise<DraftProspection[]> {
  const db = await getDb();
  return db.getAllAsync<DraftProspection>(
    "SELECT * FROM prospection WHERE statut = 'brouillon' ORDER BY updated_at DESC"
  );
}

/** Liste les fiches locales les plus récentes */
export async function listRecentProspections(limit = 20): Promise<DraftProspection[]> {
  const db = await getDb();
  return db.getAllAsync<DraftProspection>(
    'SELECT * FROM prospection ORDER BY updated_at DESC LIMIT ?',
    [limit]
  );
}

/** Compte les fiches locales pas encore synchronisées */
export async function countUnsyncedProspections(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM prospection WHERE statut_sync != 'synced'"
  );
  return row?.count ?? 0;
}