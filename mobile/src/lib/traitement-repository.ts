import { getDb } from './prospection-db';
import { generateId } from './id';
import { composerNumeroFiche } from './traitement-numero-fiche';

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
  surface_traitee_ha: number | null;
  // Chaînage de reprise (migration backend 0050) — mirroir de TraitementTerrestre,
  // généralisé à l'Aérien.
  reprise_traitement: boolean | null;
  traitement_origine_id: string | null;
  surface_cumulee_ha: number | null;
  surface_restante_ha: number | null;
  pesticide_recu_l: number | null;
  pesticide_stock_restant_l: number | null;
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
  reprise_traitement: boolean | null;
  traitement_origine_id: string | null;
  chef_equipe_id: string;
  agent_encadreur_id: string | null;
  consultant_international: string | null;
  surface_atomiseur_ha: number | null;
  surface_disque_rotatif_ha: number | null;
  surface_ulvamast_ha: number | null;
  surface_restante_abandonnee: boolean | null;
  motif_surface_restante_abandonnee: string | null;
  essence_litres: number | null;
  nb_piles: number | null;
  surface_traitee_ha: number | null;
  surface_cumulee_ha: number | null;
  surface_restante_ha: number | null;
  total_pesticide_l: number | null;
  pesticide_recu_l: number | null;
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
  dateTraitement?: string | null;
  pilote: string;
  mecanicien: string;
  chefDeBaseId: string;
  consultantInternational?: string | null;
  // Chaînage de reprise (migration backend 0050) — mirroir de
  // DraftTraitementTerrestreInput, généralisé à l'Aérien.
  repriseTraitement?: boolean;
  traitementOrigineId?: string | null;
}

export interface DraftTraitementTerrestreInput {
  id: string;
  prospectionId: string;
  dateTraitement?: string | null;
  chefEquipeId: string;
  agentEncadreurId?: string | null;
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
      id, prospection_id, type_traitement, date_traitement,
      statut, statut_sync, created_at, updated_at
    ) VALUES (?, ?, 'AERIEN', ?, 'brouillon', 'local', ?, ?)`,
    [input.id, input.prospectionId, input.dateTraitement ?? null, now, now]
  );

  await db.runAsync(
    `INSERT INTO traitement_aerien (
      traitement_id, pilote, mecanicien, chef_de_base_id, consultant_international,
      reprise_traitement, traitement_origine_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.id,
      input.pilote,
      input.mecanicien,
      input.chefDeBaseId,
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

export async function createDraftTraitementTerrestre(
  input: DraftTraitementTerrestreInput
): Promise<DraftTraitement> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO traitement (
      id, prospection_id, type_traitement, date_traitement,
      statut, statut_sync, created_at, updated_at
    ) VALUES (?, ?, 'TERRESTRE', ?, 'brouillon', 'local', ?, ?)`,
    [input.id, input.prospectionId, input.dateTraitement ?? null, now, now]
  );

  await db.runAsync(
    `INSERT INTO traitement_terrestre (
      traitement_id, chef_equipe_id, agent_encadreur_id, consultant_international,
      reprise_traitement, traitement_origine_id
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.id,
      input.chefEquipeId,
      input.agentEncadreurId ?? null,
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
  excludeId?: string | null
): Promise<string> {
  const db = await getDb();
  let suffixe: number | null = null;

  for (let tentative = 0; tentative < MAX_TENTATIVES_NUMERO_FICHE; tentative++) {
    const candidat = composerNumeroFiche(prenomChef, typeTraitement, dateTraitementIso, suffixe);
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
  pesticideRecuL?: number | null;
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
      pesticide_recu_l = ?,
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
      input.pesticideRecuL ?? null,
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
 * Pesticide reçu (l) — saisi sur l'écran « Traitement » (rotations.tsx), pas
 * « Équipe » (#equipe-slide-aerien) : fonction dédiée plutôt qu'un champ de plus
 * sur `AerienUpdateInput`, pour que chaque écran n'écrive que ce qui lui appartient.
 */
export async function updateTraitementAerienPesticideRecu(
  traitementId: string,
  pesticideRecuL: number | null | undefined
): Promise<DraftTraitement> {
  const db = await getDb();

  await db.runAsync(
    `UPDATE traitement_aerien SET pesticide_recu_l = ? WHERE traitement_id = ?`,
    [pesticideRecuL ?? null, traitementId]
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
  agentEncadreurId?: string | null;
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
  surface_ulvamast_ha?: number | null;
  surfaceRestanteAbandonnee?: boolean | null;
  motifSurfaceRestanteAbandonnee?: string | null;
  essence_litres?: number | null;
  nb_piles?: number | null;
  pesticideRecuL?: number | null;
}

export async function updateTraitementTerrestre(
  traitementId: string,
  input: TerrestreUpdateInput
): Promise<DraftTraitement> {
  const db = await getDb();

  await db.runAsync(
    `UPDATE traitement_terrestre SET
      chef_equipe_id = ?,
      agent_encadreur_id = ?,
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
      surface_ulvamast_ha = ?,
      surface_restante_abandonnee = ?,
      motif_surface_restante_abandonnee = ?,
      essence_litres = ?,
      nb_piles = ?,
      pesticide_recu_l = ?
     WHERE traitement_id = ?`,
    [
      input.chefEquipeId,
      input.agentEncadreurId ?? null,
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
      input.surface_ulvamast_ha ?? null,
      input.surfaceRestanteAbandonnee ?? null,
      input.motifSurfaceRestanteAbandonnee ?? null,
      input.essence_litres ?? null,
      input.nb_piles ?? null,
      input.pesticideRecuL ?? null,
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
  evaluation_risque: Record<string, string>;
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
      vols_clairs_essaims, repartition_population, surface_infestee_ha
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      traitementId,
      input.espece ?? null,
      input.petites_larves ?? null,
      input.grandes_larves ?? null,
      input.vols_clairs_essaims ?? null,
      input.repartition_population ?? null,
      input.surface_infestee_ha ?? null,
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
 * Fiches de traitement dont l'utilisateur connecté est responsable — chef
 * d'équipe (Terrestre) OU chef de base (Aérien).
 *
 * Bug #264 : la requête d'origine ne joignait que `traitement_terrestre`, donc
 * une fiche AÉRIEN (chef_de_base_id, pas de ligne dans `traitement_terrestre`)
 * n'apparaissait jamais dans "Mes fiches" après enregistrement, quel que soit
 * le chef de base connecté. Les deux `LEFT JOIN` couvrent les deux
 * spécialisations ; une fiche donnée n'a jamais de ligne que dans l'une des
 * deux tables (disjointes par `type_traitement`), donc chaque `traitement` ne
 * peut correspondre qu'à une seule branche du `OR` — pas de doublon possible.
 */
export async function listMesTraitements(
  utilisateurId: string
): Promise<DraftTraitementRow[]> {
  const db = await getDb();

  return db.getAllAsync<DraftTraitementRow>(
    `SELECT traitement.*
     FROM traitement
     LEFT JOIN traitement_terrestre ON traitement_terrestre.traitement_id = traitement.id
     LEFT JOIN traitement_aerien ON traitement_aerien.traitement_id = traitement.id
     WHERE traitement_terrestre.chef_equipe_id = ? OR traitement_aerien.chef_de_base_id = ?
     ORDER BY traitement.updated_at DESC`,
    [utilisateurId, utilisateurId]
  );
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
export async function listReprenableTraitements(): Promise<DraftTraitementRow[]> {
  const db = await getDb();

  return db.getAllAsync<DraftTraitementRow>(
    `SELECT traitement.*
     FROM traitement
     JOIN traitement_terrestre ON traitement_terrestre.traitement_id = traitement.id
     WHERE traitement.statut = 'validee'
       AND (traitement_terrestre.surface_restante_ha IS NULL OR traitement_terrestre.surface_restante_ha > 0)
       AND traitement.id NOT IN (
         SELECT traitement_origine_id FROM traitement_terrestre WHERE traitement_origine_id IS NOT NULL
       )
     UNION
     SELECT traitement.*
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
    if (draft) drafts.push(draft);
  }
  return drafts;
}

// ==========================================
// SUPPRESSION
// ==========================================

/** Suppression physique d'un brouillon local (les tables enfants sont en CASCADE). */
export async function deleteDraftTraitement(id: string): Promise<boolean> {
  const db = await getDb();

  const result = await db.runAsync('DELETE FROM traitement WHERE id = ?', [id]);

  return result.changes > 0;
}
