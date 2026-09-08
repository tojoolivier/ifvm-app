import { getDb } from './prospection-db';
import { generateId } from './id';
import { logger } from './logger';

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
  /** Extensif uniquement — 'terrestre' | 'aerien' | null (terrestre implicite). Fixé
   * une fois à la création, jamais réécrit ensuite (cf. écran de choix du mode). */
  modeExtensif?: string | null;
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
  /** Extensif uniquement — 'terrestre' | 'aerien' | null (terrestre implicite,
   * fiche existante comme fiche extensive sans mode choisi). */
  mode_extensif: string | null;
  societe: string | null;
  immatricule_aeronef: string | null;
  pilote: string | null;
  mecanicien: string | null;
  chef_de_base: string | null;
  /** Remplace base/base_secondaire (texte libre) — migration backend 0047. FK
   * nullable vers le référentiel lieu_aerien (`listLieuxAeriens`, referentiel-db.ts) :
   * une prospection extensive aérienne « généralisée » n'est rattachée à aucune
   * base. Pas de base secondaire côté prospection. */
  lieu_base_id: string | null;
  /** Pesticides embarqués + signatures (mode aérien uniquement) — NULL en mode
   * terrestre. `pesticides_embarques` reste la valeur SQLite brute (0/1/NULL,
   * pas de type booléen natif) : normaliser avec `normalizeBoolean` à la lecture. */
  pesticides_embarques: number | null;
  pesticide_nom_commercial: string | null;
  pesticide_quantite_disponible: number | null;
  pesticide_quantite_recue: number | null;
  futs_disponible: number | null;
  futs_pleins: number | null;
  futs_vides: number | null;
  futs_recues: number | null;
  signature_visa_nom: string | null;
  signature_visa_horodatage: string | null;
  signature_consultant_fao_nom: string | null;
  signature_consultant_fao_horodatage: string | null;
  signature_consultant_fao_image: string | null;
  signature_pilote_nom: string | null;
  signature_pilote_horodatage: string | null;
  signature_pilote_image: string | null;
  signature_chef_base_nom: string | null;
  signature_chef_base_horodatage: string | null;
  signature_chef_base_image: string | null;
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
  /** Horodatage ISO de l'acquisition GPS sur l'écran Observations (§ heure d'observation
   * automatique) — distinct de `heure_observation` sur une ligne d'infestation. */
  heure_observation_at: string | null;
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
  surfaceInfestee: number | null;
  nMessage: string | null;
  /** Même colonne partagée `prospection.heure_observation_at` que l'Intensif
   * (cf. `ObservationsUpdateInput`) — capturée ici sur l'écran Référence, où
   * l'Extensif fait déjà son acquisition GPS (contrairement à l'Intensif, qui
   * la capture sur Observations). */
  heureObservationAt: string | null;
  /** Mode aérien uniquement — `null` en mode terrestre (colonnes inchangées, jamais
   * réclamées). `modeExtensif` lui-même n'est PAS ici : fixé une fois à la création
   * du brouillon (écran de choix), jamais réécrit par cet update. */
  societe?: string | null;
  immatriculeAeronef?: string | null;
  pilote?: string | null;
  mecanicien?: string | null;
  chefDeBase?: string | null;
  lieuBaseId?: string | null;
}

export interface ExtensiveObservationsUpdateInput {
  /** Choix unique Faible/Moyen/Forte — réutilise `prospection.degats_cultures`
   * (déjà utilisé par l'Intensif), pas de nouvelle colonne. Anciennes fiches
   * extensives qui n'avaient que `degats_cultures_pourcent` (stepper %,
   * remplacé par ce choix) : ce champ y reste `null`, sans erreur. */
  degatsCultures: string | null;
  /** Pourcentage 0-100 — réutilise `prospection.verdissement_pourcent` (déjà
   * utilisé par l'Intensif), pas de nouvelle colonne. Anciennes fiches
   * extensives qui n'avaient que `verdure_strate` (chip Faible/Moyenne/Forte,
   * remplacé par ce pourcentage) : ce champ y reste `null`, sans erreur. */
  verdissementPourcent: number | null;
  hauteurHerbeCm: number | null;
  dernierePluie: string | null;
  intensitePluie: string | null;
  /** Mode aérien uniquement — `null`/`undefined` en mode terrestre (colonnes
   * jamais réclamées, comme les champs équipe/aéronef sur Référence). */
  pesticidesEmbarques?: boolean | null;
  pesticideNomCommercial?: string | null;
  pesticideQuantiteDisponible?: number | null;
  pesticideQuantiteRecue?: number | null;
  futsDisponible?: number | null;
  futsPleins?: number | null;
  futsVides?: number | null;
  futsRecues?: number | null;
  signatureVisaNom?: string | null;
  signatureVisaHorodatage?: string | null;
  signatureConsultantFaoNom?: string | null;
  signatureConsultantFaoHorodatage?: string | null;
  /** Tracé SVG du pavé de signature (#signatures-digitales-extensif-aerien) —
   * même principe que `traitement_signature.signature_image`. */
  signatureConsultantFaoImage?: string | null;
  signaturePiloteNom?: string | null;
  signaturePiloteHorodatage?: string | null;
  signaturePiloteImage?: string | null;
  signatureChefBaseNom?: string | null;
  signatureChefBaseHorodatage?: string | null;
  signatureChefBaseImage?: string | null;
  /** « Remarques » (D — Observations) — les deux modes, terrestre et aérien.
   * Réutilise la colonne `prospection.observations` déjà câblée pour l'intensif
   * (même colonne, juste un intitulé différent à l'écran) : pas de nouvelle
   * colonne, pas de migration. */
  observations?: string | null;
}

export interface ObservationsUpdateInput {
  degatsCultures: string | null;
  ennemisNaturels: string | null;
  dernierePluie?: string | null;
  intensitePluie?: string | null;
  observations: string | null;
  heureObservationAt: string | null;
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
  /** Répartition par sexe/sous-stade (femelleA1..femelleA5, maleA1, maleA234,
   * maleA5), encodée en JSON — même pattern que `densites_larve` ci-dessous. */
  stades_imago?: string | null;
  essaim_observe?: boolean | null;
  densites_larve?: string | null;
  tache_larvaire?: boolean | null;
  bande_larvaire?: boolean | null;
  interdistance?: number | null;
  deplacement?: string | null;
  surface_contaminee_ha?: number | null;
  /** Extensif imagos uniquement — remplace essaim_observe (booléen à 2 états) par les
   * 3 mêmes valeurs que le type_cible de l'Infestation intensive (migration 0033). */
  type_cible?: string | null;
  direction_de?: string | null;
  direction_vers?: string | null;
  etat?: string | null;
  essaim_en_vol?: boolean | null;
  essaim_pose?: boolean | null;
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
  stades_imago,
  essaim_observe,
  densites_larve,
  tache_larvaire,
  bande_larvaire,
  interdistance,
  deplacement,
  surface_contaminee_ha,
  type_cible,
  direction_de,
  direction_vers,
  etat,
  essaim_en_vol,
  essaim_pose
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

export function normalizeBoolean(value: unknown): boolean | null {
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
    essaim_en_vol: normalizeBoolean(row.essaim_en_vol),
    essaim_pose: normalizeBoolean(row.essaim_pose),
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
      mode_extensif,
      statut, statut_sync, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'brouillon', 'local', ?, ?)`,
    [
      input.id, input.typeProspection, input.campagneId, input.prospecteurId, input.stationId ?? null,
      input.biotope ?? null, input.region ?? null, input.district ?? null, input.commune ?? null,
      input.za ?? null, input.pa_code ?? null, input.dateProspection,
      input.latitude ?? null, input.longitude ?? null, input.altitude ?? null,
      input.surfaceStation ?? null, input.surfaceProspectee ?? null, input.surfaceInfestee ?? null,
      input.signalementSource ?? null, input.signalementDate ?? null, input.signalementDescription ?? null,
      input.modeExtensif ?? null,
      now, now
    ]
  );

  const created = await getProspection(input.id);
  if (!created) throw new Error('Échec de la création de la fiche brouillon locale');
  return created;
}

/**
 * Matérialise en local une fiche déjà VALIDÉE côté serveur, créée par
 * n'importe quel utilisateur — pas seulement celui de cet appareil
 * (#fiches-validees-multi-utilisateurs). Distinct de `createDraftProspection`
 * (toujours `brouillon`/`local`, réservé à une saisie qui démarre ici) :
 * celle-ci écrit `statut`/`statut_sync` tels que fournis par le serveur.
 *
 * `INSERT OR REPLACE` — idempotent, rejouable sans effet de bord si l'agent
 * rouvre plusieurs fois « Consulter une fiche validée » avant de choisir :
 * `PRAGMA foreign_keys = ON` (actif sur cette base, cf. openAndMigrate) fait
 * cascader la suppression des populations/infestations déjà écrites lors d'un
 * appel précédent — sans conséquence puisque l'appelant les réécrit aussitôt
 * après (mêmes données, fraîches).
 */
export interface ProspectionValideeInput {
  id: string;
  typeProspection: string;
  campagneId: string;
  prospecteurId: string;
  dateProspection: string;
  surfaceInfestee: number | null;
  nFiche: string | null;
  nReleve: string | null;
  nMessage: string | null;
  region: string | null;
  district: string | null;
  commune: string | null;
  observations: string | null;
  statut: string;
  createdAt: string;
  updatedAt: string;
}

export async function materialiserProspectionValidee(input: ProspectionValideeInput): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO prospection (
      id, type_prospection, campagne_id, prospecteur_id,
      date_prospection, surface_infestee, n_fiche, n_releve, n_message,
      region, district, commune, observations,
      statut, statut_sync, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?)`,
    [
      input.id, input.typeProspection, input.campagneId, input.prospecteurId,
      input.dateProspection, input.surfaceInfestee, input.nFiche, input.nReleve, input.nMessage,
      input.region, input.district, input.commune, input.observations,
      input.statut, input.createdAt, input.updatedAt,
    ]
  );
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

/**
 * Fixe `mode_extensif` sur un brouillon déjà créé — utilisé uniquement par le
 * parcours « Vérifier un signalement » : le brouillon existe déjà (créé par
 * `extensive-signalement.tsx` avec les champs de signalement) au moment où
 * l'utilisateur choisit Terrestre/Aérien sur `extensive-mode-chooser.tsx`. Pas
 * question de recréer un brouillon comme dans le cas normal (`createDraftProspection`,
 * où `modeExtensif` est fixé une fois pour toutes à la création).
 */
export async function setProspectionModeExtensif(id: string, modeExtensif: string): Promise<DraftProspection> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync('UPDATE prospection SET mode_extensif = ?, updated_at = ? WHERE id = ?', [modeExtensif, now, id]);

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
      surface_station = ?, surface_infestee = ?, n_message = ?, heure_observation_at = ?,
      societe = ?, immatricule_aeronef = ?, pilote = ?, mecanicien = ?,
      chef_de_base = ?, lieu_base_id = ?,
      updated_at = ?
     WHERE id = ?`,
    [
      input.latitude, input.longitude, input.stationLibre, input.typeStation,
      input.surfaceStation, input.surfaceInfestee, input.nMessage, input.heureObservationAt,
      input.societe ?? null, input.immatriculeAeronef ?? null, input.pilote ?? null, input.mecanicien ?? null,
      input.chefDeBase ?? null, input.lieuBaseId ?? null,
      now, id,
    ]
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
      degats_cultures = ?, verdissement_pourcent = ?, hauteur_herbe_cm = ?,
      derniere_pluie = ?, intensite_pluie = ?,
      pesticides_embarques = ?, pesticide_nom_commercial = ?,
      pesticide_quantite_disponible = ?, pesticide_quantite_recue = ?,
      futs_disponible = ?, futs_pleins = ?, futs_vides = ?, futs_recues = ?,
      signature_visa_nom = ?, signature_visa_horodatage = ?,
      signature_consultant_fao_nom = ?, signature_consultant_fao_horodatage = ?, signature_consultant_fao_image = ?,
      signature_pilote_nom = ?, signature_pilote_horodatage = ?, signature_pilote_image = ?,
      signature_chef_base_nom = ?, signature_chef_base_horodatage = ?, signature_chef_base_image = ?,
      observations = ?,
      updated_at = ?
     WHERE id = ?`,
    [
      input.degatsCultures, input.verdissementPourcent, input.hauteurHerbeCm, input.dernierePluie, input.intensitePluie,
      input.pesticidesEmbarques == null ? null : input.pesticidesEmbarques ? 1 : 0,
      input.pesticideNomCommercial ?? null,
      input.pesticideQuantiteDisponible ?? null,
      input.pesticideQuantiteRecue ?? null,
      input.futsDisponible ?? null,
      input.futsPleins ?? null,
      input.futsVides ?? null,
      input.futsRecues ?? null,
      input.signatureVisaNom ?? null,
      input.signatureVisaHorodatage ?? null,
      input.signatureConsultantFaoNom ?? null,
      input.signatureConsultantFaoHorodatage ?? null,
      input.signatureConsultantFaoImage ?? null,
      input.signaturePiloteNom ?? null,
      input.signaturePiloteHorodatage ?? null,
      input.signaturePiloteImage ?? null,
      input.signatureChefBaseNom ?? null,
      input.signatureChefBaseHorodatage ?? null,
      input.signatureChefBaseImage ?? null,
      input.observations ?? null,
      now, id,
    ]
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
      derniere_pluie = ?, intensite_pluie = ?, heure_observation_at = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.degatsCultures, input.ennemisNaturels, input.observations,
      input.dernierePluie ?? null, input.intensitePluie ?? null, input.heureObservationAt,
      now, id,
    ]
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

export interface OperationAerienneRow {
  type_operation: string;
  /** Pertinent seulement si type_operation === 'divers' — `null` sinon. */
  motif_divers: string | null;
  debut_heure: string;
  debut_temperature_c: number | null;
  debut_vent_ms: number | null;
  fin_heure: string;
  fin_temperature_c: number | null;
  fin_vent_ms: number | null;
  /** Calculée côté écran au moment de l'ajout/modification (jamais saisie) — cf.
   * `calculerDureeMinutes` dans prospection-extensive.ts. Rejouée à l'identique côté
   * backend à la synchronisation (jamais fait confiance à cette valeur non plus). */
  duree_minutes: number;
}

/**
 * Remplace toutes les opérations aériennes de la fiche — même politique que
 * `saveProspectionCaptures` (delete scope + réinsertion) plutôt qu'un CRUD par ligne :
 * l'écran Références tient déjà la liste complète en mémoire (comme ses autres
 * champs), un seul enregistrement au clic Continuer, cohérent avec le reste de ce
 * fichier. `numero` (ordre d'affichage/tri) est réassigné ici dans l'ordre du
 * tableau — le serveur fait de même à la synchronisation (jamais fait confiance au
 * client, cf. CreateProspection.execute côté backend).
 */
export async function saveOperationsAeriennes(prospectionId: string, operations: OperationAerienneRow[]): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM prospection_operation_aerienne WHERE prospection_id = ?', [prospectionId]);
  let numero = 1;
  for (const op of operations) {
    await db.runAsync(
      `INSERT INTO prospection_operation_aerienne (
        id, prospection_id, numero, type_operation, motif_divers, debut_heure,
        debut_temperature_c, debut_vent_ms, fin_heure, fin_temperature_c, fin_vent_ms, duree_minutes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        generateId(), prospectionId, numero, op.type_operation, op.motif_divers, op.debut_heure,
        op.debut_temperature_c, op.debut_vent_ms, op.fin_heure, op.fin_temperature_c, op.fin_vent_ms, op.duree_minutes,
      ]
    );
    numero += 1;
  }
}

export async function listOperationsAeriennes(prospectionId: string): Promise<OperationAerienneRow[]> {
  const db = await getDb();
  return db.getAllAsync<OperationAerienneRow>(
    `SELECT type_operation, motif_divers, debut_heure, debut_temperature_c, debut_vent_ms,
            fin_heure, fin_temperature_c, fin_vent_ms, duree_minutes
     FROM prospection_operation_aerienne WHERE prospection_id = ? ORDER BY numero`,
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
        stades_imago = ?,
        essaim_observe = ?,
        densites_larve = ?,
        tache_larvaire = ?,
        bande_larvaire = ?,
        interdistance = ?,
        deplacement = ?,
        surface_contaminee_ha = ?,
        type_cible = ?,
        direction_de = ?,
        direction_vers = ?,
        etat = ?,
        essaim_en_vol = ?,
        essaim_pose = ?
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
        row.stades_imago ?? null,
        normalizeBoolean(row.essaim_observe),
        row.densites_larve ?? null,
        normalizeBoolean(row.tache_larvaire),
        normalizeBoolean(row.bande_larvaire),
        row.interdistance ?? null,
        row.deplacement ?? null,
        row.surface_contaminee_ha ?? null,
        row.type_cible ?? null,
        row.direction_de ?? null,
        row.direction_vers ?? null,
        row.etat ?? null,
        normalizeBoolean(row.essaim_en_vol),
        normalizeBoolean(row.essaim_pose),
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
      stades_imago,
      essaim_observe,
      densites_larve,
      tache_larvaire,
      bande_larvaire,
      interdistance,
      deplacement,
      surface_contaminee_ha,
      type_cible,
      direction_de,
      direction_vers,
      etat,
      essaim_en_vol,
      essaim_pose
    )
    VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
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
      row.stades_imago ?? null,
      normalizeBoolean(row.essaim_observe),
      row.densites_larve ?? null,
      normalizeBoolean(row.tache_larvaire),
      normalizeBoolean(row.bande_larvaire),
      row.interdistance ?? null,
      row.deplacement ?? null,
      row.surface_contaminee_ha ?? null,
      row.type_cible ?? null,
      row.direction_de ?? null,
      row.direction_vers ?? null,
      row.etat ?? null,
      normalizeBoolean(row.essaim_en_vol),
      normalizeBoolean(row.essaim_pose),
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

/**
 * Retire une cible désélectionnée par l'utilisateur (infestation.tsx) : la section
 * Infestation est facultative et réversible — sans ça, une ligne déjà enregistrée
 * survivait en base après désélection et réapparaissait sélectionnée à la réouverture.
 */
export async function deleteProspectionInfestation(prospectionId: string, typeCible: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `DELETE FROM prospection_infestation WHERE prospection_id = ? AND type_cible = ?`,
    [prospectionId, typeCible]
  );
}

export async function completeProspection(id: string): Promise<DraftProspection> {
  const db = await getDb();
  const now = new Date().toISOString();

  // Signalisation : validée pour traitement dès l'enregistrement local, tout
  // en restant dans la file Offline-First. Intensive/Extensive conservent le
  // parcours administratif normal.
  await db.runAsync(
    `UPDATE prospection
       SET statut = CASE WHEN type_prospection = 'validation' THEN 'validee' ELSE 'en_attente' END,
           n_fiche = CASE WHEN type_prospection = 'validation' AND n_message IS NOT NULL THEN n_message ELSE n_fiche END,
           updated_at = ?
     WHERE id = ?`,
    [now, id]
  );

  const updated = await getProspection(id);
  if (!updated) throw new Error('Échec de la mise à jour de la fiche brouillon locale');
  return updated;
}

/**
 * #numero-fiche-extensive-egal-n-message : la Prospection Extensive n'a pas de
 * génération de n_fiche propre (contrairement à l'Intensif, dont
 * `reference.tsx` pose `n_fiche` dès sa propre soumission) — n_fiche restait
 * donc `null` toute la vie de la fiche, alors que le N° de message (saisi/
 * généré sur extensive-reference.tsx) était déjà affiché à l'agent pendant le
 * remplissage. Plutôt qu'inventer une numérotation séparée pour n_fiche, on
 * réutilise le N° de message existant comme numéro métier définitif — appelé
 * une seule fois, à l'enregistrement final (extensive-recap.tsx), et
 * exclusivement pour l'Extensif : ni l'Intensif (déjà correct), ni la
 * Signalisation/Vérification (numérotation hors périmètre de cette demande).
 */
export async function alignerNumeroFicheSurNumeroMessage(id: string): Promise<DraftProspection> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE prospection SET n_fiche = n_message, updated_at = ? WHERE id = ? AND n_message IS NOT NULL`,
    [now, id]
  );

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

/**
 * Sort la fiche de la file d'attente — ADR-012 décision 9, issue #177.
 *
 * Réservé aux refus du serveur (4xx) : réessayer à l'identique reproduirait le
 * même refus, et la laisser en file la ferait échouer indéfiniment sans que
 * personne ne le remarque.
 *
 * Le **motif** n'est pas stocké en colonne : il vit dans le journal (#171), sous
 * `prospection.sync.failed` avec l'identifiant de la fiche. Une colonne de plus
 * coûterait une migration pour une donnée que l'écran de journal sait déjà
 * montrer ; `statut_sync` est un `TEXT` libre, une valeur de plus n'en coûte
 * aucune.
 */
export async function markProspectionEchec(id: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(`UPDATE prospection SET statut_sync = 'echec', updated_at = ? WHERE id = ?`, [now, id]);
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

/**
 * Fiches de prospection éligibles au sélecteur de « Nouvelle fiche de traitement »
 * (traitement-picker.tsx) — exclut désormais celles dont la surface infestée est
 * déjà intégralement couverte par une fiche de traitement existante (Aérien ou
 * Terrestre, peu importe le type qui a traité en premier — les deux consomment
 * la même surface_infestee_ha). `surface_restante_ha` n'est renseignée en local
 * qu'une fois la fiche synchronisée au moins une fois (calculée côté serveur,
 * jamais côté mobile) : une prospection déjà épuisée peut donc rester visible
 * ici tant que l'appareil qui a traité en dernier n'a pas encore resynchronisé —
 * imprécision déjà acceptée pour listReprenableTraitements(), même logique.
 */
export async function listValidatedProspections(): Promise<DraftProspection[]> {
  const db = await getDb();
  return db.getAllAsync<DraftProspection>(
    `SELECT * FROM prospection p
     WHERE p.type_prospection IN ('extensive', 'validation') AND p.statut_sync = 'synced'
       AND NOT EXISTS (
         SELECT 1 FROM traitement t
         JOIN traitement_terrestre tt ON tt.traitement_id = t.id
         WHERE t.prospection_id = p.id
           AND tt.surface_restante_ha IS NOT NULL AND tt.surface_restante_ha <= 0
       )
       AND NOT EXISTS (
         SELECT 1 FROM traitement t
         JOIN traitement_aerien ta ON ta.traitement_id = t.id
         WHERE t.prospection_id = p.id
           AND ta.surface_restante_ha IS NOT NULL AND ta.surface_restante_ha <= 0
       )
     ORDER BY p.updated_at DESC`
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

