import { getDb } from './prospection-db';
import { generateId } from './id';
import { logger } from './logger';

import { ExtensiveImagoSpeciesData, createEmptySpeciesData, IMAGO_PHASE_ROWS } from './prospection-extensive';
import { Espece } from './prospection-especes-stades';

const log = logger.child({ module: 'prospection-repository' });

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
  biotope?: string | null;
  region?: string | null;
  district?: string | null;
  commune?: string | null;
  za?: string | null;
  pa_code?: string | null;
  surfaceStation?: number | null;
  surfaceProspectee?: number | null;
  surfaceInfestee?: number | null;
  signalementSource?: string | null;
  signalementDate?: string | null;
  signalementDescription?: string | null;
}

export interface DraftProspection {
  id: string;
  type_prospection: string;
  campagne_id: string;
  prospecteur_id: string;
  station_id: string | null;
  biotope: string | null;
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
  station_libre: string | null;
  type_station: string | null;
  verdure_strate: string | null;
  signalement_source: string | null;
  signalement_date: string | null;
  signalement_description: string | null;
  conclusion_validation: string | null;
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
  surface_station: number | null;
  surface_prospectee: number | null;
  surface_infestee: number | null;
  degats_cultures: string | null;
  derniere_pluie: string | null;
  intensite_pluie: string | null;
  vegetation: string | null;
  sol: string | null;
  ennemis_naturels: string | null;
  observations: string | null;
  avertissements: string | null;
  statut: string;
  statut_sync: string;
  created_at: string;
  updated_at: string;
}

export interface ReferenceUpdateInput {
  latitude: number;
  longitude: number;
  altitude: number | null;
  surfaceStation: number;
  surfaceProspectee: number;
  surfaceInfestee: number;
  biotope?: string | null;
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

export interface ExtensiveReferenceUpdateInput {
  latitude: number | null;
  longitude: number | null;
  stationLibre: string | null;
  typeStation: string | null;
  surfaceStation: number | null;
  nMessage: string | null;
}

export interface ExtensiveObservationsUpdateInput {
  degatsCulturesPourcent: number | null;
  verdureStrate: string | null;
  hauteurHerbeCm: number | null;
  dernierePluie: string | null;
  intensitePluie: string | null;
}

export interface ObservationsUpdateInput {
  degatsCultures: string | null;
  ennemisNaturels: string | null;
  dernierePluie?: string | null;
  intensitePluie?: string | null;
  observations: string | null;
}

export interface VegetationUpdateInput {
  vegetation: string;
  sol: string;
  degatsCulturesPourcent?: number | null;
  verdissementPourcent?: number | null;
  hauteurHerbeCm?: number | null;
}

export interface CaptureRow {
  espece: 'LMC' | 'NSE';
  categorie: 'imago' | 'larve';
  sexe: 'F' | 'M' | null;
  phase: string | null;
  stade: string;
  effectif: number;
}

export interface PopulationRow {
  espece: 'LMC' | 'NSE';
  categorie: 'imago' | 'larve';
  phase?: string | null;
  captures_nombre?: number | null;
  temps_capture?: number | null;
  densite_diffuse: number | null;
  densite_groupee: number | null;
  methode: string | null;
  accouplement: string | null;
  ponte: string | null;
  captures_sol?: number | null;
  captures_trans?: number | null;
  captures_greg?: number | null;
  captures_solitaro_transiens?: number | null;
  stade_imago?: string | null;
  essaim_observe?: boolean | null;
  densites_larve?: string | null;
  tache_larvaire?: boolean | null;
  bande_larvaire?: boolean | null;
  interdistance?: number | null;
  deplacement?: string | null;
}

export interface InfestationRow {
  espece: string | null;
  type_cible: string;
  taille_min: number | null;
  taille_max: number | null;
  taille_moy: number | null;
  surface_totale: number | null;
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
  essaim_en_vol: number | null;
  essaim_pose: number | null;
  type_essaim: string | null;
  nb_taches_bandes: number | null;
  interdistance_m: number | null;
  interdistance_min: number | null;
  interdistance_max: number | null;
  interdistance_moy: number | null;
  surface_contaminee_ha: number | null;
  type_larve: string | null;
  surface_infestee_pourcent: number | null;
  stade_dominant: string | null;
  taille_groupe_m2: number | null;
  front_longueur_m: number | null;
  front_largeur_m: number | null;
  densite_max_front: number | null;
  densite_moy_arriere_front: number | null;
  heure_observation: string | null;
  densite_en_vol: number | null;
  dimension_ha: number | null;
}

const POPULATION_COLUMNS = `
  espece,
  categorie,
  phase,
  densite_diffuse,
  densite_groupee,
  methode,
  accouplement,
  ponte,
  captures_sol,
  captures_trans,
  captures_greg,
  captures_solitaro_transiens,
  stade_imago,
  essaim_observe,
  densites_larve,
  tache_larvaire,
  bande_larvaire,
  interdistance,
  deplacement
`;

const INFESTATION_COLUMNS = `
  espece,
  type_cible,
  taille_min,
  taille_max,
  taille_moy,
  surface_totale,
  densite_min,
  densite_max,
  densite_moy,
  interdistance,
  comportement,
  direction_de,
  direction_vers,
  vent_de,
  vent_vitesse,
  pullulation_nb,
  taille_long,
  taille_large,
  taille_epaisseur,
  essaim_en_vol,
  essaim_pose,
  type_essaim,
  nb_taches_bandes,
  interdistance_m,
  interdistance_min,
  interdistance_max,
  interdistance_moy,
  surface_contaminee_ha,
  type_larve,
  surface_infestee_pourcent,
  stade_dominant,
  taille_groupe_m2,
  front_longueur_m,
  front_largeur_m,
  densite_max_front,
  densite_moy_arriere_front,
  heure_observation,
  densite_en_vol,
  dimension_ha
`;

function normalizeBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true';
  return null;
}

function normalizePopulationRow(row: PopulationRow): PopulationRow {
  return {
    ...row,
    essaim_observe: normalizeBoolean(row.essaim_observe),
    tache_larvaire: normalizeBoolean(row.tache_larvaire),
    bande_larvaire: normalizeBoolean(row.bande_larvaire),
  };
}

export async function createDraftProspection(input: DraftProspectionInput): Promise<DraftProspection> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO prospection (
      id, type_prospection, campagne_id, prospecteur_id, station_id,
      biotope, region, district, commune, za, pa_code,
      date_prospection, latitude, longitude, altitude,
      surface_station, surface_prospectee, surface_infestee,
      signalement_source, signalement_date, signalement_description,
      statut, statut_sync, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'brouillon', 'local', ?, ?)`,
    [
      input.id, input.typeProspection, input.campagneId, input.prospecteurId, input.stationId ?? null,
      input.biotope ?? null, input.region ?? null, input.district ?? null, input.commune ?? null,
      input.za ?? null, input.pa_code ?? null, input.dateProspection,
      input.latitude ?? null, input.longitude ?? null, input.altitude ?? null,
      input.surfaceStation ?? null, input.surfaceProspectee ?? null, input.surfaceInfestee ?? null,
      input.signalementSource ?? null, input.signalementDate ?? null, input.signalementDescription ?? null,
      now, now
    ]
  );

  const created = await getProspection(input.id);
  if (!created) throw new Error('Échec de la création de la fiche brouillon locale');
  return created;
}

export async function updateProspectionReference(id: string, input: ReferenceUpdateInput): Promise<DraftProspection> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE prospection SET
      latitude = ?, longitude = ?, altitude = ?,
      surface_station = ?, surface_prospectee = ?, surface_infestee = ?,
      biotope = ?, n_fiche = ?, n_releve = ?,
      region = ?, district = ?, commune = ?, za = ?, pa_code = ?, pa_nom = ?,
      station_id = ?, station_nom = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.latitude, input.longitude, input.altitude,
      input.surfaceStation, input.surfaceProspectee, input.surfaceInfestee,
      input.biotope ?? null, input.nFiche, input.nReleve ?? null,
      input.region ?? null, input.district ?? null, input.commune ?? null,
      input.za ?? null, input.pa_code ?? null, input.pa_nom ?? null,
      input.stationId ?? null, input.station_nom ?? null,
      now, id
    ]
  );

  const updated = await getProspection(id);
  if (!updated) throw new Error('Échec de la mise à jour de la fiche brouillon locale');
  return updated;
}

export async function updateProspectionEspeces(id: string, especes: string): Promise<DraftProspection> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync('UPDATE prospection SET especes = ?, updated_at = ? WHERE id = ?', [especes, now, id]);

  const updated = await getProspection(id);
  if (!updated) throw new Error('Échec de la mise à jour de la fiche brouillon locale');
  return updated;
}

export async function updateProspectionExtensiveReference(id: string, input: ExtensiveReferenceUpdateInput): Promise<DraftProspection> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE prospection SET
      latitude = ?, longitude = ?, station_libre = ?, type_station = ?,
      surface_station = ?, n_message = ?, updated_at = ?
     WHERE id = ?`,
    [input.latitude, input.longitude, input.stationLibre, input.typeStation, input.surfaceStation, input.nMessage, now, id]
  );

  const updated = await getProspection(id);
  if (!updated) throw new Error('Échec de la mise à jour de la fiche brouillon locale');
  return updated;
}

export async function updateProspectionExtensiveObservations(id: string, input: ExtensiveObservationsUpdateInput): Promise<DraftProspection> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE prospection SET
      degats_cultures_pourcent = ?, verdure_strate = ?, hauteur_herbe_cm = ?,
      derniere_pluie = ?, intensite_pluie = ?, updated_at = ?
     WHERE id = ?`,
    [input.degatsCulturesPourcent, input.verdureStrate, input.hauteurHerbeCm, input.dernierePluie, input.intensitePluie, now, id]
  );

  const updated = await getProspection(id);
  if (!updated) throw new Error('Échec de la mise à jour de la fiche brouillon locale');
  return updated;
}

export async function concludeValidation(id: string, conclusion: 'confirmee' | 'infirmee'): Promise<DraftProspection> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(`UPDATE prospection SET conclusion_validation = ?, updated_at = ? WHERE id = ?`, [conclusion, now, id]);

  const updated = await getProspection(id);
  if (!updated) throw new Error('Échec de la mise à jour de la fiche brouillon locale');
  return updated;
}

export async function startCaptureTimer(id: string): Promise<DraftProspection> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE prospection SET capture_started_at = ?, updated_at = ? WHERE id = ? AND capture_started_at IS NULL`,
    [now, now, id]
  );

  const updated = await getProspection(id);
  if (!updated) throw new Error('Échec de la mise à jour de la fiche brouillon locale');
  return updated;
}

export async function markGrilleCompleted(id: string, grilleKey: string): Promise<DraftProspection> {
  const db = await getDb();
  const now = new Date().toISOString();

  const current = await getProspection(id);
  let existing: unknown[] = [];
  if (current?.grilles_completees) {
    try {
      const parsed = JSON.parse(current.grilles_completees);
      if (Array.isArray(parsed)) existing = parsed;
    } catch (error) {
      // Silence délibéré : la liste des grilles complétées est un indicateur
      // d'avancement, pas une donnée de terrain. La reconstruire depuis vide
      // fait au pire remontrer une grille déjà remplie.
      log.ignore(
        error,
        'Liste des grilles complétées corrompue — reconstruite depuis vide.'
      );
      existing = [];
    }
  }

  const completed = new Set<string>(existing.filter((v): v is string => typeof v === 'string'));
  completed.add(grilleKey);

  await db.runAsync(`UPDATE prospection SET grilles_completees = ?, updated_at = ? WHERE id = ?`, [JSON.stringify([...completed]), now, id]);

  const updated = await getProspection(id);
  if (!updated) throw new Error('Échec de la mise à jour de la fiche brouillon locale');
  return updated;
}

export async function updateProspectionObservations(id: string, input: ObservationsUpdateInput): Promise<DraftProspection> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE prospection SET
      degats_cultures = ?, ennemis_naturels = ?, observations = ?,
      derniere_pluie = ?, intensite_pluie = ?, updated_at = ?
     WHERE id = ?`,
    [input.degatsCultures, input.ennemisNaturels, input.observations, input.dernierePluie ?? null, input.intensitePluie ?? null, now, id]
  );

  const updated = await getProspection(id);
  if (!updated) throw new Error('Échec de la mise à jour de la fiche brouillon locale');
  return updated;
}

export async function updateProspectionAvertissements(id: string, avertissements: string[]): Promise<DraftProspection> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(`UPDATE prospection SET avertissements = ?, updated_at = ? WHERE id = ?`, [JSON.stringify(avertissements), now, id]);

  const updated = await getProspection(id);
  if (!updated) throw new Error('Échec de la mise à jour de la fiche brouillon locale');
  return updated;
}

export async function updateProspectionVegetation(id: string, input: VegetationUpdateInput): Promise<DraftProspection> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE prospection SET
      vegetation = ?, sol = ?,
      degats_cultures_pourcent = ?, verdissement_pourcent = ?, hauteur_herbe_cm = ?,
      updated_at = ?
     WHERE id = ?`,
    [input.vegetation, input.sol, input.degatsCulturesPourcent ?? null, input.verdissementPourcent ?? null, input.hauteurHerbeCm ?? null, now, id]
  );

  const updated = await getProspection(id);
  if (!updated) throw new Error('Échec de la mise à jour de la fiche brouillon locale');
  return updated;
}

export async function saveProspectionCaptures(prospectionId: string, espece: string, categorie: string, rows: CaptureRow[]): Promise<void> {
  const db = await getDb();

  await db.runAsync(`DELETE FROM prospection_capture WHERE prospection_id = ? AND espece = ? AND categorie = ?`, [prospectionId, espece, categorie]);

  for (const row of rows) {
    await db.runAsync(
      `INSERT INTO prospection_capture (id, prospection_id, espece, categorie, sexe, phase, stade, effectif)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [generateId(), prospectionId, row.espece, row.categorie, row.sexe ?? null, row.phase ?? null, row.stade, row.effectif]
    );
  }
}

export async function listProspectionCaptures(prospectionId: string, espece: string, categorie: string): Promise<CaptureRow[]> {
  const db = await getDb();
  return db.getAllAsync<CaptureRow>(
    `SELECT espece, categorie, sexe, phase, stade, effectif FROM prospection_capture
     WHERE prospection_id = ? AND espece = ? AND categorie = ?`,
    [prospectionId, espece, categorie]
  );
}

export async function listAllProspectionCaptures(prospectionId: string): Promise<CaptureRow[]> {
  const db = await getDb();
  return db.getAllAsync<CaptureRow>(
    `SELECT espece, categorie, sexe, phase, stade, effectif FROM prospection_capture WHERE prospection_id = ?`,
    [prospectionId]
  );
}

export async function getProspectionPopulation(prospectionId: string, espece: string, categorie: string): Promise<PopulationRow | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<PopulationRow>(
    `SELECT ${POPULATION_COLUMNS} FROM prospection_population WHERE prospection_id = ? AND espece = ? AND categorie = ?`,
    [prospectionId, espece, categorie]
  );
  return row ? normalizePopulationRow(row) : null;
}

export async function listAllProspectionPopulations(prospectionId: string): Promise<PopulationRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PopulationRow>(
    `SELECT ${POPULATION_COLUMNS} FROM prospection_population WHERE prospection_id = ?`,
    [prospectionId]
  );
  return rows.map(normalizePopulationRow);
}

export async function saveProspectionPopulation(
  prospectionId: string,
  row: PopulationRow
): Promise<void> {
  const db = await getDb();

  const existing = await db.getFirstAsync<{ id: string }>(
    `SELECT id
     FROM prospection_population
     WHERE prospection_id = ? AND espece = ? AND categorie = ?`,
    [prospectionId, row.espece, row.categorie]
  );

  if (existing) {
    await db.runAsync(
      `UPDATE prospection_population SET
        phase = ?,
        captures_nombre = ?,
        temps_capture = ?,
        densite_diffuse = ?,
        densite_groupee = ?,
        methode = ?,
        accouplement = ?,
        ponte = ?,
        captures_sol = ?,
        captures_trans = ?,
        captures_greg = ?,
        captures_solitaro_transiens = ?,
        stade_imago = ?,
        essaim_observe = ?,
        densites_larve = ?,
        tache_larvaire = ?,
        bande_larvaire = ?,
        interdistance = ?,
        deplacement = ?
       WHERE id = ?`,
      [
        row.phase ?? null,
        row.captures_nombre ?? null,
        row.temps_capture ?? null,
        row.densite_diffuse ?? null,
        row.densite_groupee ?? null,
        row.methode ?? null,
        row.accouplement ?? null,
        row.ponte ?? null,
        row.captures_sol ?? null,
        row.captures_trans ?? null,
        row.captures_greg ?? null,
        row.captures_solitaro_transiens ?? null,
        row.stade_imago ?? null,
        normalizeBoolean(row.essaim_observe),
        row.densites_larve ?? null,
        normalizeBoolean(row.tache_larvaire),
        normalizeBoolean(row.bande_larvaire),
        row.interdistance ?? null,
        row.deplacement ?? null,
        existing.id,
      ]
    );

    return;
  }

  await db.runAsync(
    `INSERT INTO prospection_population (
      id,
      prospection_id,
      espece,
      categorie,
      phase,
      captures_nombre,
      temps_capture,
      densite_diffuse,
      densite_groupee,
      methode,
      accouplement,
      ponte,
      captures_sol,
      captures_trans,
      captures_greg,
      captures_solitaro_transiens,
      stade_imago,
      essaim_observe,
      densites_larve,
      tache_larvaire,
      bande_larvaire,
      interdistance,
      deplacement
    )
    VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )`,
    [
      generateId(),
      prospectionId,
      row.espece,
      row.categorie,
      row.phase ?? null,
      row.captures_nombre ?? null,
      row.temps_capture ?? null,
      row.densite_diffuse ?? null,
      row.densite_groupee ?? null,
      row.methode ?? null,
      row.accouplement ?? null,
      row.ponte ?? null,
      row.captures_sol ?? null,
      row.captures_trans ?? null,
      row.captures_greg ?? null,
      row.captures_solitaro_transiens ?? null,
      row.stade_imago ?? null,
      normalizeBoolean(row.essaim_observe),
      row.densites_larve ?? null,
      normalizeBoolean(row.tache_larvaire),
      normalizeBoolean(row.bande_larvaire),
      row.interdistance ?? null,
      row.deplacement ?? null,
    ]
  );
}

export async function getProspectionInfestation(prospectionId: string, typeCible: string): Promise<InfestationRow | null> {
  const db = await getDb();
  const result = await db.getFirstAsync<InfestationRow>(
    `SELECT ${INFESTATION_COLUMNS} FROM prospection_infestation WHERE prospection_id = ? AND type_cible = ?`,
    [prospectionId, typeCible]
  );
  return result ?? null;
}

export async function listAllProspectionInfestations(prospectionId: string): Promise<InfestationRow[]> {
  const db = await getDb();
  return db.getAllAsync<InfestationRow>(
    `SELECT ${INFESTATION_COLUMNS} FROM prospection_infestation WHERE prospection_id = ?`,
    [prospectionId]
  );
}

export async function saveProspectionInfestation(prospectionId: string, typeCible: string, row: InfestationRow): Promise<void> {
  const db = await getDb();

  const existing = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM prospection_infestation WHERE prospection_id = ? AND type_cible = ?`,
    [prospectionId, typeCible]
  );

  // ✅ Correction : 41 valeurs (une colonne en moins)
  const values = [
    row.espece, row.type_cible, row.taille_min, row.taille_max, row.taille_moy,
    row.surface_totale, row.densite_min, row.densite_max, row.densite_moy,
    row.interdistance, row.comportement, row.direction_de, row.direction_vers,
    row.vent_de, row.vent_vitesse, row.pullulation_nb, row.taille_long,
    row.taille_large, row.taille_epaisseur, row.essaim_en_vol ?? null,
    row.essaim_pose ?? null, row.type_essaim, row.nb_taches_bandes,
    row.interdistance_m, row.interdistance_min, row.interdistance_max,
    row.interdistance_moy, row.surface_contaminee_ha, row.type_larve,
    row.surface_infestee_pourcent, row.stade_dominant, row.taille_groupe_m2,
    row.front_longueur_m, row.front_largeur_m, row.densite_max_front,
    row.densite_moy_arriere_front, row.heure_observation, row.densite_en_vol,
    row.dimension_ha,
  ];

  if (existing) {
    await db.runAsync(
      `UPDATE prospection_infestation SET
        espece = ?, type_cible = ?, taille_min = ?, taille_max = ?, taille_moy = ?,
        surface_totale = ?, densite_min = ?, densite_max = ?, densite_moy = ?,
        interdistance = ?, comportement = ?, direction_de = ?, direction_vers = ?,
        vent_de = ?, vent_vitesse = ?, pullulation_nb = ?, taille_long = ?,
        taille_large = ?, taille_epaisseur = ?, essaim_en_vol = ?,
        essaim_pose = ?, type_essaim = ?, nb_taches_bandes = ?,
        interdistance_m = ?, interdistance_min = ?, interdistance_max = ?,
        interdistance_moy = ?, surface_contaminee_ha = ?, type_larve = ?,
        surface_infestee_pourcent = ?, stade_dominant = ?, taille_groupe_m2 = ?,
        front_longueur_m = ?, front_largeur_m = ?, densite_max_front = ?,
        densite_moy_arriere_front = ?, heure_observation = ?, densite_en_vol = ?,
        dimension_ha = ?
       WHERE id = ?`,
      [...values, existing.id]
    );
    return;
  }

  // ✅ Correction : 41 colonnes dans l'INSERT (une colonne en moins)
  await db.runAsync(
    `INSERT INTO prospection_infestation (
      id, prospection_id, espece, type_cible, taille_min, taille_max,
      taille_moy, surface_totale, densite_min, densite_max, densite_moy,
      interdistance, comportement, direction_de, direction_vers, vent_de,
      vent_vitesse, pullulation_nb, taille_long, taille_large, taille_epaisseur,
      essaim_en_vol, essaim_pose, type_essaim, nb_taches_bandes,
      interdistance_m, interdistance_min, interdistance_max, interdistance_moy,
      surface_contaminee_ha, type_larve, surface_infestee_pourcent,
      stade_dominant, taille_groupe_m2, front_longueur_m, front_largeur_m,
      densite_max_front, densite_moy_arriere_front, heure_observation,
      densite_en_vol, dimension_ha
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [generateId(), prospectionId, ...values]
  );
}
export async function completeProspection(id: string): Promise<DraftProspection> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(`UPDATE prospection SET statut = 'en_attente', updated_at = ? WHERE id = ?`, [now, id]);

  const updated = await getProspection(id);
  if (!updated) throw new Error('Échec de la mise à jour de la fiche brouillon locale');
  return updated;
}

export async function markProspectionSynced(id: string): Promise<DraftProspection> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(`UPDATE prospection SET statut_sync = 'synced', updated_at = ? WHERE id = ?`, [now, id]);

  const updated = await getProspection(id);
  if (!updated) throw new Error('Échec de la mise à jour de la fiche brouillon locale');
  return updated;
}

export async function deleteDraftProspection(draft: DraftProspection): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(`UPDATE prospection SET statut = 'supprime', updated_at = ? WHERE id = ?`, [now, draft.id]);
}

export async function getProspection(id: string): Promise<DraftProspection | null> {
  const db = await getDb();
  const result = await db.getFirstAsync<DraftProspection>(`SELECT * FROM prospection WHERE id = ?`, [id]);
  return result ?? null;
}

export async function listDraftProspections(): Promise<DraftProspection[]> {
  const db = await getDb();
  return db.getAllAsync<DraftProspection>(`SELECT * FROM prospection WHERE statut = 'brouillon' ORDER BY updated_at DESC`);
}

export async function listRecentProspections(limit = 20): Promise<DraftProspection[]> {
  const db = await getDb();
  return db.getAllAsync<DraftProspection>(`SELECT * FROM prospection ORDER BY updated_at DESC LIMIT ?`, [limit]);
}

export async function listValidatedProspections(): Promise<DraftProspection[]> {
  const db = await getDb();
  return db.getAllAsync<DraftProspection>(
    `SELECT * FROM prospection WHERE type_prospection IN ('extensive', 'validation') AND statut_sync = 'synced' ORDER BY updated_at DESC`
  );
}

export async function listProspectionsRecentesAutresProspecteurs(
  prospecteurId: string,
  sinceIso: string
): Promise<{ prospecteur_id: string; latitude: number; longitude: number; updated_at: string }[]> {
  const db = await getDb();
  return db.getAllAsync<{ prospecteur_id: string; latitude: number; longitude: number; updated_at: string }>(
    `SELECT prospecteur_id, latitude, longitude, updated_at FROM prospection
     WHERE prospecteur_id != ? AND updated_at >= ? AND latitude IS NOT NULL AND longitude IS NOT NULL`,
    [prospecteurId, sinceIso]
  );
}

export async function getDerniereDensiteMemeSite(stationId: string, typeCible: string, excludeProspectionId: string): Promise<number | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ densite_moy: number | null }>(
    `SELECT pi.densite_moy as densite_moy
     FROM prospection_infestation pi
     JOIN prospection p ON p.id = pi.prospection_id
     WHERE p.station_id = ? AND pi.type_cible = ? AND p.id != ? AND pi.densite_moy IS NOT NULL
     ORDER BY p.updated_at DESC LIMIT 1`,
    [stationId, typeCible, excludeProspectionId]
  );
  return row?.densite_moy ?? null;
}

export async function countUnsyncedProspections(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM prospection WHERE statut_sync != 'synced'`);
  return row?.count ?? 0;
}

export async function deleteProspection(id: string): Promise<boolean> {
  const db = await getDb();
  const result = await db.runAsync(`DELETE FROM prospection WHERE id = ?`, [id]);
  return result.changes > 0;
}

export async function saveExtensiveImagoSpeciesData(
  prospectionId: string,
  espece: Espece,
  data: ExtensiveImagoSpeciesData
): Promise<void> {
  const db = await getDb();

  const row: PopulationRow = {
    espece,
    categorie: 'imago',
    densite_diffuse: data.popDiff ? parseFloat(data.popDiff) : null,
    densite_groupee: data.popGroup ? parseFloat(data.popGroup) : null,
    methode: null,
    accouplement: null,
    ponte: null,
    captures_sol: data.phases.solitaire,
    captures_trans: data.phases.transiens,
    captures_greg: data.phases.gregaire,
    captures_solitaro_transiens: data.phases.solitaroTransiens,
    stade_imago: 'A1',
    essaim_observe: data.typeCapture === 'essaim',
  };

  await saveProspectionPopulation(prospectionId, row);
}

export async function loadExtensiveImagoSpeciesData(
  prospectionId: string,
  espece: Espece
): Promise<ExtensiveImagoSpeciesData> {
  const db = await getDb();

  const row = await db.getFirstAsync<PopulationRow>(
    `SELECT 
      espece, categorie, densite_diffuse, densite_groupee,
      captures_sol, captures_trans, captures_greg, captures_solitaro_transiens,
      stade_imago, essaim_observe
     FROM prospection_population
     WHERE prospection_id = ? AND espece = ? AND categorie = ?`,
    [prospectionId, espece, 'imago']
  );

  if (!row) return createEmptySpeciesData();

  return {
    totalCaptures: (row.captures_sol ?? 0) + (row.captures_trans ?? 0) + (row.captures_greg ?? 0) + (row.captures_solitaro_transiens ?? 0),
    activePhase: 'solitaire',
    phases: {
      solitaire: row.captures_sol ?? 0,
      transiens: row.captures_trans ?? 0,
      solitaroTransiens: row.captures_solitaro_transiens ?? 0,
      gregaire: row.captures_greg ?? 0,
    },
    stades: {
      femelleA1: 0, femelleA2: 0, femelleA3: 0,
      femelleA3_1_4: 0, femelleA3_1_2: 0, femelleA3_3_4: 0,
      femelleA3_4_4: 0, femelleA4: 0, femelleA5: 0,
      maleA1: 0, maleA123: 0, maleA5: 0,
    },
    popDiff: row.densite_diffuse != null ? String(row.densite_diffuse) : '',
    popGroup: row.densite_groupee != null ? String(row.densite_groupee) : '',
    typeCapture: Boolean(row.essaim_observe) ? 'essaim' : 'volClair',
  };
}

export async function saveCompleteExtensiveImagoData(
  prospectionId: string,
  espece: Espece,
  data: ExtensiveImagoSpeciesData
): Promise<void> {
  await saveExtensiveImagoSpeciesData(prospectionId, espece, data);
}

export async function loadCompleteExtensiveImagoData(
  prospectionId: string,
  espece: Espece
): Promise<ExtensiveImagoSpeciesData> {
  return loadExtensiveImagoSpeciesData(prospectionId, espece);
}