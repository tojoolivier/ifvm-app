import { getDb } from './prospection-db';
import { generateId } from './id';
import { composerNumeroFiche } from './traitement-numero-fiche';
import { PreconditionError } from './errors';
import { estAerienPretPourSynchro, estTerrestrePretPourSynchro } from './traitement-validation';

export type TypeTraitement = 'AERIEN' | 'TERRESTRE';

// ==========================================
// NORMALISATION
// ==========================================

/**
 * SQLite peut stocker les booléens sous forme 0/1.
 * Cette fonction garantit que l'application reçoit toujours
 * de vrais booléens (même idiome que prospection-repository.ts).
 */
function normalizeBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true';
  return null;
}

// ==========================================
// TRAITEMENT (COMMUN)
// ==========================================

export interface DraftTraitementRow {
  id: string;
  prospection_id: string;
  /** Équipe d'origine (#641) ; `null` pour un brouillon antérieur — « Non renseignée ». */
  equipe_id: string | null;
  numero_fiche: string | null;
  type_traitement: TypeTraitement;
  mode_traitement: string | null;
  date_traitement: string | null;
  date_validation: string | null;
  localite: string | null;
  region: string | null;
  district: string | null;
  commune: string | null;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  // Moyens humains et matériels (fiche CRT papier §4.1/4.2, migration backend
  // 0076, #moyens-humains-materiels) — communs à l'Aérien et au Terrestre.
  nb_agents_permanents: number | null;
  nb_agents_temporaires: number | null;
  nb_personnel_local: number | null;
  moyens_atomiseur_nb: number | null;
  moyens_essence_litres: number | null;
  moyens_disque_rotatif_nb: number | null;
  moyens_piles_nb: number | null;
  moyens_ulvamast_nb: number | null;
  /** Nombre de personnes équipées de chaque matériel — plus des booléens
   * depuis que tout l'équipage doit être équipé, pas seulement une personne. */
  kit_combinaison: number | null;
  kit_gants: number | null;
  kit_lunettes: number | null;
  kit_masques: number | null;
  kit_botte: number | null;
  zones_exposees: string | null;
  hauteur_strate_herbeuse_m: number | null;
  hauteur_strate_arboree_m: number | null;
  recouvrement_percent: number | null;
  empoisonnement: boolean | null;
  empoisonnement_type: string | null;
  empoisonnement_mode: string | null;
  empoisonnement_autre: string | null;
  evaluation_risque: string | null;
  comportement_anormal: boolean | null;
  comportement_non_cibles: string | null;
  mortalite: boolean | null;
  mortalite_familles: string | null;
  observations: string | null;
  statut: string;
  statut_sync: string;
  created_at: string;
  updated_at: string;
  /** Dernier `updated_at` serveur connu (distinct de `updated_at`, modifié par toute écriture locale). */
  server_updated_at: string | null;
}

export interface Cible {
  traitement_id: string;
  espece: string | null;
  petites_larves: number | null;
  grandes_larves: number | null;
  vols_clairs_essaims: number | null;
  repartition_population: string | null;
  surface_infestee_ha: number | null;
  // Détail par espèce (LMC/NSE), écran Synthèse (Aérien) — `null` pour une
  // espèce absente de la prospection liée. Les champs ci-dessus restent des
  // totaux agrégés, inchangés (écran Cibles, Terrestre).
  petites_larves_lmc: number | null;
  petites_larves_nse: number | null;
  grandes_larves_lmc: number | null;
  grandes_larves_nse: number | null;
  densite_diffuse_lmc: number | null;
  densite_groupee_lmc: number | null;
  densite_diffuse_nse: number | null;
  densite_groupee_nse: number | null;
  /** #zone-a-reprendre-surface-reste-a-traiter : uniquement pour une fiche
   * démarrée depuis « Zones à reprendre » — `null` pour un traitement neuf. */
  surface_restante_origine_ha: number | null;
}

export interface TraitementAerien {
  traitement_id: string;
  pilote: string;
  mecanicien: string;
  chef_de_base_id: string;
  consultant_international: string | null;
  immatricule_aeronef: string | null;
  base_principale: string | null;
  stand: string | null;
  stand_date_installation: string | null;
  base_secondaire: string | null;
  base_secondaire_date_installation: string | null;
  nb_rotations: number | null;
  total_pesticide_l: number | null;
  total_pesticide_kg: number | null;
  // Jamais renseignées ensemble (migration backend 0081) : produit de choc →
  // traitée ; produit de barrière (mode BARRIERE) → protégée.
  surface_traitee_ha: number | null;
  surface_protegee_ha: number | null;
  // Chaînage de reprise (migration backend 0050) — mirroir de TraitementTerrestre,
  // généralisé à l'Aérien.
  reprise_traitement: boolean | null;
  traitement_origine_id: string | null;
  surface_cumulee_ha: number | null;
  surface_restante_ha: number | null;
  // pesticide_recu_l/pesticide_stock_restant_l supprimés (#609) : le stock aérien
  // vit désormais dans `mouvement_pesticide` (#606).
  // Efficacité (migration backend 0058) : une seule évaluation par fiche
  // (après l'ensemble des rotations), pas par rotation individuelle — même
  // patron que TraitementTerrestre ci-dessous.
  taux_mortalite_pourcent: number | null;
  evaluation_efficacite_heures_apres: number | null;
  methode_evaluation_efficacite: string | null;
}

export interface Rotation {
  id: string;
  traitement_aerien_id: string;
  numero: number | null;
  // Dérivé côté serveur de `numero` (migration 0046) — jamais écrit par le mobile,
  // conservé en base locale sans être maintenu à jour (colonne devenue « abandonnée mais
  // conservée », même principe que d'autres champs de ce genre dans prospection-db.ts).
  numero_cuve: string | null;
  produit_id: string | null;
  quantite: number | null;
  unite: string | null;
  surface_ha: number | null;
  temperature_debut_c: number | null;
  temperature_fin_c: number | null;
  vent_debut_ms: number | null;
  vent_fin_ms: number | null;
  heure_debut: string | null;
  heure_fin: string | null;
  heure_ouverture_vanne: string | null;
  heure_fermeture_vanne: string | null;
  // #produit-nom-commercial : dérivé côté client, figé à la saisie.
  nom_commercial: string | null;
}

export interface RotationInput {
  produit_id?: string | null;
  quantite?: number | null;
  unite?: string | null;
  surface_ha?: number | null;
  temperature_debut_c?: number | null;
  temperature_fin_c?: number | null;
  vent_debut_ms?: number | null;
  vent_fin_ms?: number | null;
  heure_debut?: string | null;
  heure_fin?: string | null;
  heure_ouverture_vanne?: string | null;
  heure_fermeture_vanne?: string | null;
  nom_commercial?: string | null;
}

export interface TraitementTerrestre {
  traitement_id: string;
  heure_debut: string | null;
  heure_fin: string | null;
  vitesse_vent_ms: number | null;
  direction_vent: string | null;
  temperature_c: number | null;
  // Efficacité (migration backend 0058, fiche CRT papier section "Traitement",
  // juste après Condition de traitement) — même patron que TraitementAerien.
  taux_mortalite_pourcent: number | null;
  evaluation_efficacite_heures_apres: number | null;
  methode_evaluation_efficacite: string | null;
  reprise_traitement: boolean | null;
  traitement_origine_id: string | null;
  chef_equipe_id: string;
  agent_encadreur: string | null;
  consultant_international: string | null;
  surface_atomiseur_ha: number | null;
  surface_disque_rotatif_ha: number | null;
  surface_atomiseur_autoporte_ha: number | null;
  surface_restante_abandonnee: boolean | null;
  motif_surface_restante_abandonnee: string | null;
  essence_litres: number | null;
  nb_piles: number | null;
  // Jamais renseignées ensemble (migration backend 0083, généralise le
  // traitement Aérien de la migration 0081) : produit de choc → traitée ;
  // produit de barrière (mode BARRIERE) → protégée.
  surface_traitee_ha: number | null;
  surface_protegee_ha: number | null;
  surface_cumulee_ha: number | null;
  surface_restante_ha: number | null;
  // Unité pour toute la section « Produits utilisés » (migration backend 0077,
  // #produits-unite-l-kg) — 'L' ou 'kg', un seul choix pour toute la fiche
  // (contrairement à Rotation.unite côté Aérien, propre à chaque rotation).
  pesticide_unite: string;
  total_pesticide_l: number | null;
  pesticide_recu_l: number | null;
  // Stock avant approvisionnement (migration backend 0075, fiche CRT papier
  // section 5) — entre dans le calcul de pesticide_stock_restant_l (« Stock final »).
  stock_initial_l: number | null;
  pesticide_stock_restant_l: number | null;
}

export interface ProduitUtilise {
  id: string;
  traitement_terrestre_id: string;
  numero: number | null;
  produit_id: string | null;
  quantite_l: number | null;
  // #produit-nom-commercial : dérivé côté client, figé à la saisie.
  nom_commercial: string | null;
}

export interface ProduitUtiliseInput {
  produit_id?: string | null;
  quantite_l?: number | null;
  nom_commercial?: string | null;
}

export interface TraitementSignature {
  id: string;
  traitement_id: string;
  role: string;
  signataire_nom: string | null;
  // Tracé du pavé de signature (chemin SVG) — migration backend 0049. `null`
  // tant que le rôle n'a pas encore signé numériquement.
  signature_image: string | null;
  horodatage: string | null;
}

/** « Impact et risque → Évaluation du risque pour la population »
 * (#evaluation-risque-population, migration backend 0055) — liste dynamique
 * ("+"), commune à Aérien et Terrestre. */
export interface EvaluationRisquePopulation {
  id: string;
  traitement_id: string;
  ordre: number;
  habitat_proche: string | null;
  distance_km: number | null;
  sensibilisation: number | null;
}

export interface DraftTraitementAerienInput {
  id: string;
  prospectionId: string;
  /** Équipe de travail de l'agent à la création (#641) — reprise automatiquement par l'appelant. */
  equipeId?: string | null;
  dateTraitement?: string | null;
  pilote: string;
  mecanicien: string;
  chefDeBaseId: string;
  consultantInternational?: string | null;
  /** Aéronef de l'affectation active de l'équipe à la date de saisie (#642), modifiable ensuite. */
  immatriculeAeronef?: string | null;
  // Chaînage de reprise (migration backend 0050) — mirroir de
  // DraftTraitementTerrestreInput, généralisé à l'Aérien.
  repriseTraitement?: boolean;
  traitementOrigineId?: string | null;
}

export interface DraftTraitementTerrestreInput {
  id: string;
  prospectionId: string;
  /** Équipe de travail de l'agent à la création (#641) — reprise automatiquement par l'appelant. */
  equipeId?: string | null;
  dateTraitement?: string | null;
  chefEquipeId: string;
  agentEncadreur?: string | null;
  consultantInternational?: string | null;
  repriseTraitement?: boolean;
  traitementOrigineId?: string | null;
}

export interface ReferenceUpdateInput {
  localite: string | null;
  region: string | null;
  district: string | null;
  commune: string | null;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  /**
   * Bug corrigé (#persistance-fiches-traitement) : le sélecteur « Mode de
   * traitement » de l'écran Références restait modifiable sur une fiche déjà
   * créée (contrairement au type de traitement, verrouillé une fois
   * `traitementId` posé — cf. references.tsx), mais la valeur changée n'était
   * jamais transmise ici : `updateTraitementReference` ne l'écrivait pas en
   * SQLite local, donc la modification disparaissait silencieusement au
   * prochain "Continuer" (et n'atteignait jamais le payload de synchronisation,
   * qui relit cette même colonne locale).
   */
  modeTraitement: string | null;
  dateTraitement: string | null;
  /**
   * Ajout minimal Lot 2 : le formulaire "Références" (écran A) doit pouvoir saisir
   * la date de validation, mais Lot 1 ne l'exposait que côté conflit serveur
   * (markTraitementConflict). Ajouté ici plutôt que de contourner le repository.
   */
  dateValidation: string | null;
  numeroFiche: string | null;
}

export interface CibleInput {
  espece?: string | null;
  petites_larves?: number | null;
  grandes_larves?: number | null;
  vols_clairs_essaims?: number | null;
  repartition_population?: string | null;
  surface_infestee_ha?: number | null;
  petites_larves_lmc?: number | null;
  petites_larves_nse?: number | null;
  grandes_larves_lmc?: number | null;
  grandes_larves_nse?: number | null;
  densite_diffuse_lmc?: number | null;
  densite_groupee_lmc?: number | null;
  densite_diffuse_nse?: number | null;
  densite_groupee_nse?: number | null;
  surface_restante_origine_ha?: number | null;
}

export interface DraftTraitement extends DraftTraitementRow {
  cible?: Cible | null;
  aerien?: (TraitementAerien & { rotations: Rotation[] }) | null;
  terrestre?: (TraitementTerrestre & { produits: ProduitUtilise[] }) | null;
  signatures?: TraitementSignature[];
  evaluations_risque_population?: EvaluationRisquePopulation[];
}

function normalizeTraitementRow(row: DraftTraitementRow): DraftTraitementRow {
  return {
    ...row,
    empoisonnement: normalizeBoolean(row.empoisonnement),
    comportement_anormal: normalizeBoolean(row.comportement_anormal),
    mortalite: normalizeBoolean(row.mortalite),
  };
}

// ==========================================
// CRÉATION
// ==========================================

export async function createDraftTraitementAerien(
  input: DraftTraitementAerienInput
): Promise<DraftTraitement> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO traitement (
      id, prospection_id, equipe_id, type_traitement, date_traitement,
      statut, statut_sync, created_at, updated_at
    ) VALUES (?, ?, ?, 'AERIEN', ?, 'brouillon', 'local', ?, ?)`,
    [input.id, input.prospectionId, input.equipeId ?? null, input.dateTraitement ?? null, now, now]
  );

  await db.runAsync(
    `INSERT INTO traitement_aerien (
      traitement_id, pilote, mecanicien, chef_de_base_id, consultant_international,
      immatricule_aeronef, reprise_traitement, traitement_origine_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.id,
      input.pilote,
      input.mecanicien,
      input.chefDeBaseId,
      input.consultantInternational ?? null,
      input.immatriculeAeronef || null,
      input.repriseTraitement ?? null,
      input.traitementOrigineId ?? null,
    ]
  );

  const created = await getTraitement(input.id);
  if (!created) {
    throw new Error('Échec de la création de la fiche brouillon locale');
  }
  return created;
}

export async function createDraftTraitementTerrestre(
  input: DraftTraitementTerrestreInput
): Promise<DraftTraitement> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO traitement (
      id, prospection_id, equipe_id, type_traitement, date_traitement,
      statut, statut_sync, created_at, updated_at
    ) VALUES (?, ?, ?, 'TERRESTRE', ?, 'brouillon', 'local', ?, ?)`,
    [input.id, input.prospectionId, input.equipeId ?? null, input.dateTraitement ?? null, now, now]
  );

  await db.runAsync(
    `INSERT INTO traitement_terrestre (
      traitement_id, chef_equipe_id, agent_encadreur, consultant_international,
      reprise_traitement, traitement_origine_id
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.id,
      input.chefEquipeId,
      input.agentEncadreur ?? null,
      input.consultantInternational ?? null,
      input.repriseTraitement ?? null,
      input.traitementOrigineId ?? null,
    ]
  );

  const created = await getTraitement(input.id);
  if (!created) {
    throw new Error('Échec de la création de la fiche brouillon locale');
  }
  return created;
}

// ==========================================
// RÉFÉRENCE
// ==========================================

const MAX_TENTATIVES_NUMERO_FICHE = 50;

/**
 * Numéro de fiche lisible, unique en local, composé via `composerNumeroFiche`
 * (prénom du chef, type, date ISO) — même patron que `_persister_avec_numero_fiche_unique`
 * côté backend (backend/app/application/traitement_use_cases.py) : essaie d'abord le
 * numéro sans suffixe, puis incrémente (2, 3, …) tant qu'une autre fiche locale le porte
 * déjà. `excludeId` écarte la fiche elle-même (regénération d'un brouillon existant).
 */
export async function genererNumeroFicheDisponible(
  prenomChef: string,
  typeTraitement: TypeTraitement,
  dateTraitementIso: string,
  excludeId?: string | null,
  sigle?: string | null,
  estReprise?: boolean
): Promise<string> {
  const db = await getDb();
  let suffixe: number | null = null;

  for (let tentative = 0; tentative < MAX_TENTATIVES_NUMERO_FICHE; tentative++) {
    const candidat = composerNumeroFiche(prenomChef, typeTraitement, dateTraitementIso, suffixe, sigle, estReprise);
    const existant = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM traitement WHERE numero_fiche = ? AND (? IS NULL OR id != ?)',
      [candidat, excludeId ?? null, excludeId ?? null]
    );
    if (!existant) return candidat;
    suffixe = (suffixe ?? 1) + 1;
  }

  throw new Error(`Impossible de générer un numero_fiche unique à partir de '${prenomChef}'`);
}

export async function updateTraitementReference(
  id: string,
  input: ReferenceUpdateInput
): Promise<DraftTraitement> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE traitement SET
      localite = ?,
      region = ?,
      district = ?,
      commune = ?,
      latitude = ?,
      longitude = ?,
      altitude = ?,
      mode_traitement = ?,
      date_traitement = ?,
      date_validation = ?,
      numero_fiche = ?,
      updated_at = ?
     WHERE id = ?`,
    [
      input.localite,
      input.region,
      input.district,
      input.commune,
      input.latitude,
      input.longitude,
      input.altitude,
      input.modeTraitement,
      input.dateTraitement,
      input.dateValidation,
      input.numeroFiche,
      now,
      id,
    ]
  );

  const updated = await getTraitement(id);
  if (!updated) {
    throw new Error('Échec de la mise à jour de la fiche brouillon locale');
  }
  return updated;
}

/**
 * Ajouts minimaux Lot 2 : Lot 1 ne fournissait que la création des spécialisations
 * (createDraftTraitementAerien/Terrestre) et aucun moyen de les modifier ensuite,
 * ni d'écrire les colonnes communes "moyens & protection" / "impacts" de la table
 * `traitement`. Sans ces fonctions, les écrans C/D/E ne peuvent rien persister.
 * Suivent le même patron que updateTraitementReference (UPDATE + relecture).
 */

export interface AerienUpdateInput {
  pilote: string;
  mecanicien: string;
  chefDeBaseId: string;
  consultantInternational?: string | null;
  immatriculeAeronef?: string | null;
  // Base principale/stand/base secondaire : texte libre (migration backend
  // 0054, #traitement-aerien-base-texte-libre). Base principale obligatoire
  // (validée en amont par validateAerienEquipe), stand et base secondaire
  // facultatifs.
  basePrincipale?: string | null;
  stand?: string | null;
  // Date d'installation (migration backend 0056, #stand-base-secondaire-date-installation)
  // — facultative et indépendante du texte libre lui-même. Rien d'équivalent
  // pour basePrincipale : hors périmètre.
  standDateInstallation?: string | null;
  baseSecondaire?: string | null;
  baseSecondaireDateInstallation?: string | null;
  // surfaceTraiteeHa n'y figure plus (migration 0046) : dérivée des rotations,
  // même traitement que nb_rotations/total_pesticide_l — jamais mise à jour par cette
  // fonction, seulement par la synchronisation.
  // pesticideRecuL supprimé (#609) : hors de la table locale, cf. updateTraitementAerien ci-dessous.
  // Chaînage de reprise (migration backend 0050) — mirroir de TerrestreUpdateInput,
  // généralisé à l'Aérien.
  repriseTraitement?: boolean | null;
  traitementOrigineId?: string | null;
}

export async function updateTraitementAerien(
  traitementId: string,
  input: AerienUpdateInput
): Promise<DraftTraitement> {
  const db = await getDb();

  await db.runAsync(
    `UPDATE traitement_aerien SET
      pilote = ?,
      mecanicien = ?,
      chef_de_base_id = ?,
      consultant_international = ?,
      immatricule_aeronef = ?,
      base_principale = ?,
      stand = ?,
      stand_date_installation = ?,
      base_secondaire = ?,
      base_secondaire_date_installation = ?,
      reprise_traitement = ?,
      traitement_origine_id = ?
     WHERE traitement_id = ?`,
    [
      input.pilote,
      input.mecanicien,
      input.chefDeBaseId,
      input.consultantInternational ?? null,
      input.immatriculeAeronef ?? null,
      input.basePrincipale ?? null,
      input.stand ?? null,
      input.standDateInstallation ?? null,
      input.baseSecondaire ?? null,
      input.baseSecondaireDateInstallation ?? null,
      input.repriseTraitement ?? null,
      input.traitementOrigineId ?? null,
      traitementId,
    ]
  );

  const updated = await getTraitement(traitementId);
  if (!updated) {
    throw new Error('Échec de la mise à jour de la fiche brouillon locale');
  }
  return updated;
}

/**
 * Efficacité (migration backend 0058, fiche CRT papier section "Traitement") —
 * saisie sur l'écran « Moyens & protection » (moyens.tsx, #efficacite-moyens-
 * protection — déplacée depuis rotations.tsx), même raison : information
 * propre au traitement (résultat, pas équipe/rotations), fonction dédiée
 * plutôt qu'un champ de plus sur `AerienUpdateInput`.
 */
export interface AerienEfficaciteInput {
  tauxMortalitePourcent?: number | null;
  evaluationEfficaciteHeuresApres?: number | null;
  methodeEvaluationEfficacite?: string | null;
}

export async function updateTraitementAerienEfficacite(
  traitementId: string,
  input: AerienEfficaciteInput
): Promise<DraftTraitement> {
  const db = await getDb();

  await db.runAsync(
    `UPDATE traitement_aerien SET
      taux_mortalite_pourcent = ?,
      evaluation_efficacite_heures_apres = ?,
      methode_evaluation_efficacite = ?
     WHERE traitement_id = ?`,
    [
      input.tauxMortalitePourcent ?? null,
      input.evaluationEfficaciteHeuresApres ?? null,
      input.methodeEvaluationEfficacite ?? null,
      traitementId,
    ]
  );

  const updated = await getTraitement(traitementId);
  if (!updated) {
    throw new Error('Échec de la mise à jour de la fiche brouillon locale');
  }
  return updated;
}

// ==========================================
// SIGNATURES (#signatures-auto-equipe)
// ==========================================

/**
 * Enregistre (ou remplace) la signature numérique d'un rôle — appelée dès que
 * l'agent clique « VALIDER » sur l'écran Signatures, PAS seulement à
 * l'enregistrement final de la fiche : une signature déjà tracée doit survivre
 * à une fermeture/réouverture de la fiche, même avant tout envoi au serveur
 * (cf. #signatures-auto-equipe, exigence de persistance réelle).
 *
 * Remplace (delete puis insert) plutôt qu'un UPDATE conditionnel : la table
 * locale n'a pas de contrainte UNIQUE(traitement_id, role) (SQLite ne sait pas
 * l'ajouter après coup sans recréer la table) ; ce patron couvre nativement le
 * cas « MODIFIER » (re-signature) sans jamais laisser deux lignes pour un même
 * rôle.
 */
export async function saveSignatureLocal(
  traitementId: string,
  role: string,
  signataireNom: string,
  signatureImage: string
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    'DELETE FROM traitement_signature WHERE traitement_id = ? AND role = ?',
    [traitementId, role]
  );
  await db.runAsync(
    `INSERT INTO traitement_signature (id, traitement_id, role, signataire_nom, signature_image, horodatage)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [generateId(), traitementId, role, signataireNom, signatureImage, now]
  );
}

/** Retire la signature locale d'un rôle — utilisé quand le nom résolu depuis
 * « Équipe » a changé depuis la signature (cf. #signatures-auto-equipe §8) :
 * l'ancien tracé ne doit jamais être conservé pour une personne différente. */
export async function clearSignatureLocal(traitementId: string, role: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'DELETE FROM traitement_signature WHERE traitement_id = ? AND role = ?',
    [traitementId, role]
  );
}

/**
 * Écrit le résultat de `POST /traitements/{id}/valider` : la fiche est
 * verrouillée (`statut = 'validee'`) et chaque signature est réécrite avec ses
 * valeurs canoniques serveur (id/horodatage) — jamais de divergence entre ce
 * que l'agent voit après enregistrement et ce que le serveur a réellement
 * persisté.
 */
export async function markTraitementValidee(
  traitementId: string,
  dateValidation: string,
  signatures: TraitementSignature[]
): Promise<DraftTraitement> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE traitement SET statut = 'validee', date_validation = ?, updated_at = ? WHERE id = ?`,
    [dateValidation, now, traitementId]
  );

  await db.runAsync('DELETE FROM traitement_signature WHERE traitement_id = ?', [traitementId]);
  for (const s of signatures) {
    await db.runAsync(
      `INSERT INTO traitement_signature (id, traitement_id, role, signataire_nom, signature_image, horodatage)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [s.id, traitementId, s.role, s.signataire_nom, s.signature_image, s.horodatage]
    );
  }

  const updated = await getTraitement(traitementId);
  if (!updated) {
    throw new Error('Échec de la mise à jour de la fiche brouillon locale');
  }
  return updated;
}

export interface TerrestreUpdateInput {
  chefEquipeId: string;
  agentEncadreur?: string | null;
  consultantInternational?: string | null;
  heureDebut?: string | null;
  heureFin?: string | null;
  vitesse_vent_ms?: number | null;
  direction_vent?: string | null;
  temperature_c?: number | null;
  repriseTraitement?: boolean | null;
  traitementOrigineId?: string | null;
  surface_atomiseur_ha?: number | null;
  surface_disque_rotatif_ha?: number | null;
  surface_atomiseur_autoporte_ha?: number | null;
  surfaceRestanteAbandonnee?: boolean | null;
  motifSurfaceRestanteAbandonnee?: string | null;
  essence_litres?: number | null;
  nb_piles?: number | null;
  // Unité pour toute la section « Produits utilisés » (migration backend 0077,
  // #produits-unite-l-kg) — 'L' ou 'kg'.
  pesticideUnite?: string | null;
  pesticideRecuL?: number | null;
  stockInitialL?: number | null;
  // Efficacité (migration backend 0058, fiche CRT papier section "Traitement",
  // juste après Condition de traitement) — désormais saisie ici, sur l'écran
  // Équipe (#efficacite-equipe-terrestre), plutôt que sur « Moyens & protection »
  // (moyens.tsx, retour arrière sur #efficacite-moyens-protection) : seul
  // l'Aérien continue de la saisir sur Moyens & protection.
  taux_mortalite_pourcent?: number | null;
  evaluation_efficacite_heures_apres?: number | null;
  methode_evaluation_efficacite?: string | null;
  // #recap-terrestre-moyens-produits-vides : calculés en direct sur l'écran
  // « Équipe » (computeTotalPesticideTerrestre/computePesticideStockRestant,
  // traitement-validation.ts) mais jamais persistés jusqu'ici — le récapitulatif,
  // qui relit ces colonnes depuis la base plutôt que de recalculer, les trouvait
  // donc toujours vides malgré une saisie complète.
  totalPesticideL?: number | null;
  pesticideStockRestantL?: number | null;
}

export async function updateTraitementTerrestre(
  traitementId: string,
  input: TerrestreUpdateInput
): Promise<DraftTraitement> {
  const db = await getDb();

  await db.runAsync(
    `UPDATE traitement_terrestre SET
      chef_equipe_id = ?,
      agent_encadreur = ?,
      consultant_international = ?,
      heure_debut = ?,
      heure_fin = ?,
      vitesse_vent_ms = ?,
      direction_vent = ?,
      temperature_c = ?,
      reprise_traitement = ?,
      traitement_origine_id = ?,
      surface_atomiseur_ha = ?,
      surface_disque_rotatif_ha = ?,
      surface_atomiseur_autoporte_ha = ?,
      surface_restante_abandonnee = ?,
      motif_surface_restante_abandonnee = ?,
      essence_litres = ?,
      nb_piles = ?,
      pesticide_unite = ?,
      pesticide_recu_l = ?,
      stock_initial_l = ?,
      total_pesticide_l = ?,
      pesticide_stock_restant_l = ?,
      taux_mortalite_pourcent = ?,
      evaluation_efficacite_heures_apres = ?,
      methode_evaluation_efficacite = ?
     WHERE traitement_id = ?`,
    [
      input.chefEquipeId,
      input.agentEncadreur ?? null,
      input.consultantInternational ?? null,
      input.heureDebut ?? null,
      input.heureFin ?? null,
      input.vitesse_vent_ms ?? null,
      input.direction_vent ?? null,
      input.temperature_c ?? null,
      input.repriseTraitement ?? null,
      input.traitementOrigineId ?? null,
      input.surface_atomiseur_ha ?? null,
      input.surface_disque_rotatif_ha ?? null,
      input.surface_atomiseur_autoporte_ha ?? null,
      input.surfaceRestanteAbandonnee ?? null,
      input.motifSurfaceRestanteAbandonnee ?? null,
      input.essence_litres ?? null,
      input.nb_piles ?? null,
      input.pesticideUnite ?? 'L',
      input.pesticideRecuL ?? null,
      input.stockInitialL ?? null,
      input.totalPesticideL ?? null,
      input.pesticideStockRestantL ?? null,
      input.taux_mortalite_pourcent ?? null,
      input.evaluation_efficacite_heures_apres ?? null,
      input.methode_evaluation_efficacite ?? null,
      traitementId,
    ]
  );

  const updated = await getTraitement(traitementId);
  if (!updated) {
    throw new Error('Échec de la mise à jour de la fiche brouillon locale');
  }
  return updated;
}

export interface MoyensUpdateInput {
  kit_combinaison: number;
  kit_gants: number;
  kit_lunettes: number;
  kit_masques: number;
  kit_botte: number;
  zones_exposees: Record<string, boolean>;
  hauteur_strate_herbeuse_m: number | null;
  hauteur_strate_arboree_m: number | null;
  recouvrement_percent: number | null;
  // Moyens humains et matériels (fiche CRT papier §4.1/4.2, migration backend
  // 0076, #moyens-humains-materiels) — communs à l'Aérien et au Terrestre.
  nb_agents_permanents: number | null;
  nb_agents_temporaires: number | null;
  nb_personnel_local: number | null;
  moyens_atomiseur_nb: number | null;
  moyens_essence_litres: number | null;
  moyens_disque_rotatif_nb: number | null;
  moyens_piles_nb: number | null;
  moyens_ulvamast_nb: number | null;
}

export async function updateTraitementMoyens(
  traitementId: string,
  input: MoyensUpdateInput
): Promise<DraftTraitement> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE traitement SET
      kit_combinaison = ?,
      kit_gants = ?,
      kit_lunettes = ?,
      kit_masques = ?,
      kit_botte = ?,
      zones_exposees = ?,
      hauteur_strate_herbeuse_m = ?,
      hauteur_strate_arboree_m = ?,
      recouvrement_percent = ?,
      nb_agents_permanents = ?,
      nb_agents_temporaires = ?,
      nb_personnel_local = ?,
      moyens_atomiseur_nb = ?,
      moyens_essence_litres = ?,
      moyens_disque_rotatif_nb = ?,
      moyens_piles_nb = ?,
      moyens_ulvamast_nb = ?,
      updated_at = ?
     WHERE id = ?`,
    [
      input.kit_combinaison,
      input.kit_gants,
      input.kit_lunettes,
      input.kit_masques,
      input.kit_botte,
      JSON.stringify(input.zones_exposees),
      input.hauteur_strate_herbeuse_m,
      input.hauteur_strate_arboree_m,
      input.recouvrement_percent,
      input.nb_agents_permanents,
      input.nb_agents_temporaires,
      input.nb_personnel_local,
      input.moyens_atomiseur_nb,
      input.moyens_essence_litres,
      input.moyens_disque_rotatif_nb,
      input.moyens_piles_nb,
      input.moyens_ulvamast_nb,
      now,
      traitementId,
    ]
  );

  const updated = await getTraitement(traitementId);
  if (!updated) {
    throw new Error('Échec de la mise à jour de la fiche brouillon locale');
  }
  return updated;
}

/** « Impact et risque → Évaluation du risque pour la population »
 * (#evaluation-risque-population) — pas d'`ordre` explicite en entrée :
 * dérivé de la position dans le tableau, comme côté API (traitement-sync.ts). */
export interface EvaluationRisquePopulationInput {
  id: string;
  habitat_proche: string | null;
  distance_km: number | null;
  sensibilisation: boolean | null;
}

export interface ImpactsUpdateInput {
  empoisonnement: boolean;
  empoisonnement_type: string | null;
  empoisonnement_mode: string | null;
  empoisonnement_autre: string | null;
  // Réduit à Oui/Non par axe (retour arrière — était FAIBLE/MOYEN/ÉLEVÉ).
  evaluation_risque: Record<string, boolean>;
  comportement_anormal: boolean;
  comportement_non_cibles: string[];
  mortalite: boolean;
  mortalite_familles: string[];
  observations: string | null;
  evaluationsRisquePopulation: EvaluationRisquePopulationInput[];
}

export async function updateTraitementImpacts(
  traitementId: string,
  input: ImpactsUpdateInput
): Promise<DraftTraitement> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE traitement SET
      empoisonnement = ?,
      empoisonnement_type = ?,
      empoisonnement_mode = ?,
      empoisonnement_autre = ?,
      evaluation_risque = ?,
      comportement_anormal = ?,
      comportement_non_cibles = ?,
      mortalite = ?,
      mortalite_familles = ?,
      observations = ?,
      updated_at = ?
     WHERE id = ?`,
    [
      input.empoisonnement,
      input.empoisonnement_type,
      input.empoisonnement_mode,
      input.empoisonnement_autre,
      JSON.stringify(input.evaluation_risque),
      input.comportement_anormal,
      JSON.stringify(input.comportement_non_cibles),
      input.mortalite,
      JSON.stringify(input.mortalite_familles),
      input.observations,
      now,
      traitementId,
    ]
  );

  // Liste dynamique remplacée en bloc à chaque enregistrement de l'écran —
  // même sémantique que côté backend (update_sync) : DELETE puis INSERT,
  // jamais un diff ligne à ligne. `id` fourni par l'appelant (généré
  // localement, cf. EvaluationRisquePopulationDraft) : stable d'un
  // enregistrement à l'autre tant que la ligne n'est pas retirée côté écran.
  await db.runAsync(
    'DELETE FROM traitement_evaluation_risque_population WHERE traitement_id = ?',
    [traitementId]
  );
  for (let i = 0; i < input.evaluationsRisquePopulation.length; i++) {
    const e = input.evaluationsRisquePopulation[i];
    await db.runAsync(
      `INSERT INTO traitement_evaluation_risque_population
        (id, traitement_id, ordre, habitat_proche, distance_km, sensibilisation)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [e.id, traitementId, i, e.habitat_proche, e.distance_km, e.sensibilisation]
    );
  }

  const updated = await getTraitement(traitementId);
  if (!updated) {
    throw new Error('Échec de la mise à jour de la fiche brouillon locale');
  }
  return updated;
}

// ==========================================
// CIBLE (snapshot en lecture seule)
// ==========================================

export async function saveCible(traitementId: string, input: CibleInput): Promise<void> {
  const db = await getDb();

  await db.runAsync(
    `INSERT OR REPLACE INTO cible (
      traitement_id, espece, petites_larves, grandes_larves,
      vols_clairs_essaims, repartition_population, surface_infestee_ha,
      petites_larves_lmc, petites_larves_nse, grandes_larves_lmc, grandes_larves_nse,
      densite_diffuse_lmc, densite_groupee_lmc, densite_diffuse_nse, densite_groupee_nse,
      surface_restante_origine_ha
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      traitementId,
      input.espece ?? null,
      input.petites_larves ?? null,
      input.grandes_larves ?? null,
      input.vols_clairs_essaims ?? null,
      input.repartition_population ?? null,
      input.surface_infestee_ha ?? null,
      input.petites_larves_lmc ?? null,
      input.petites_larves_nse ?? null,
      input.grandes_larves_lmc ?? null,
      input.grandes_larves_nse ?? null,
      input.densite_diffuse_lmc ?? null,
      input.densite_groupee_lmc ?? null,
      input.densite_diffuse_nse ?? null,
      input.densite_groupee_nse ?? null,
      input.surface_restante_origine_ha ?? null,
    ]
  );
}

// ==========================================
// ROTATIONS (AÉRIEN)
// ==========================================

export async function addRotation(
  traitementAerienId: string,
  input: RotationInput
): Promise<Rotation> {
  const db = await getDb();
  const id = generateId();

  await db.runAsync(
    `INSERT INTO rotation (
      id, traitement_aerien_id, produit_id, quantite, unite, surface_ha,
      temperature_debut_c, temperature_fin_c, vent_debut_ms, vent_fin_ms,
      heure_debut, heure_fin, heure_ouverture_vanne, heure_fermeture_vanne, nom_commercial
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      traitementAerienId,
      input.produit_id ?? null,
      input.quantite ?? null,
      input.unite ?? null,
      input.surface_ha ?? null,
      input.temperature_debut_c ?? null,
      input.temperature_fin_c ?? null,
      input.vent_debut_ms ?? null,
      input.vent_fin_ms ?? null,
      input.heure_debut ?? null,
      input.heure_fin ?? null,
      input.heure_ouverture_vanne ?? null,
      input.heure_fermeture_vanne ?? null,
      input.nom_commercial ?? null,
    ]
  );

  const created = await db.getFirstAsync<Rotation>(
    'SELECT * FROM rotation WHERE id = ?',
    [id]
  );
  if (!created) {
    throw new Error('Échec de la création de la rotation locale');
  }
  return created;
}

export async function updateRotation(
  rotationId: string,
  input: RotationInput
): Promise<Rotation> {
  const db = await getDb();

  await db.runAsync(
    `UPDATE rotation SET
      produit_id = ?,
      quantite = ?,
      unite = ?,
      surface_ha = ?,
      temperature_debut_c = ?,
      temperature_fin_c = ?,
      vent_debut_ms = ?,
      vent_fin_ms = ?,
      heure_debut = ?,
      heure_fin = ?,
      heure_ouverture_vanne = ?,
      heure_fermeture_vanne = ?,
      nom_commercial = ?
     WHERE id = ?`,
    [
      input.produit_id ?? null,
      input.quantite ?? null,
      input.unite ?? null,
      input.surface_ha ?? null,
      input.temperature_debut_c ?? null,
      input.temperature_fin_c ?? null,
      input.vent_debut_ms ?? null,
      input.vent_fin_ms ?? null,
      input.heure_debut ?? null,
      input.heure_fin ?? null,
      input.heure_ouverture_vanne ?? null,
      input.heure_fermeture_vanne ?? null,
      input.nom_commercial ?? null,
      rotationId,
    ]
  );

  const updated = await db.getFirstAsync<Rotation>(
    'SELECT * FROM rotation WHERE id = ?',
    [rotationId]
  );
  if (!updated) {
    throw new Error('Échec de la mise à jour de la rotation locale');
  }
  return updated;
}

export async function deleteRotation(rotationId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM rotation WHERE id = ?', [rotationId]);
}

/**
 * Bug corrigé (#persistance-fiches-traitement) : rotations.tsx ré-ajoute
 * l'intégralité de `store.aerien.rotations` à chaque "Continuer" (le store ne
 * porte pas d'id stable côté DB pour distinguer une rotation déjà enregistrée
 * d'une nouvelle — `addRotation` génère toujours un `localId` frais). Sans
 * purge préalable, rouvrir puis ré-enregistrer une fiche (ou simplement
 * naviguer Équipe → Rotations → précédent → suivant) dupliquait toutes les
 * rotations déjà présentes à chaque passage. Remplacement en masse — même
 * principe que le remplacement d'evaluations_risque_population côté backend.
 */
export async function deleteAllRotationsForTraitementAerien(traitementAerienId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM rotation WHERE traitement_aerien_id = ?', [traitementAerienId]);
}

// ==========================================
// PRODUITS UTILISÉS (TERRESTRE)
// ==========================================

export async function addProduitUtilise(
  traitementTerrestreId: string,
  input: ProduitUtiliseInput
): Promise<ProduitUtilise> {
  const db = await getDb();
  const id = generateId();

  await db.runAsync(
    `INSERT INTO produit_utilise (
      id, traitement_terrestre_id, produit_id, quantite_l, nom_commercial
    ) VALUES (?, ?, ?, ?, ?)`,
    [
      id,
      traitementTerrestreId,
      input.produit_id ?? null,
      input.quantite_l ?? null,
      input.nom_commercial ?? null,
    ]
  );

  const created = await db.getFirstAsync<ProduitUtilise>(
    'SELECT * FROM produit_utilise WHERE id = ?',
    [id]
  );
  if (!created) {
    throw new Error('Échec de la création du produit utilisé local');
  }
  return created;
}

/** Pas de PUT côté serveur pour les produits utilisés : on supprime puis on recrée. */
export async function deleteProduitUtilise(produitUtiliseId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM produit_utilise WHERE id = ?', [produitUtiliseId]);
}

/**
 * Bug corrigé (#persistance-fiches-traitement) : même problème que
 * `deleteAllRotationsForTraitementAerien` côté Aérien, pour les produits
 * utilisés (Terrestre) ré-ajoutés en intégralité à chaque "Continuer" sur
 * l'écran Équipe.
 */
export async function deleteAllProduitsForTraitementTerrestre(traitementTerrestreId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM produit_utilise WHERE traitement_terrestre_id = ?', [traitementTerrestreId]);
}

// ==========================================
// LECTURE
// ==========================================

export async function getTraitement(id: string): Promise<DraftTraitement | null> {
  const db = await getDb();

  const row = await db.getFirstAsync<DraftTraitementRow>(
    'SELECT * FROM traitement WHERE id = ?',
    [id]
  );

  if (!row) {
    return null;
  }

  const traitement = normalizeTraitementRow(row);
  const cible = await db.getFirstAsync<Cible>(
    'SELECT * FROM cible WHERE traitement_id = ?',
    [id]
  );

  const result: DraftTraitement = { ...traitement, cible: cible ?? null };

  if (traitement.type_traitement === 'AERIEN') {
    const aerien = await db.getFirstAsync<TraitementAerien>(
      'SELECT * FROM traitement_aerien WHERE traitement_id = ?',
      [id]
    );
    if (aerien) {
      const rotations = await db.getAllAsync<Rotation>(
        'SELECT * FROM rotation WHERE traitement_aerien_id = ? ORDER BY numero',
        [id]
      );
      result.aerien = { ...aerien, rotations };
    }
  }

  if (traitement.type_traitement === 'TERRESTRE') {
    const terrestre = await db.getFirstAsync<TraitementTerrestre>(
      'SELECT * FROM traitement_terrestre WHERE traitement_id = ?',
      [id]
    );
    if (terrestre) {
      const produits = await db.getAllAsync<ProduitUtilise>(
        'SELECT * FROM produit_utilise WHERE traitement_terrestre_id = ? ORDER BY numero',
        [id]
      );
      result.terrestre = { ...terrestre, produits };
    }
  }

  // Signatures numériques (#signatures-auto-equipe) : persistées localement dès
  // la validation de chaque rôle (pas seulement au moment de l'enregistrement
  // final), pour survivre à une fermeture/réouverture de la fiche avant envoi.
  result.signatures = await db.getAllAsync<TraitementSignature>(
    'SELECT * FROM traitement_signature WHERE traitement_id = ?',
    [id]
  );

  // Impact et risque → Évaluation du risque pour la population
  // (#evaluation-risque-population) : commune à Aérien et Terrestre.
  result.evaluations_risque_population = await db.getAllAsync<EvaluationRisquePopulation>(
    'SELECT * FROM traitement_evaluation_risque_population WHERE traitement_id = ? ORDER BY ordre',
    [id]
  );

  return result;
}

export async function listDraftTraitements(): Promise<DraftTraitementRow[]> {
  const db = await getDb();

  return db.getAllAsync<DraftTraitementRow>(
    `SELECT * FROM traitement
     WHERE statut = 'brouillon'
     ORDER BY updated_at DESC`
  );
}

/**
 * Ligne `listReprenableTraitements` : la fiche d'origine (validée, surface
 * restante nulle ou positive), avec `surface_restante_ha` — surface encore
 * infestée non traitée par cette fiche, donc surface disponible à traiter
 * pour la reprise. `null` tant qu'aucune synchronisation n'a rapatrié cette
 * valeur depuis le serveur (cf. commentaire de la requête ci-dessous) — à
 * afficher comme « non communiquée », pas comme 0 ha.
 */
export interface ReprenableTraitementRow extends DraftTraitementRow {
  surface_restante_ha: number | null;
}

/**
 * Décision : pas de cache séparé du dernier pull `reprenable=true` pour ce lot.
 * On interroge directement la copie locale des fiches déjà validées, en
 * reproduisant les deux conditions serveur (`TraitementRepository.list_by_filters`,
 * backend/app/infrastructure/traitement_repository.py) au lieu du seul filtre
 * `surface_restante_ha > 0` :
 *   - une surface restante NULL est reprenable (jamais recalculée localement,
 *     donc toujours NULL tant qu'aucune synchronisation ne rapatrie
 *     `surface_restante_ha` depuis le serveur — cf. #91, l'exclure aurait rendu
 *     cet écran vide en permanence) ;
 *   - une fiche déjà utilisée comme origine d'une reprise ne doit plus être
 *     proposée (exclusion `traitement_origine_id`).
 * Si un vrai cache de pull s'avère nécessaire plus tard (ex: filtrage
 * cross-session, surface restante tenue à jour), il pourra remplacer cette
 * requête passthrough sans changer la signature.
 */
/**
 * Migration backend 0050 : le chaînage de reprise, jusqu'ici Terrestre uniquement,
 * est généralisé à l'Aérien — chaque type a sa propre chaîne (indépendante l'une de
 * l'autre), d'où deux blocs symétriques réunis par UNION plutôt qu'un JOIN unique.
 */
export async function listReprenableTraitements(): Promise<ReprenableTraitementRow[]> {
  const db = await getDb();

  return db.getAllAsync<ReprenableTraitementRow>(
    `SELECT traitement.*, traitement_terrestre.surface_restante_ha AS surface_restante_ha
     FROM traitement
     JOIN traitement_terrestre ON traitement_terrestre.traitement_id = traitement.id
     WHERE traitement.statut = 'validee'
       AND (traitement_terrestre.surface_restante_ha IS NULL OR traitement_terrestre.surface_restante_ha > 0)
       -- #zone-a-reprendre-surface-abandonnee : une surface restante explicitement
       -- abandonnée (l'agent a répondu "Oui") ne doit plus proposer de reprise —
       -- même règle que côté serveur (traitement_repository.py, list_by_filters).
       -- IS NOT 1 inclut NULL (jamais tranché) et 0, exclut seulement 1 (true).
       AND traitement_terrestre.surface_restante_abandonnee IS NOT 1
       AND traitement.id NOT IN (
         SELECT traitement_origine_id FROM traitement_terrestre WHERE traitement_origine_id IS NOT NULL
       )
     UNION
     SELECT traitement.*, traitement_aerien.surface_restante_ha AS surface_restante_ha
     FROM traitement
     JOIN traitement_aerien ON traitement_aerien.traitement_id = traitement.id
     WHERE traitement.statut = 'validee'
       AND (traitement_aerien.surface_restante_ha IS NULL OR traitement_aerien.surface_restante_ha > 0)
       AND traitement.id NOT IN (
         SELECT traitement_origine_id FROM traitement_aerien WHERE traitement_origine_id IS NOT NULL
       )
     ORDER BY updated_at DESC`
  );
}

// ==========================================
// SYNCHRONISATION
// ==========================================

export async function markTraitementSynced(
  id: string,
  serverUpdatedAt?: string | null
): Promise<DraftTraitement> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE traitement
     SET statut_sync = 'synced',
         updated_at = ?,
         server_updated_at = ?
     WHERE id = ?`,
    [now, serverUpdatedAt ?? now, id]
  );

  const updated = await getTraitement(id);
  if (!updated) {
    throw new Error('Échec de la mise à jour de la fiche brouillon locale');
  }
  return updated;
}

export interface ServerTraitement {
  numero_fiche?: string | null;
  mode_traitement?: string | null;
  date_traitement?: string | null;
  date_validation?: string | null;
  localite?: string | null;
  region?: string | null;
  district?: string | null;
  commune?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  altitude?: number | null;
  statut?: string | null;
  updated_at?: string | null;
  // Rotations/produits déjà enregistrés côté serveur au moment de la réponse
  // (#persistance-fiches-traitement) — utilisé pour les supprimer avant de
  // repousser la liste locale actuelle, plutôt que de l'ajouter par-dessus à
  // chaque synchronisation (cf. pushRotationsEtProduits, traitement-sync.ts).
  aerien?: { rotations?: { id: string }[] } | null;
  terrestre?: { produits?: { id: string }[] } | null;
  [key: string]: unknown;
}

/**
 * Persiste localement le `TraitementRead` renvoyé par le serveur en cas de 409
 * (conflit ou fiche verrouillée), sans écraser les autres colonnes locales déjà
 * saisies par l'utilisateur au-delà des champs de référence communs.
 */
export async function markTraitementConflict(
  id: string,
  serverTraitement: ServerTraitement
): Promise<DraftTraitement> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE traitement SET
      numero_fiche = ?,
      mode_traitement = ?,
      date_traitement = ?,
      date_validation = ?,
      localite = ?,
      region = ?,
      district = ?,
      commune = ?,
      latitude = ?,
      longitude = ?,
      altitude = ?,
      statut = ?,
      statut_sync = 'conflict',
      updated_at = ?,
      server_updated_at = ?
     WHERE id = ?`,
    [
      serverTraitement.numero_fiche ?? null,
      serverTraitement.mode_traitement ?? null,
      serverTraitement.date_traitement ?? null,
      serverTraitement.date_validation ?? null,
      serverTraitement.localite ?? null,
      serverTraitement.region ?? null,
      serverTraitement.district ?? null,
      serverTraitement.commune ?? null,
      serverTraitement.latitude ?? null,
      serverTraitement.longitude ?? null,
      serverTraitement.altitude ?? null,
      serverTraitement.statut ?? 'brouillon',
      now,
      serverTraitement.updated_at ?? now,
      id,
    ]
  );

  const updated = await getTraitement(id);
  if (!updated) {
    throw new Error('Échec de la mise à jour de la fiche brouillon locale');
  }
  return updated;
}

/**
 * Sort la fiche de la file d'attente — ADR-012 décision 9, issue #177.
 *
 * Pendant de {@link markProspectionEchec} côté traitement : même règle, même
 * motif journalisé plutôt que stocké en colonne.
 */
export async function markTraitementEchec(id: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE traitement SET statut_sync = 'echec', updated_at = ? WHERE id = ?`,
    [now, id]
  );
}

export async function countUnsyncedTraitements(): Promise<number> {
  const db = await getDb();

  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM traitement
     WHERE statut_sync != 'synced'`
  );

  return row?.count ?? 0;
}

/**
 * Fiches de traitement locales, tous statuts confondus — pendant de
 * `listToutesProspectionsLocal()` côté prospection, pour l'écran
 * Synchronisation (#erreur-sync-fiche-introuvable). Avant cette fonction, le
 * domaine « traitement » n'existait pas sur cet écran : ni affiché dans
 * « Fiches en attente », ni inclus dans le lot envoyé par le bouton
 * « Synchroniser » — une fiche de traitement complète restait donc
 * indéfiniment signalée « Aucune fiche à synchroniser », quel que soit le
 * nombre de tentatives.
 *
 * Volontairement sans filtre sur `statut_sync` (contrairement à
 * `listUnsyncedTraitements`) : l'écran a besoin de voir aussi les fiches déjà
 * synchronisées (compteur "Synchronisé") et celles en échec (badge ❌), pas
 * seulement celles qui repartiront au prochain envoi.
 *
 * Anciennement plafonnée à 20 (`listRecentTraitements`) : une fiche déjà
 * validée, mais pas parmi les 20 les plus récemment modifiées, disparaissait
 * purement et simplement de « Mes fiches »/du compteur de synchronisation
 * hors ligne, alors qu'elle est intégralement présente en local depuis sa
 * création sur cet appareil (#fiches-validees-liste-non-plafonnee).
 */
export async function listToutesTraitementsLocal(): Promise<DraftTraitementRow[]> {
  const db = await getDb();
  return db.getAllAsync<DraftTraitementRow>(`SELECT * FROM traitement ORDER BY updated_at DESC`);
}

/**
 * Fiches de traitement réellement en attente d'envoi (#synchronisation-
 * automatique). N'exclut PAS les fiches encore `statut = 'brouillon'` : une
 * fiche entièrement remplie dont l'enregistrement final (recap.tsx) a échoué
 * faute de réseau reste `'brouillon'` pour toujours — `/valider` (qui seul la
 * fait passer à `'validee'`) n'est appelé qu'après un push réussi. La
 * restreindre à `statut = 'validee'` la laisserait donc hors de portée de
 * toute synchronisation ultérieure, automatique ou manuelle.
 *
 * `getTraitement` reconstruit la fiche complète (aerien/terrestre/rotations/
 * produits/signatures) — nécessaire pour repousser autre chose qu'une ligne
 * partielle.
 *
 * #traitement-aerien-brouillon-incomplet-bloque-synchro : `statut_sync =
 * 'local'` est posé dès la création de la fiche (createDraftTraitementAerien/
 * Terrestre), bien avant que l'écran Équipe & Références n'ait renseigné les
 * champs obligatoires côté backend. Une fiche fraîchement créée (ou abandonnée
 * en cours de route) était donc déjà éligible à l'envoi, et échouait à coup
 * sûr avec les messages Pydantic par défaut (anglais, illisibles). On
 * n'inclut plus dans la file qu'une fiche déjà prête pour son type
 * (`estAerienPretPourSynchro`/`estTerrestrePretPourSynchro`) — elle y entrera
 * dès que l'agent aura complété cet écran, sans qu'aucune action de sa part
 * ne soit nécessaire ici.
 */
export async function listUnsyncedTraitements(): Promise<DraftTraitement[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM traitement
     WHERE statut_sync = 'local' OR statut_sync = 'conflict'
     ORDER BY updated_at DESC`
  );

  const drafts: DraftTraitement[] = [];
  for (const row of rows) {
    const draft = await getTraitement(row.id);
    if (draft && estTraitementPretPourSynchro(draft)) drafts.push(draft);
  }
  return drafts;
}

/** Vrai si la fiche a déjà tous les champs obligatoires (côté backend) de son
 * type — cf. le commentaire de `listUnsyncedTraitements` ci-dessus. Partagée
 * avec `syncOneTraitement` (traitement-sync.ts) pour que le bouton « Réessayer »
 * ciblé, qui contourne cette liste, applique la même règle. */
export function estTraitementPretPourSynchro(draft: DraftTraitement): boolean {
  if (draft.type_traitement === 'AERIEN') {
    return (
      !!draft.aerien &&
      estAerienPretPourSynchro({
        pilote: draft.aerien.pilote,
        mecanicien: draft.aerien.mecanicien,
        chefDeBaseId: draft.aerien.chef_de_base_id,
        immatriculeAeronef: draft.aerien.immatricule_aeronef,
        basePrincipale: draft.aerien.base_principale,
        rotations: draft.aerien.rotations.map((r) => ({ produitId: r.produit_id, quantite: r.quantite })),
      })
    );
  }
  if (draft.type_traitement === 'TERRESTRE') {
    return (
      !!draft.terrestre &&
      estTerrestrePretPourSynchro({
        chefEquipeId: draft.terrestre.chef_equipe_id,
        heureDebut: draft.terrestre.heure_debut,
        heureFin: draft.terrestre.heure_fin,
        vitesseVentMs: draft.terrestre.vitesse_vent_ms,
        temperatureC: draft.terrestre.temperature_c,
        produits: draft.terrestre.produits.map((p) => ({ produitId: p.produit_id, quantiteL: p.quantite_l })),
      })
    );
  }
  return false;
}

// ==========================================
// SUPPRESSION
// ==========================================

/**
 * Suppression physique d'un brouillon local (les tables enfants sont en
 * CASCADE). Garde-fou identique à `deleteDraftProspection`
 * (prospection-accueil.ts) : `statut` ne passe à `'validee'` qu'après un
 * `/valider` réussi (cf. commentaire de `listUnsyncedTraitements` ci-dessus),
 * donc une fiche encore `'brouillon'` n'a jamais été acceptée par le serveur
 * — la supprimer ne perd aucune donnée qu'il connaît déjà.
 */
export async function deleteDraftTraitement(draft: Pick<DraftTraitementRow, 'id' | 'statut'>): Promise<boolean> {
  if (draft.statut !== 'brouillon') {
    throw new PreconditionError('Seules les fiches en brouillon peuvent être supprimées.');
  }

  const db = await getDb();

  const result = await db.runAsync('DELETE FROM traitement WHERE id = ?', [draft.id]);

  return result.changes > 0;
}
