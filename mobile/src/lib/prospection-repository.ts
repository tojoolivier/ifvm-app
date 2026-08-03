import { getDb } from './prospection-db';
import { generateId } from './id';

export type TypeProspection = 'intensive' | 'extensive' | 'validation';

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
  region?: string | null;
  district?: string | null;
  commune?: string | null;
  za?: string | null;
  pa_code?: string | null;
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
  region: string | null;
  district: string | null;
  commune: string | null;
  za: string | null;
  pa_code: string | null;
  pa_nom: string | null;
  station_nom: string | null;
  degats_cultures_pourcent: number | null;
  verdissement_pourcent: number | null;
  hauteur_herbe_cm: number | null;
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
  surf_station: number | null;
  surf_prospectee: number | null;
  surf_infestee: number | null;
  degats_cultures: string | null;
  derniere_pluie: string | null;
  intensite_pluie: string | null;
  vegetation: string | null;
  sol: string | null;
  ennemis_naturels: string | null;
  observations: string | null;
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
  nReleve?: string | null;
  region?: string | null;
  district?: string | null;
  commune?: string | null;
  za?: string | null;
  pa_code?: string | null;
  pa_nom?: string | null;
  stationId?: string | null;
  station_nom?: string | null;
}

export async function createDraftProspection(
  input: DraftProspectionInput
): Promise<DraftProspection> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO prospection (
      id, type_prospection, campagne_id, prospecteur_id, station_id,
      region, district, commune, za, pa_code,
      date_prospection, latitude, longitude, altitude,
      surf_station, surf_prospectee, surf_infestee,
      statut, statut_sync, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'brouillon', 'local', ?, ?)`,
    [
      input.id,
      input.typeProspection,
      input.campagneId,
      input.prospecteurId,
      input.stationId ?? null,
      input.region ?? null,
      input.district ?? null,
      input.commune ?? null,
      input.za ?? null,
      input.pa_code ?? null,
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
      n_fiche = ?, n_releve = ?,
      region = ?, district = ?, commune = ?, za = ?, pa_code = ?, pa_nom = ?,
      station_id = ?, station_nom = ?,
      updated_at = ?
     WHERE id = ?`,
    [
      input.latitude,
      input.longitude,
      input.altitude,
      input.surfStation,
      input.surfProspectee,
      input.surfInfestee,
      input.nFiche,
      input.nReleve ?? null,
      input.region ?? null,
      input.district ?? null,
      input.commune ?? null,
      input.za ?? null,
      input.pa_code ?? null,
      input.pa_nom ?? null,
      input.stationId ?? null,
      input.station_nom ?? null,
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

export interface VegetationUpdateInput {
  vegetation: string;
  sol: string;
  degatsCultures: string | null;
  degatsCulturesPourcent?: number | null;
  verdissementPourcent?: number | null;
  hauteurHerbeCm?: number | null;
  ennemisNaturels?: string | null;
  observations?: string | null;
}

// Dans updateProspectionVegetation, corriger la chaîne SQL
export async function updateProspectionVegetation(
  id: string,
  input: VegetationUpdateInput
): Promise<DraftProspection> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE prospection SET
      vegetation = ?, sol = ?, degats_cultures = ?,
      degats_cultures_pourcent = ?, verdissement_pourcent = ?, hauteur_herbe_cm = ?,
      ennemis_naturels = ?, observations = ?,
      updated_at = ? WHERE id = ?`,
    [
      input.vegetation,
      input.sol,
      input.degatsCultures,
      input.degatsCulturesPourcent ?? null,
      input.verdissementPourcent ?? null,
      input.hauteurHerbeCm ?? null,
      input.ennemisNaturels ?? null,
      input.observations ?? null,
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

export interface CaptureRow {
  espece: 'LMC' | 'NSE';
  categorie: 'imago' | 'larve';
  sexe: 'F' | 'M' | null;
  phase: string;
  stade: string;
  effectif: number;
}

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

export async function listAllProspectionCaptures(prospectionId: string): Promise<CaptureRow[]> {
  const db = await getDb();
  return db.getAllAsync<CaptureRow>(
    'SELECT espece, categorie, sexe, phase, stade, effectif FROM prospection_capture WHERE prospection_id = ?',
    [prospectionId]
  );
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

export async function listAllProspectionPopulations(prospectionId: string): Promise<PopulationRow[]> {
  const db = await getDb();
  return db.getAllAsync<PopulationRow>(
    'SELECT espece, categorie, densite_diffuse, densite_groupee, methode, accouplement, ponte FROM prospection_population WHERE prospection_id = ?',
    [prospectionId]
  );
}

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
  direction_de: string | null;
  direction_vers: string | null;
  vent_de: string | null;
  vent_vitesse: number | null;
  pullulation_nb: number | null;
  taille_long: number | null;
  taille_large: number | null;
  taille_epaisseur: number | null;
  essaim_en_vol: boolean | null;
  essaim_pose: boolean | null;
  type_essaim: string | null;
  nb_taches_bandes: number | null;
  interdistance_m: number | null;
  surface_contaminee_ha: number | null;
  type_larve: string | null;
  surf_infestee_pourcent: number | null;
}

const INFESTATION_COLUMNS = `espece, type_cible, taille_min, taille_max, taille_moy, surface_tot,
            densite_min, densite_max, densite_moy, interdistance,
            comportement, direction_de, direction_vers, vent_de, vent_vitesse,
            pullulation_nb, taille_long, taille_large, taille_epaisseur,
            essaim_en_vol, essaim_pose, type_essaim,
            nb_taches_bandes, interdistance_m, surface_contaminee_ha,
            type_larve, surf_infestee_pourcent`;

export async function getProspectionInfestation(
  prospectionId: string,
  typeCible: string
): Promise<InfestationRow | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<InfestationRow>(
    `SELECT ${INFESTATION_COLUMNS} FROM prospection_infestation WHERE prospection_id = ? AND type_cible = ?`,
    [prospectionId, typeCible]
  );
  return row ?? null;
}

export async function listAllProspectionInfestations(prospectionId: string): Promise<InfestationRow[]> {
  const db = await getDb();
  return db.getAllAsync<InfestationRow>(
    `SELECT ${INFESTATION_COLUMNS} FROM prospection_infestation WHERE prospection_id = ?`,
    [prospectionId]
  );
}

export async function saveProspectionInfestation(
  prospectionId: string,
  typeCible: string,
  row: InfestationRow
): Promise<void> {
  const db = await getDb();
  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM prospection_infestation WHERE prospection_id = ? AND type_cible = ?',
    [prospectionId, typeCible]
  );

  // Convertir les booleans en nombres pour SQLite
  const essaimEnVol = row.essaim_en_vol === true ? 1 : (row.essaim_en_vol === false ? 0 : null);
  const essaimPose = row.essaim_pose === true ? 1 : (row.essaim_pose === false ? 0 : null);

  const values = [
    row.espece,
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
    row.direction_de,
    row.direction_vers,
    row.vent_de,
    row.vent_vitesse,
    row.pullulation_nb,
    row.taille_long,
    row.taille_large,
    row.taille_epaisseur,
    essaimEnVol,
    essaimPose,
    row.type_essaim,
    row.nb_taches_bandes,
    row.interdistance_m,
    row.surface_contaminee_ha,
    row.type_larve,
    row.surf_infestee_pourcent,
  ];

  if (existing) {
    await db.runAsync(
      `UPDATE prospection_infestation SET
        espece = ?, type_cible = ?, taille_min = ?, taille_max = ?, taille_moy = ?, surface_tot = ?,
        densite_min = ?, densite_max = ?, densite_moy = ?, interdistance = ?,
        comportement = ?, direction_de = ?, direction_vers = ?, vent_de = ?, vent_vitesse = ?,
        pullulation_nb = ?, taille_long = ?, taille_large = ?, taille_epaisseur = ?,
        essaim_en_vol = ?, essaim_pose = ?, type_essaim = ?,
        nb_taches_bandes = ?, interdistance_m = ?, surface_contaminee_ha = ?,
        type_larve = ?, surf_infestee_pourcent = ?
       WHERE id = ?`,
      [...values, existing.id]
    );
  } else {
    await db.runAsync(
      `INSERT INTO prospection_infestation (
        id, prospection_id, espece, type_cible, taille_min, taille_max, taille_moy, surface_tot,
        densite_min, densite_max, densite_moy, interdistance,
        comportement, direction_de, direction_vers, vent_de, vent_vitesse,
        pullulation_nb, taille_long, taille_large, taille_epaisseur,
        essaim_en_vol, essaim_pose, type_essaim,
        nb_taches_bandes, interdistance_m, surface_contaminee_ha,
        type_larve, surf_infestee_pourcent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [generateId(), prospectionId, ...values]
    );
  }
}

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

export async function getProspection(id: string): Promise<DraftProspection | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<DraftProspection>(
    'SELECT * FROM prospection WHERE id = ?',
    [id]
  );
  return row ?? null;
}

export async function listDraftProspections(): Promise<DraftProspection[]> {
  const db = await getDb();
  return db.getAllAsync<DraftProspection>(
    "SELECT * FROM prospection WHERE statut = 'brouillon' ORDER BY updated_at DESC"
  );
}

export async function listRecentProspections(limit = 20): Promise<DraftProspection[]> {
  const db = await getDb();
  return db.getAllAsync<DraftProspection>(
    'SELECT * FROM prospection ORDER BY updated_at DESC LIMIT ?',
    [limit]
  );
}

export async function countUnsyncedProspections(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM prospection WHERE statut_sync != 'synced'"
  );
  return row?.count ?? 0;
}

export async function deleteProspection(id: string): Promise<boolean> {
  const db = await getDb();
  const result = await db.runAsync(
    'DELETE FROM prospection WHERE id = ?',
    [id]
  );
  return result.changes > 0;
}