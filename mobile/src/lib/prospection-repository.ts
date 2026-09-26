import { getDb } from './prospection-db';
import { creerOutbox } from './outbox';
import { generateId } from './id';
import { logger } from './logger';
import { PreconditionError } from './errors';

const log = logger.child({ module: 'prospection-repository' });

/**
 * #revalidation-prospection — DOIT rester synchronisé avec
 * `DELAI_REVALIDATION_JOURS` (backend/app/domain/prospection.py) : c'est le
 * serveur qui a le dernier mot (calculé côté serveur dans
 * `disponible_pour_traitement`/`a_revalider`) ; cette copie ne sert qu'au
 * repli hors ligne local, approximatif par nature.
 */
const DELAI_REVALIDATION_JOURS = 5;

export type TypeProspection = 'intensive' | 'extensive' | 'validation';

export interface DraftProspectionInput {
  id: string;
  typeProspection: TypeProspection;
  campagneId: string;
  prospecteurId: string;
  /** Nom résolu de l'agent connecté (#fiches-disponibles-hors-ligne), fourni par
   * l'appelant (auth-store) — même convention "Prénom Nom" que le serveur
   * (`_resoudre_noms`). Facultatif : une fiche créée avant ce champ, ou sans
   * profil chargé, reste à `null` — `createDraftProspection` ne l'exige pas. */
  prospecteurNom?: string | null;
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
  /** Équipe de travail de l'agent à la création (#641) — reprise automatiquement par l'appelant. */
  equipeId?: string | null;
}

export interface DraftProspection {
  id: string;
  type_prospection: string;
  campagne_id: string;
  prospecteur_id: string;
  /** Nom résolu du prospecteur (#fiches-disponibles-hors-ligne) — cache local
   * du champ calculé côté serveur, pour afficher « Créé par … » même hors
   * ligne sur une fiche matérialisée depuis un autre agent. */
  prospecteur_nom: string | null;
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
  /** Équipe d'origine (#641) ; `null` pour un brouillon antérieur — « Non renseignée ». */
  equipe_id: string | null;
  societe: string | null;
  immatricule_aeronef: string | null;
  pilote: string | null;
  mecanicien: string | null;
  chef_de_base: string | null;
  /** Base principale du vol de prospection, texte libre (migration backend
   * 0063, défait la FK vers le référentiel `lieu_aerien` posée en 0047 —
   * l'agent la saisit directement, sans dépendre du référentiel Web) :
   * une prospection extensive aérienne « généralisée » n'est rattachée à aucune
   * base. */
  base: string | null;
  /** Numéro, date d'installation et coordonnées GPS de la base principale
   * (migration backend 0068) — capturées sur place, jamais recalculées. */
  base_numero: number | null;
  base_date_installation: string | null;
  base_latitude: number | null;
  base_longitude: number | null;
  /** Base secondaire (migration backend 0068) — texte libre, même schéma que
   * la base principale (date d'installation + coordonnées GPS propres). */
  base_secondaire: string | null;
  base_secondaire_date_installation: string | null;
  base_secondaire_latitude: number | null;
  base_secondaire_longitude: number | null;
  /** Signatures (mode aérien uniquement) — NULL en mode terrestre. */
  signature_visa_nom: string | null;
  signature_visa_horodatage: string | null;
  /** Tracé SVG du pavé de signature — Intensif uniquement (auto-signature du
   * prospecteur connecté, écran Observations). Extensif Aérien retire ce rôle
   * de son UI (cf. `ExtensiveObservationsUpdateInput`) sans jamais y toucher. */
  signature_visa_image: string | null;
  signature_consultant_fao_nom: string | null;
  signature_consultant_fao_horodatage: string | null;
  signature_consultant_fao_image: string | null;
  signature_pilote_nom: string | null;
  signature_pilote_horodatage: string | null;
  signature_pilote_image: string | null;
  signature_chef_base_nom: string | null;
  signature_chef_base_horodatage: string | null;
  signature_chef_base_image: string | null;
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
  /** #revalidation-prospection : date de validation connue localement — jamais
   * renseignée pour une fiche créée sur cet appareil avant sa toute première
   * synchronisation (cf. `synchroniserStatutServeur`), déjà connue en revanche
   * pour une fiche matérialisée depuis un autre agent (`materialiserProspectionValidee`). */
  validated_at: string | null;
  /** #revalidation-prospection : renseigné uniquement si cette fiche revalide
   * une fiche périmée (extensive/validation) — pointe vers la fiche d'origine. */
  revalide_de_id: string | null;
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
  base?: string | null;
  baseNumero?: number | null;
  baseDateInstallation?: string | null;
  baseLatitude?: number | null;
  baseLongitude?: number | null;
  baseSecondaire?: string | null;
  baseSecondaireDateInstallation?: string | null;
  baseSecondaireLatitude?: number | null;
  baseSecondaireLongitude?: number | null;
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
  signatureVisaNom?: string | null;
  signatureVisaHorodatage?: string | null;
  /** Auto-signature du prospecteur connecté, après « Remarques » — même
   * mécanique VALIDER/MODIFIER que observations.tsx (Intensif) : nom auto-
   * rempli (jamais ressaisi), tracé capturé au pavé de signature. Ces 2 modes
   * (terrestre et aérien) partagent ce champ, contrairement aux signatures
   * Consultant FAO/Chef de Base ci-dessous (mode aérien uniquement). */
  signatureVisaImage?: string | null;
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
  /** Auto-signature du prospecteur connecté (remplace le champ « Photo », jamais
   * câblé — cf. observations.tsx). Nom auto-rempli depuis l'utilisateur connecté
   * (jamais ressaisi), horodatage posé au VALIDER, tracé capturé au pavé de
   * signature (`SignaturePad`). Réutilise `signature_visa_nom`/`_horodatage`
   * (migration 0036, colonnes historiquement mortes pour l'Intensif) + le
   * nouveau `signature_visa_image` (migration 0082). */
  signatureVisaNom?: string | null;
  signatureVisaHorodatage?: string | null;
  signatureVisaImage?: string | null;
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
      id, type_prospection, campagne_id, prospecteur_id, prospecteur_nom, station_id,
      biotope, region, district, commune, za, pa_code,
      date_prospection, latitude, longitude, altitude,
      surface_station, surface_prospectee, surface_infestee,
      signalement_source, signalement_date, signalement_description,
      mode_extensif, equipe_id,
      statut, statut_sync, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'brouillon', 'local', ?, ?)`,
    [
      input.id, input.typeProspection, input.campagneId, input.prospecteurId, input.prospecteurNom ?? null,
      input.stationId ?? null,
      input.biotope ?? null, input.region ?? null, input.district ?? null, input.commune ?? null,
      input.za ?? null, input.pa_code ?? null, input.dateProspection,
      input.latitude ?? null, input.longitude ?? null, input.altitude ?? null,
      input.surfaceStation ?? null, input.surfaceProspectee ?? null, input.surfaceInfestee ?? null,
      input.signalementSource ?? null, input.signalementDate ?? null, input.signalementDescription ?? null,
      input.modeExtensif ?? null,
      input.equipeId ?? null,
      now, now
    ]
  );

  const created = await getProspection(input.id);
  if (!created) throw new Error('Échec de la création de la fiche brouillon locale');
  return created;
}

export interface SignalementUpdateInput {
  signalementSource: string | null;
  signalementDate: string | null;
  signalementDescription: string | null;
}

/**
 * #brouillon-des-le-debut : sauvegarde progressive des trois champs de
 * `extensive-signalement.tsx` (« Vérifier un signalement ») sur un brouillon
 * déjà créé (dès le montage de l'écran, avant même que l'agent ait tapé quoi
 * que ce soit) — jusqu'ici, ces champs ne survivaient qu'en état React local
 * de l'écran, écrits une seule fois via `createDraftProspection` au moment de
 * « Continuer », et perdus si l'agent quittait l'écran avant.
 */
export async function updateProspectionSignalement(
  id: string,
  input: SignalementUpdateInput
): Promise<DraftProspection> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE prospection SET
      signalement_source = ?, signalement_date = ?, signalement_description = ?,
      updated_at = ?
     WHERE id = ?`,
    [input.signalementSource, input.signalementDate, input.signalementDescription, now, id]
  );

  const updated = await getProspection(id);
  if (!updated) throw new Error('Échec de la mise à jour de la fiche brouillon locale');
  return updated;
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
  prospecteurNom: string | null;
  stationId: string | null;
  /** #localite-traitement-poste-acridien-autre-agent : nom du poste acridien
   * (référentiel station, Intensif) déjà résolu côté serveur — sans lui, une
   * fiche de traitement créée depuis cette prospection par un AUTRE agent
   * (donc jamais passée par `updateProspectionReference` sur CET appareil)
   * ne pouvait pas pré-remplir « Localité » (references.tsx ne lit que
   * `station_nom`/`station_libre`, jamais station_id directement). */
  stationNom: string | null;
  dateProspection: string;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  biotope: string[];
  surfaceStation: number | null;
  surfaceProspectee: number | null;
  surfaceInfestee: number | null;
  degatsCultures: string | null;
  dernierePluie: string | null;
  intensitePluie: string | null;
  vegetation: Record<string, unknown> | null;
  sol: Record<string, unknown> | null;
  ennemisNaturels: string | null;
  observations: string | null;
  nFiche: string | null;
  nMessage: string | null;
  statut: string;
  // #revalidation-prospection : nécessaire ici pour que le repli hors ligne
  // (listProspectionsARevaliderLocal) sache calculer la péremption sur une
  // fiche matérialisée depuis un AUTRE agent — sans ça elle resterait
  // invisible de la liste « à revalider » locale indéfiniment.
  validatedAt: string | null;
  revalideDeId: string | null;
  region: string | null;
  district: string | null;
  commune: string | null;
  za: string | null;
  paCode: string | null;
  degatsCulturesPourcent: number | null;
  verdissementPourcent: number | null;
  hauteurHerbeCm: number | null;
  heureObservationAt: string | null;
  stationLibre: string | null;
  typeStation: string[];
  verdureStrate: string | null;
  signalementSource: string | null;
  signalementDate: string | null;
  signalementDescription: string | null;
  conclusionValidation: string | null;
  avertissements: string[];
  modeExtensif: string | null;
  societe: string | null;
  immatriculeAeronef: string | null;
  pilote: string | null;
  mecanicien: string | null;
  chefDeBase: string | null;
  base: string | null;
  baseNumero: number | null;
  baseDateInstallation: string | null;
  baseLatitude: number | null;
  baseLongitude: number | null;
  baseSecondaire: string | null;
  baseSecondaireDateInstallation: string | null;
  baseSecondaireLatitude: number | null;
  baseSecondaireLongitude: number | null;
  signatureVisaNom: string | null;
  signatureVisaHorodatage: string | null;
  signatureVisaImage: string | null;
  signatureConsultantFaoNom: string | null;
  signatureConsultantFaoHorodatage: string | null;
  signatureConsultantFaoImage: string | null;
  signaturePiloteNom: string | null;
  signaturePiloteHorodatage: string | null;
  signaturePiloteImage: string | null;
  signatureChefBaseNom: string | null;
  signatureChefBaseHorodatage: string | null;
  signatureChefBaseImage: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Champs matérialisés : la totalité de ce qu'un écran du wizard extensif
 * peut lire ou pré-remplir (#revalidation-prospection en a besoin pour
 * cloner une fiche créée sur un AUTRE appareil, `demarrerRevalidation`
 * ci-dessous) — pas seulement le sous-ensemble affiché par le picker
 * `prospection-picker.tsx`, contrairement à l'implémentation d'origine
 * (#fiches-validees-multi-utilisateurs) qui ne couvrait que celui-ci.
 */
export async function materialiserProspectionValidee(input: ProspectionValideeInput): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO prospection (
      id, type_prospection, campagne_id, prospecteur_id, prospecteur_nom, station_id, station_nom,
      date_prospection, latitude, longitude, altitude, biotope,
      surface_station, surface_prospectee, surface_infestee,
      degats_cultures, derniere_pluie, intensite_pluie, vegetation, sol,
      ennemis_naturels, observations,
      n_fiche, n_message, statut, statut_sync,
      validated_at, revalide_de_id,
      region, district, commune, za, pa_code,
      degats_cultures_pourcent, verdissement_pourcent, hauteur_herbe_cm,
      heure_observation_at, station_libre, type_station, verdure_strate,
      signalement_source, signalement_date, signalement_description,
      conclusion_validation, avertissements, mode_extensif,
      societe, immatricule_aeronef, pilote, mecanicien, chef_de_base, base,
      base_numero, base_date_installation, base_latitude, base_longitude,
      base_secondaire, base_secondaire_date_installation, base_secondaire_latitude, base_secondaire_longitude,
      signature_visa_nom, signature_visa_horodatage, signature_visa_image,
      signature_consultant_fao_nom, signature_consultant_fao_horodatage, signature_consultant_fao_image,
      signature_pilote_nom, signature_pilote_horodatage, signature_pilote_image,
      signature_chef_base_nom, signature_chef_base_horodatage, signature_chef_base_image,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )`,
    [
      input.id,
      input.typeProspection,
      input.campagneId,
      input.prospecteurId,
      input.prospecteurNom,
      input.stationId,
      input.stationNom,
      input.dateProspection,
      input.latitude,
      input.longitude,
      input.altitude,
      JSON.stringify(input.biotope),
      input.surfaceStation,
      input.surfaceProspectee,
      input.surfaceInfestee,
      input.degatsCultures,
      input.dernierePluie,
      input.intensitePluie,
      input.vegetation != null ? JSON.stringify(input.vegetation) : null,
      input.sol != null ? JSON.stringify(input.sol) : null,
      input.ennemisNaturels,
      input.observations,
      input.nFiche,
      input.nMessage,
      input.statut,
      input.validatedAt,
      input.revalideDeId,
      input.region,
      input.district,
      input.commune,
      input.za,
      input.paCode,
      input.degatsCulturesPourcent,
      input.verdissementPourcent,
      input.hauteurHerbeCm,
      input.heureObservationAt,
      input.stationLibre,
      JSON.stringify(input.typeStation),
      input.verdureStrate,
      input.signalementSource,
      input.signalementDate,
      input.signalementDescription,
      input.conclusionValidation,
      JSON.stringify(input.avertissements),
      input.modeExtensif,
      input.societe,
      input.immatriculeAeronef,
      input.pilote,
      input.mecanicien,
      input.chefDeBase,
      input.base,
      input.baseNumero,
      input.baseDateInstallation,
      input.baseLatitude,
      input.baseLongitude,
      input.baseSecondaire,
      input.baseSecondaireDateInstallation,
      input.baseSecondaireLatitude,
      input.baseSecondaireLongitude,
      input.signatureVisaNom,
      input.signatureVisaHorodatage,
      input.signatureVisaImage,
      input.signatureConsultantFaoNom,
      input.signatureConsultantFaoHorodatage,
      input.signatureConsultantFaoImage,
      input.signaturePiloteNom,
      input.signaturePiloteHorodatage,
      input.signaturePiloteImage,
      input.signatureChefBaseNom,
      input.signatureChefBaseHorodatage,
      input.signatureChefBaseImage,
      input.createdAt,
      input.updatedAt,
    ]
  );
}

/** Colonnes réinitialisées par `demarrerRevalidation` — jamais copiées depuis
 * la source, toujours fixées à une valeur fraîche pour le nouveau brouillon. */
const COLONNES_REVALIDATION_NON_CLONEES = new Set([
  'id',
  'statut',
  'statut_sync',
  'created_at',
  'updated_at',
  'revalide_de_id',
  // `validated_at` ne doit JAMAIS venir de la source : c'est justement parce
  // que cette date est trop ancienne (délai de péremption, #revalidation-
  // prospection) qu'une revalidation a été démarrée. La copier ferait
  // apparaître le nouveau brouillon — pas encore synchronisé, donc pas encore
  // revalidé — dans « Prospections à revalider » avant même d'être terminé
  // (`listProspectionsARevaliderLocal` ne filtre que sur `validated_at`, le
  // statut du traitement associé et l'existence d'un enfant qui la revalide —
  // pas sur `statut`). Le serveur la reposera à une date fraîche à la
  // synchronisation (`CreateProspection.execute`, backend).
  'validated_at',
  // #revalidation-nouvelle-date : la fiche périmée documente une situation
  // qui vient d'être revérifiée AUJOURD'HUI, pas à la date de l'ancienne
  // prospection — copier `date_prospection` laisserait croire que la
  // situation observée date de l'ancienne fiche. Le numéro (`n_fiche`/
  // `n_message`), lui, reste volontairement identique (cf. clonage
  // générique ci-dessous) : seule la date change.
  'date_prospection',
]);

/**
 * #revalidation-numero-bis : la fiche qui revalide une autre garde le numéro de la fiche
 * revalidée, suffixé « -bis » — le suffixe signale d'un coup d'œil une fiche de revalidation.
 * Une revalidation de revalidation ajoute un nouveau « -bis » (« F-1-bis-bis »), ce qui reste
 * lisible et ne peut jamais entrer en collision avec le numéro de sa fiche d'origine.
 * Numéro absent (`null`) : laissé tel quel, jamais un « null-bis ».
 */
export const SUFFIXE_NUMERO_REVALIDATION = '-bis';

export function numeroDeRevalidation(numeroSource: string | null | undefined): string | null {
  return numeroSource ? `${numeroSource}${SUFFIXE_NUMERO_REVALIDATION}` : null;
}

/**
 * « Prospections à revalider » (#revalidation-prospection) : amorce une
 * NOUVELLE fiche (nouvel id, `statut='brouillon'`/`statut_sync='local'`,
 * `revalide_de_id` pointant vers la source), pré-remplie avec TOUTES les
 * données de la fiche périmée — y compris ses populations/infestations/
 * captures/opérations aériennes. Contrairement à une mise à jour en place
 * (que la prospection mobile ne sait pas faire, cf. plan
 * robust-finding-hartmanis.md), le wizard extensif (`extensive-reference.tsx`
 * et la suite) n'a besoin d'AUCUNE modification : il ne connaît que
 * `draftId` et lit/écrit déjà directement en SQLite — un brouillon
 * pré-rempli par clonage lui est indiscernable d'un brouillon neuf.
 *
 * La colonne source est lue générique­ment (`Object.keys`) plutôt
 * qu'énumérée à la main : reste correct si `DraftProspection` gagne des
 * champs plus tard, sans readapter cette fonction à chaque fois — au prix
 * de devoir tenir `COLONNES_REVALIDATION_NON_CLONEES` à jour si une colonne
 * doit un jour, elle aussi, repartir vierge.
 *
 * Précondition : la fiche source doit déjà être locale — appeler
 * `assurerProspectionDisponibleLocalement` avant si elle vient d'un autre
 * agent (ex. depuis l'écran « Prospections à revalider »).
 */
export async function demarrerRevalidation(sourceProspectionId: string): Promise<{ draftId: string }> {
  const source = await getProspection(sourceProspectionId);
  if (!source) {
    throw new Error(
      `#revalidation-prospection : fiche ${sourceProspectionId} introuvable localement — ` +
        'assurerProspectionDisponibleLocalement() doit être appelée avant demarrerRevalidation()'
    );
  }

  const db = await getDb();
  const draftId = generateId();
  const now = new Date().toISOString();
  // #revalidation-nouvelle-date : aujourd'hui, jamais la date de l'ancienne
  // fiche (cf. commentaire de `COLONNES_REVALIDATION_NON_CLONEES`) — même
  // format `YYYY-MM-DD` que la colonne partout ailleurs.
  const dateProspectionFraiche = now.slice(0, 10);

  const colonnesClonees = Object.keys(source).filter(
    (cle) => !COLONNES_REVALIDATION_NON_CLONEES.has(cle)
  );
  const valeursClonees = colonnesClonees.map((cle) => {
    const valeur = (source as unknown as Record<string, string | number | null>)[cle];
    // #revalidation-numero-bis : « -bis » sur le numéro de la fiche (et son n° de message).
    if (cle === 'n_fiche' || cle === 'n_message') return numeroDeRevalidation(valeur as string | null);
    return valeur;
  });

  await db.runAsync(
    `INSERT INTO prospection (
      id, statut, statut_sync, created_at, updated_at, revalide_de_id, date_prospection, ${colonnesClonees.join(', ')}
    ) VALUES (?, 'brouillon', 'local', ?, ?, ?, ?, ${colonnesClonees.map(() => '?').join(', ')})`,
    [draftId, now, now, sourceProspectionId, dateProspectionFraiche, ...valeursClonees]
  );

  for (const population of await listAllProspectionPopulations(sourceProspectionId)) {
    await saveProspectionPopulation(draftId, population);
  }
  for (const infestation of await listAllProspectionInfestations(sourceProspectionId)) {
    await saveProspectionInfestation(draftId, infestation.type_cible, infestation);
  }
  const capturesParGroupe = new Map<string, CaptureRow[]>();
  for (const capture of await listAllProspectionCaptures(sourceProspectionId)) {
    const cle = `${capture.espece}::${capture.categorie}`;
    capturesParGroupe.set(cle, [...(capturesParGroupe.get(cle) ?? []), capture]);
  }
  for (const [cle, rows] of capturesParGroupe) {
    const [espece, categorie] = cle.split('::');
    await saveProspectionCaptures(draftId, espece, categorie, rows);
  }
  const operations = await listOperationsAeriennes(sourceProspectionId);
  if (operations.length > 0) {
    await saveOperationsAeriennes(draftId, operations);
  }

  return { draftId };
}

export async function updateProspectionReference(id: string, input: ReferenceUpdateInput): Promise<DraftProspection> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE prospection SET
      latitude = ?, longitude = ?, altitude = ?,
      surface_station = ?, surface_prospectee = ?, surface_infestee = ?,
      biotope = ?, n_fiche = ?,
      region = ?, district = ?, commune = ?, za = ?, pa_code = ?, pa_nom = ?,
      station_id = ?, station_nom = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.latitude, input.longitude, input.altitude,
      input.surfaceStation, input.surfaceProspectee, input.surfaceInfestee,
      input.biotope ?? null, input.nFiche,
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

/**
 * #localite-traitement-poste-acridien-autre-agent : comble un `station_nom`
 * manquant sur une fiche DÉJÀ locale (matérialisée avant que le référentiel
 * `station_fixe` n'ait fini de se synchroniser sur cet appareil, ou avant
 * l'introduction de cette résolution) — `assurerProspectionDisponibleLocalement`
 * ne fait normalement rien sur une fiche déjà locale (jamais n'écrase un
 * brouillon potentiellement en cours d'usage ailleurs) ; ce correctif ciblé
 * ne touche QUE cette seule colonne, jamais le reste de la ligne.
 */
export async function updateProspectionStationNom(id: string, stationNom: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE prospection SET station_nom = ?, updated_at = ? WHERE id = ?', [
    stationNom,
    new Date().toISOString(),
    id,
  ]);
}

export interface GpsPositionUpdateInput {
  latitude: number;
  longitude: number;
  altitude: number | null;
  region?: string | null;
  district?: string | null;
  commune?: string | null;
}

/**
 * #brouillon-gps-persistance-immediate : persiste la position GPS dès sa
 * capture — appelée par reference.tsx (Intensif) et extensive-reference.tsx
 * (Extensif/Validation) juste après `getCurrentPosition()`/`reverseGeocode()`,
 * indépendamment du reste du formulaire de références (biotope, surfaces,
 * PA/station…), jamais encore renseigné à ce stade sur une fiche neuve.
 *
 * Avant cette fonction, la position ne survivait qu'en état React local de
 * l'écran : quitter la fiche avant d'atteindre « Continuer » la perdait, et
 * une réouverture ultérieure relançait une nouvelle capture GPS au lieu de
 * restaurer celle déjà obtenue — brouillon incomplet, mais bien réel dans
 * les deux cas (une fiche existe dès `startNewProspection`), donc la
 * position aurait dû, elle aussi, être conservée dès sa capture.
 */
export async function updateProspectionGpsPosition(
  id: string,
  input: GpsPositionUpdateInput
): Promise<DraftProspection> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE prospection SET
      latitude = ?, longitude = ?, altitude = ?,
      region = ?, district = ?, commune = ?,
      updated_at = ?
     WHERE id = ?`,
    [
      input.latitude, input.longitude, input.altitude,
      input.region ?? null, input.district ?? null, input.commune ?? null,
      now, id,
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
export async function setProspectionModeExtensif(
  id: string,
  modeExtensif: string,
  equipeId: string | null
): Promise<DraftProspection> {
  const db = await getDb();
  const now = new Date().toISOString();

  // L'équipe est reprise avec le mode : le brouillon a été créé avant que le mode soit connu, donc
  // avant que le type de l'équipe puisse être contrôlé (#641).
  await db.runAsync('UPDATE prospection SET mode_extensif = ?, equipe_id = ?, updated_at = ? WHERE id = ?', [
    modeExtensif,
    equipeId,
    now,
    id,
  ]);

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
      surface_station = ?, surface_infestee = ?, n_message = ?,
      n_fiche = COALESCE(?, n_fiche),
      heure_observation_at = ?,
      societe = ?, immatricule_aeronef = ?, pilote = ?, mecanicien = ?,
      chef_de_base = ?, base = ?,
      base_numero = ?, base_date_installation = ?, base_latitude = ?, base_longitude = ?,
      base_secondaire = ?, base_secondaire_date_installation = ?,
      base_secondaire_latitude = ?, base_secondaire_longitude = ?,
      updated_at = ?
     WHERE id = ?`,
    [
      input.latitude, input.longitude, input.stationLibre, input.typeStation,
      input.surfaceStation, input.surfaceInfestee, input.nMessage,
      // #numero-fiche-visible-des-le-brouillon : n_fiche reste aligné sur
      // n_message dès l'écran Référence (Extensif ET Signalisation, tous deux
      // servis par cet écran) — pas seulement à l'enregistrement final
      // (`alignerNumeroFicheSurNumeroMessage`, conservé comme filet de
      // sécurité pour une fiche qui n'aurait pas transité par ici, ex. clonée
      // via `demarrerRevalidation`). Sans ça, le numéro n'était visible nulle
      // part (dossier Brouillons compris) avant la toute dernière étape du
      // parcours — contrairement à l'Intensif, dont `n_fiche` est posé dès
      // reference.tsx. `COALESCE` : ne jamais effacer un n_fiche déjà posé si
      // n_message venait à être vidé par erreur.
      input.nMessage,
      input.heureObservationAt,
      input.societe ?? null, input.immatriculeAeronef ?? null, input.pilote ?? null, input.mecanicien ?? null,
      input.chefDeBase ?? null, input.base ?? null,
      input.baseNumero ?? null, input.baseDateInstallation ?? null, input.baseLatitude ?? null, input.baseLongitude ?? null,
      input.baseSecondaire ?? null, input.baseSecondaireDateInstallation ?? null,
      input.baseSecondaireLatitude ?? null, input.baseSecondaireLongitude ?? null,
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
      signature_visa_nom = ?, signature_visa_horodatage = ?, signature_visa_image = ?,
      signature_consultant_fao_nom = ?, signature_consultant_fao_horodatage = ?, signature_consultant_fao_image = ?,
      signature_pilote_nom = ?, signature_pilote_horodatage = ?, signature_pilote_image = ?,
      signature_chef_base_nom = ?, signature_chef_base_horodatage = ?, signature_chef_base_image = ?,
      observations = ?,
      updated_at = ?
     WHERE id = ?`,
    [
      input.degatsCultures, input.verdissementPourcent, input.hauteurHerbeCm, input.dernierePluie, input.intensitePluie,
      input.signatureVisaNom ?? null,
      input.signatureVisaHorodatage ?? null,
      input.signatureVisaImage ?? null,
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
      derniere_pluie = ?, intensite_pluie = ?, heure_observation_at = ?,
      signature_visa_nom = ?, signature_visa_horodatage = ?, signature_visa_image = ?,
      updated_at = ?
     WHERE id = ?`,
    [
      input.degatsCultures, input.ennemisNaturels, input.observations,
      input.dernierePluie ?? null, input.intensitePluie ?? null, input.heureObservationAt,
      input.signatureVisaNom ?? null, input.signatureVisaHorodatage ?? null, input.signatureVisaImage ?? null,
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

/**
 * #numeros-fiche-uniques : refuse de clôturer un brouillon si le numéro
 * métier qu'il s'apprête à figer (`n_fiche`, déjà posé pour l'Intensif dès
 * reference.tsx, et pour l'Extensif/la Signalisation dès extensive-reference.tsx
 * depuis #numero-fiche-visible-des-le-brouillon — `n_message` sert malgré
 * tout de repli pour une fiche de Signalisation qui n'aurait pas encore
 * transité par cet écran) est déjà porté par une AUTRE fiche locale. Deux
 * fiches ne doivent jamais partager le même numéro — c'est justement ce
 * numéro qui identifie la fiche pour un administrateur côté web.
 *
 * #revalidation-prospection : une fiche qui revalide une fiche périmée reprend son
 * numéro (`demarrerRevalidation`), désormais suffixé « -bis » (#revalidation-numero-bis) —
 * la fiche revalidée reste tolérée ici comme avant, ainsi qu'un autre brouillon de la même
 * revalidation (assistant abandonné puis relancé).
 */
async function assurerNumeroFicheUnique(id: string, current: DraftProspection): Promise<void> {
  const numero = current.type_prospection === 'validation' ? current.n_message : current.n_fiche;
  if (!numero) return;

  const db = await getDb();
  const memeNumero = await db.getAllAsync<{ id: string; statut: string; revalide_de_id: string | null }>(
    `SELECT id, statut, revalide_de_id FROM prospection WHERE id != ? AND n_fiche = ?`,
    [id, numero]
  );
  // #revalidation-numero-bis : ne comptent pas comme doublon (a) la fiche revalidée elle-même,
  // (b) un AUTRE brouillon de la même revalidation — un assistant de revalidation abandonné puis
  // relancé recrée un clone portant le même « -bis » (`demarrerRevalidation`).
  const doublons = memeNumero.filter(
    (autre) =>
      autre.id !== current.revalide_de_id &&
      !(current.revalide_de_id && autre.statut === 'brouillon' && autre.revalide_de_id === current.revalide_de_id)
  );
  if (doublons.length > 0) {
    throw new PreconditionError(
      `Le numéro « ${numero} » est déjà utilisé par une autre fiche — deux fiches ne peuvent pas partager le même numéro.`
    );
  }
}

export async function completeProspection(id: string): Promise<DraftProspection> {
  const db = await getDb();
  const now = new Date().toISOString();

  const current = await getProspection(id);
  if (!current) throw new Error('Échec de la mise à jour de la fiche brouillon locale');
  await assurerNumeroFicheUnique(id, current);

  // Signalisation NEUVE (jamais une revalidation) : validée pour traitement
  // dès l'enregistrement local, tout en restant dans la file Offline-First.
  // Intensive/Extensive conservent le parcours administratif normal.
  //
  // #revalidation-verification-standard : une revalidation (`revalide_de_id`
  // non nul), quel que soit son `type_prospection`, suit désormais la même
  // chaîne en_attente -> vérifiée -> validée qu'une fiche neuve — le serveur
  // (CreateProspection.execute) applique la même règle à la synchronisation,
  // ne force plus jamais `validee` pour une revalidation.
  await db.runAsync(
    `UPDATE prospection
       SET statut = CASE WHEN type_prospection = 'validation' AND revalide_de_id IS NULL THEN 'validee' ELSE 'en_attente' END,
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
 * Reporte localement le statut serveur AUTHENTIQUE (#liste-traitement-apres-
 * validation) d'une fiche déjà envoyée — jusqu'ici, `statut` restait figé à
 * 'en_attente' pour une fiche créée sur CET appareil, l'app locale n'ayant
 * aucun moyen d'apprendre qu'un administrateur l'avait depuis validée (ou
 * rejetée). Résultat : le repli hors ligne de « disponible pour traitement »
 * (listProspectionsDisponiblesPourTraitementLocal) se rabattait sur
 * `statut_sync = 'synced'` comme approximation de « validée » — une fiche
 * simplement envoyée, jamais encore revue par un administrateur, pouvait donc
 * apparaître comme disponible pour un traitement, alors que le chemin en
 * ligne l'aurait exclue (il filtre strictement sur statut=validee).
 *
 * `fiches` vient de `loadMesProspectionsServeur` (déjà appelée pour l'écran
 * "Mes prospections") : ne contient QUE les fiches de l'agent connecté, donc
 * déjà envoyées par construction — jamais un brouillon purement local.
 * `WHERE id = ?` est sans effet si la fiche n'existe pas encore ici (aucun
 * risque d'insérer une ligne partielle).
 */
export async function synchroniserStatutServeur(
  fiches: { id: string; statut: string; validated_at?: string | null }[]
): Promise<void> {
  const db = await getDb();

  // `updated_at` délibérément jamais touché ici : un simple recalage de
  // statut ne doit pas faire remonter la fiche en tête de « Mes prospections »
  // (listToutesProspectionsLocal, triée sur updated_at), qui reflète une saisie,
  // pas une consultation.
  for (const fiche of fiches) {
    await db.runAsync(
      `UPDATE prospection SET statut = ?, validated_at = ? WHERE id = ?`,
      [fiche.statut, fiche.validated_at ?? null, fiche.id]
    );
  }
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
export const markProspectionEchec = creerOutbox({
  table: 'prospection',
  base: () => getDb(),
  horodate: true,
}).marquerEnEchec;

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

/**
 * Toutes les fiches locales (tous statuts), triées par dernière modification —
 * alimente « Mes prospections »/« Mes fiches » (listes intégralement
 * navigables, y compris hors ligne) et le décompte hebdomadaire de l'écran
 * Accueil. Anciennement plafonnée à 20 (`listRecentProspections`) : une fiche
 * déjà validée, mais pas parmi les 20 les plus récemment modifiées, en
 * disparaissait purement et simplement hors ligne, alors qu'elle est
 * intégralement présente en local depuis sa création sur cet appareil
 * (#fiches-validees-liste-non-plafonnee).
 */
export async function listToutesProspectionsLocal(): Promise<DraftProspection[]> {
  const db = await getDb();
  return db.getAllAsync<DraftProspection>(`SELECT * FROM prospection ORDER BY updated_at DESC`);
}

/**
 * Fiches réellement en attente d'envoi (#synchronisation-automatique) —
 * `statut != 'brouillon'` exclut les brouillons encore en cours de saisie
 * (même filtre que `pendingSync` sur l'écran Prospection **et** que
 * `countUnsyncedProspections` ci-dessous) ; `statut_sync` exclut les fiches
 * déjà parties et celles en `'echec'` (refusées par le serveur, à corriger
 * manuellement plutôt qu'à renvoyer à l'identique).
 *
 * `statut != 'brouillon'` et non `statut = 'en_attente'` (#revalidation-
 * validation-jamais-synchronisee) : une fiche `type_prospection = 'validation'`
 * (signalisation, y compris sa revalidation) passe directement de
 * `'brouillon'` à `'validee'` dans `completeProspection`, sans jamais
 * transiter par `'en_attente'` (réservé à l'intensif/extensif). Filtrer sur
 * `'en_attente'` ici l'excluait donc silencieusement de la synchronisation
 * automatique (`use-fiches-auto-sync.ts`) et du bouton « Synchroniser tout »
 * (`prospection.tsx`/`sync.tsx`), alors même que `countUnsyncedProspections`
 * la comptait déjà dans le badge « non synchronisé » — la fiche restait donc
 * indéfiniment `statut_sync = 'local'`, jamais renvoyée tant que l'agent ne
 * tapait pas individuellement sur son bouton de synchro (`fiches.tsx`).
 */
export async function listUnsyncedProspections(): Promise<DraftProspection[]> {
  const db = await getDb();
  return db.getAllAsync<DraftProspection>(
    `SELECT * FROM prospection
     WHERE statut != 'brouillon' AND (statut_sync = 'local' OR statut_sync = 'conflict')
     ORDER BY updated_at DESC`
  );
}

/**
 * Repli hors-ligne de « Fiches de traitement → Consulter une fiche validée »
 * (prospection-picker.tsx) — normalement un appel serveur direct
 * (`loadFichesDisponiblesPourTraitement`, prospection-accueil.ts), parce que
 * la disponibilité globale (fiches des AUTRES agents comprises) est une
 * opération serveur. Hors connexion, cette exhaustivité est impossible ; on
 * propose donc une approximation plutôt qu'un écran bloqué :
 *   - `statut = 'validee'`, exactement le même filtre que le chemin en ligne
 *     (#liste-traitement-apres-validation) — pas `statut_sync = 'synced'`
 *     comme auparavant, qui laissait passer une fiche simplement ENVOYÉE
 *     mais pas encore VALIDÉE par un administrateur. Pour une fiche créée
 *     sur CET appareil, `statut` n'apprend cette validation qu'après coup,
 *     via `synchroniserStatutServeur` (rappelé par l'écran "Mes
 *     prospections") — pour une fiche d'un AUTRE agent, `statut` est déjà
 *     correct dès sa matérialisation (`materialiserProspectionValidee`,
 *     jamais appelée que pour une fiche déjà `statut=validee` côté serveur) ;
 *   - aucune fiche d'un AUTRE agent, jamais synchronisée sur CET appareil,
 *     n'est visible (même limite que `listReprenableTraitements`) ;
 *   - tous les types de prospection (pas seulement extensive/validation,
 *     contrairement à `listValidatedProspections` ci-dessous, taillée pour un
 *     autre écran) — le serveur ne restreint pas non plus par type.
 * `prospection-picker.tsx` affiche un bandeau « hors ligne » quand ce repli
 * est utilisé : imprécision assumée et signalée, jamais silencieuse (ADR-012
 * décision 1).
 *
 * `enfant.statut != 'brouillon'` (#revalidation-cree-apres-confirmation) :
 * une revalidation seulement AMORCÉE (`demarrerRevalidation`, brouillon
 * jamais confirmé/enregistré) ne doit pas faire disparaître l'origine —
 * seule une revalidation réellement enregistrée (statut `en_attente` ou
 * au-delà) la remplace. Sans cette condition, ouvrir puis abandonner
 * l'assistant de revalidation rendait la fiche d'origine introuvable ici,
 * alors qu'aucune revalidation n'avait été réellement créée.
 */
export async function listProspectionsDisponiblesPourTraitementLocal(): Promise<DraftProspection[]> {
  const db = await getDb();
  return db.getAllAsync<DraftProspection>(
    `SELECT * FROM prospection p
     WHERE p.statut = 'validee'
       AND NOT EXISTS (SELECT 1 FROM traitement t WHERE t.prospection_id = p.id)
       AND NOT (
         p.type_prospection IN ('extensive', 'validation')
         AND p.validated_at IS NOT NULL
         AND julianday('now') - julianday(p.validated_at) >= ${DELAI_REVALIDATION_JOURS}
       )
       AND NOT EXISTS (
         SELECT 1 FROM prospection enfant
         WHERE enfant.revalide_de_id = p.id AND enfant.statut != 'brouillon'
       )
     ORDER BY p.updated_at DESC`
  );
}

/**
 * #signalement-disponible-avant-synchro : fiches de SIGNALEMENT (type `validation`) créées sur cet
 * appareil, validées dès leur enregistrement local (`completeProspection`), mais pas encore
 * envoyées au serveur (`statut_sync = 'local'`). Le serveur ne les connaît pas encore : la liste
 * « Nouvelle fiche de traitement » (en ligne, entièrement serveur) ne les affichait donc qu'après
 * synchronisation, alors que leur statut « validée » est déjà acquis.
 *
 * Mêmes exclusions que `listProspectionsDisponiblesPourTraitementLocal` : pas de traitement déjà
 * rattaché. Pas de revalidation (`revalide_de_id` non nul suit la chaîne en_attente → validée, elle
 * n'est jamais validée d'emblée) ni de fiche refusée par le serveur (`echec`). Aucune condition de
 * péremption : une fiche non synchronisée est, par nature, récente.
 */
export async function listSignalementsValidesNonSynchronisesLocal(): Promise<DraftProspection[]> {
  const db = await getDb();
  return db.getAllAsync<DraftProspection>(
    `SELECT * FROM prospection p
     WHERE p.type_prospection = 'validation'
       AND p.statut = 'validee'
       AND p.statut_sync = 'local'
       AND p.revalide_de_id IS NULL
       AND NOT EXISTS (SELECT 1 FROM traitement t WHERE t.prospection_id = p.id)
     ORDER BY p.updated_at DESC`
  );
}

/**
 * #liste-nouveau-traitement-exclut-deja-traitees : identifiants des fiches de prospection
 * pour lesquelles une fiche de traitement existe DÉJÀ sur cet appareil — brouillon,
 * enregistrée hors ligne ou synchronisée, peu importe. Le serveur (`disponible_pour_traitement`)
 * n'exclut une fiche qu'une fois son traitement synchronisé : sans ce complément local, une fiche
 * qu'on vient de traiter restait proposée dans « Nouvelle fiche de traitement » jusqu'à la
 * synchronisation, et pouvait être confondue avec une fiche encore à traiter.
 */
export async function listProspectionIdsAvecTraitementLocal(): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ prospection_id: string }>(
    'SELECT DISTINCT prospection_id FROM traitement WHERE prospection_id IS NOT NULL'
  );
  return new Set(rows.map((r) => r.prospection_id));
}

/**
 * Repli hors-ligne de « Prospections à revalider »
 * (revalidation-liste.tsx) — même raisonnement que
 * `listProspectionsDisponiblesPourTraitementLocal` ci-dessus, dont c'est
 * exactement le complément : les fiches qu'il exclut pour péremption, à
 * condition qu'elles n'aient ni traitement ni revalidation déjà faite.
 * `validated_at` doit avoir été rapatrié localement (cf.
 * `materialiserProspectionValidee`) pour qu'une fiche d'un AUTRE agent
 * puisse jamais y apparaître.
 *
 * `enfant.statut != 'brouillon'` (#revalidation-cree-apres-confirmation) :
 * même condition que `listProspectionsDisponiblesPourTraitementLocal`
 * ci-dessus — l'origine ne doit disparaître de cette liste qu'une fois la
 * revalidation réellement CRÉÉE (confirmée/enregistrée), pas dès qu'un
 * brouillon est amorcé.
 */
export async function listProspectionsARevaliderLocal(): Promise<DraftProspection[]> {
  const db = await getDb();
  return db.getAllAsync<DraftProspection>(
    `SELECT * FROM prospection p
     WHERE p.type_prospection IN ('extensive', 'validation')
       AND p.validated_at IS NOT NULL
       AND julianday('now') - julianday(p.validated_at) >= ${DELAI_REVALIDATION_JOURS}
       AND NOT EXISTS (SELECT 1 FROM traitement t WHERE t.prospection_id = p.id)
       AND NOT EXISTS (
         SELECT 1 FROM prospection enfant
         WHERE enfant.revalide_de_id = p.id AND enfant.statut != 'brouillon'
       )
     ORDER BY p.validated_at ASC`
  );
}

/**
 * #revalidation-liste-exclut-origine-revalidee : identifiants des fiches déjà revalidées sur
 * cet appareil — un enfant chaîné via `revalide_de_id` réellement CRÉÉ (`statut != 'brouillon'`,
 * même condition que `listProspectionsARevaliderLocal` ci-dessus ; un simple assistant amorcé
 * puis abandonné ne compte pas). Le serveur (`a_revalider`) n'exclut l'origine qu'une fois cet
 * enfant SYNCHRONISÉ — sans ce complément local, l'origine restait visible dans « Revalidation »
 * (en ligne) entre la création de sa revalidation et le prochain passage réseau, remontrant côte
 * à côte l'ancienne fiche et sa remplaçante fraîchement créée.
 */
export async function listProspectionIdsDejaRevalideesLocalement(): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ revalide_de_id: string }>(
    `SELECT DISTINCT revalide_de_id FROM prospection WHERE revalide_de_id IS NOT NULL AND statut != 'brouillon'`
  );
  return new Set(rows.map((r) => r.revalide_de_id));
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

/**
 * #dossier-brouillons : exclut `statut = 'brouillon'` — une fiche encore en
 * cours de saisie n'est par construction jamais envoyée
 * (`listUnsyncedProspections` ne la sélectionne pas non plus), la compter
 * ici gonflait à tort le badge « non synchronisé » de l'accueil d'un nombre
 * de fiches qui ne partiront jamais tant qu'elles ne sont pas terminées.
 */
export async function countUnsyncedProspections(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM prospection WHERE statut_sync != 'synced' AND statut != 'brouillon'`
  );
  return row?.count ?? 0;
}

/**
 * Date de la dernière intervention (prospection ou traitement) rattachée à l'équipe sur CET
 * appareil — position courante déductible d'une équipe mobile terrestre (#607/#641), affichée sur
 * l'Accueil et l'écran Équipes. `null` sans intervention locale.
 */
export async function derniereInterventionEquipe(equipeId: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ derniere: string | null }>(
    `SELECT MAX(d) AS derniere FROM (
       SELECT date_prospection AS d FROM prospection WHERE equipe_id = ?
       UNION ALL
       SELECT date_traitement AS d FROM traitement WHERE equipe_id = ?
     )`,
    [equipeId, equipeId]
  );
  return row?.derniere ?? null;
}

/**
 * Autres prospections aériennes de l'équipe le même jour : candidates à « Ce vol couvre aussi »
 * (#644). Le filtre « n'a pas déjà un vol » est appliqué par l'appelant (autre base SQLite).
 */
export async function listProspectionsAeriennesDuJour(
  equipeId: string,
  date: string,
  sauf: string
): Promise<{ id: string; n_fiche: string | null }[]> {
  const db = await getDb();
  return db.getAllAsync<{ id: string; n_fiche: string | null }>(
    `SELECT id, n_fiche FROM prospection
     WHERE equipe_id = ? AND date_prospection = ? AND mode_extensif = 'aerien' AND id != ?
     ORDER BY created_at`,
    [equipeId, date, sauf]
  );
}

export async function deleteProspection(id: string): Promise<boolean> {
  const db = await getDb();
  const result = await db.runAsync(`DELETE FROM prospection WHERE id = ?`, [id]);
  return result.changes > 0;
}

