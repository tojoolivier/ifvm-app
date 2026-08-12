import { getDb } from './prospection-db';
import { generateId } from './id';

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
  kit_combinaison: boolean | null;
  kit_gants: boolean | null;
  kit_lunettes: boolean | null;
  kit_masques: boolean | null;
  kit_boite: boolean | null;
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
  nb_rotations: number | null;
  total_pesticide_l: number | null;
}

export interface Rotation {
  id: string;
  traitement_aerien_id: string;
  numero: number | null;
  numero_cuve: string | null;
  produit_id: string | null;
  quantite_l: number | null;
  temperature_debut_c: number | null;
  temperature_fin_c: number | null;
  vent_debut_ms: number | null;
  vent_fin_ms: number | null;
}

export interface RotationInput {
  numero_cuve?: string | null;
  produit_id?: string | null;
  quantite_l?: number | null;
  temperature_debut_c?: number | null;
  temperature_fin_c?: number | null;
  vent_debut_ms?: number | null;
  vent_fin_ms?: number | null;
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
}

export interface ProduitUtilise {
  id: string;
  traitement_terrestre_id: string;
  numero: number | null;
  produit_id: string | null;
  quantite_l: number | null;
}

export interface ProduitUtiliseInput {
  produit_id?: string | null;
  quantite_l?: number | null;
}

export interface TraitementSignature {
  id: string;
  traitement_id: string;
  role: string;
  signataire_nom: string | null;
  horodatage: string | null;
}

export interface DraftTraitementAerienInput {
  id: string;
  prospectionId: string;
  dateTraitement?: string | null;
  pilote: string;
  mecanicien: string;
  chefDeBaseId: string;
  consultantInternational?: string | null;
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
  dateTraitement: string | null;
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
}

function normalizeTraitementRow(row: DraftTraitementRow): DraftTraitementRow {
  return {
    ...row,
    kit_combinaison: normalizeBoolean(row.kit_combinaison),
    kit_gants: normalizeBoolean(row.kit_gants),
    kit_lunettes: normalizeBoolean(row.kit_lunettes),
    kit_masques: normalizeBoolean(row.kit_masques),
    kit_boite: normalizeBoolean(row.kit_boite),
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
      traitement_id, pilote, mecanicien, chef_de_base_id, consultant_international
    ) VALUES (?, ?, ?, ?, ?)`,
    [input.id, input.pilote, input.mecanicien, input.chefDeBaseId, input.consultantInternational ?? null]
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
      date_traitement = ?,
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
      input.dateTraitement,
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
      id, traitement_aerien_id, numero_cuve, produit_id, quantite_l,
      temperature_debut_c, temperature_fin_c, vent_debut_ms, vent_fin_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      traitementAerienId,
      input.numero_cuve ?? null,
      input.produit_id ?? null,
      input.quantite_l ?? null,
      input.temperature_debut_c ?? null,
      input.temperature_fin_c ?? null,
      input.vent_debut_ms ?? null,
      input.vent_fin_ms ?? null,
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
      numero_cuve = ?,
      produit_id = ?,
      quantite_l = ?,
      temperature_debut_c = ?,
      temperature_fin_c = ?,
      vent_debut_ms = ?,
      vent_fin_ms = ?
     WHERE id = ?`,
    [
      input.numero_cuve ?? null,
      input.produit_id ?? null,
      input.quantite_l ?? null,
      input.temperature_debut_c ?? null,
      input.temperature_fin_c ?? null,
      input.vent_debut_ms ?? null,
      input.vent_fin_ms ?? null,
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
      id, traitement_terrestre_id, produit_id, quantite_l
    ) VALUES (?, ?, ?, ?)`,
    [id, traitementTerrestreId, input.produit_id ?? null, input.quantite_l ?? null]
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

export async function listTraitementsByChefEquipe(
  chefEquipeId: string
): Promise<DraftTraitementRow[]> {
  const db = await getDb();

  return db.getAllAsync<DraftTraitementRow>(
    `SELECT traitement.*
     FROM traitement
     JOIN traitement_terrestre ON traitement_terrestre.traitement_id = traitement.id
     WHERE traitement_terrestre.chef_equipe_id = ?
     ORDER BY traitement.updated_at DESC`,
    [chefEquipeId]
  );
}

/**
 * Décision : pas de cache séparé du dernier pull `reprenable=true` pour ce lot.
 * On interroge directement la copie locale des fiches déjà validées et dont la
 * surface restante (mise en cache depuis la dernière réponse serveur) est
 * encore positive. Si un vrai cache de pull s'avère nécessaire plus tard
 * (ex: filtrage cross-session), il pourra remplacer cette requête passthrough
 * sans changer la signature.
 */
export async function listReprenableTraitements(): Promise<DraftTraitementRow[]> {
  const db = await getDb();

  return db.getAllAsync<DraftTraitementRow>(
    `SELECT traitement.*
     FROM traitement
     JOIN traitement_terrestre ON traitement_terrestre.traitement_id = traitement.id
     WHERE traitement.statut = 'validee'
       AND traitement_terrestre.surface_restante_ha > 0
     ORDER BY traitement.updated_at DESC`
  );
}

// ==========================================
// SYNCHRONISATION
// ==========================================

export async function markTraitementSynced(id: string): Promise<DraftTraitement> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE traitement
     SET statut_sync = 'synced',
         updated_at = ?
     WHERE id = ?`,
    [now, id]
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
      updated_at = ?
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
      id,
    ]
  );

  const updated = await getTraitement(id);
  if (!updated) {
    throw new Error('Échec de la mise à jour de la fiche brouillon locale');
  }
  return updated;
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

// ==========================================
// SUPPRESSION
// ==========================================

/** Suppression physique d'un brouillon local (les tables enfants sont en CASCADE). */
export async function deleteDraftTraitement(id: string): Promise<boolean> {
  const db = await getDb();

  const result = await db.runAsync('DELETE FROM traitement WHERE id = ?', [id]);

  return result.changes > 0;
}
