import { getDb } from './prospection-db';
import { generateId } from './id';

/**
 * Fiche de Vol (#fiche-vol) — journal d'une journée pour un aéronef donné,
 * indépendant de prospection/traitement. Cf. backend `app/domain/fiche_vol.py`
 * (ADR-011 §7) pour le modèle cible complet.
 *
 * Bâtie petit à petit, slide par slide : pour l'instant seuls A-Références
 * (localisation GPS -> base_latitude/longitude/altitude, date, société,
 * immatriculation) et B-Équipe (pilote, chef de base, consultant FAO,
 * mécanicien) existent côté mobile. Le brouillon reste purement local — la
 * fiche `POST /fiches-vol` exige aujourd'hui tous les champs (y compris Base
 * et Stand, pas encore saisis ici) en un seul appel ; la synchronisation
 * n'est donc pas encore câblée, elle viendra une fois les slides C-F
 * construits.
 */
export interface DraftFicheVol {
  id: string;
  numero_fiche: string | null;
  date_vol: string;
  compagnie: string | null;
  immatriculation: string | null;
  base_code: string | null;
  base_nom: string | null;
  base_latitude: number | null;
  base_longitude: number | null;
  base_altitude: number | null;
  stand_nom: string | null;
  stand_latitude: number | null;
  stand_longitude: number | null;
  stand_altitude: number | null;
  pilote: string | null;
  mecanicien: string | null;
  chef_de_base: string | null;
  consultant_international: string | null;
  observations: string | null;
  statut: string;
  statut_sync: string;
  created_at: string;
  updated_at: string;
}

/** Crée le brouillon local — `date_vol` fixée une fois pour toutes à la
 * création (aujourd'hui), jamais recalculée aux écrans suivants. */
export async function createDraftFicheVol(): Promise<DraftFicheVol> {
  const db = await getDb();
  const id = generateId();
  const now = new Date().toISOString();
  const dateVol = now.slice(0, 10);

  await db.runAsync(
    `INSERT INTO fiche_vol (id, date_vol, statut, statut_sync, created_at, updated_at)
     VALUES (?, ?, 'brouillon', 'local', ?, ?)`,
    [id, dateVol, now, now]
  );

  const created = await getFicheVol(id);
  if (!created) throw new Error('Échec de la création de la fiche de vol locale');
  return created;
}

export async function getFicheVol(id: string): Promise<DraftFicheVol | null> {
  const db = await getDb();
  return db.getFirstAsync<DraftFicheVol>('SELECT * FROM fiche_vol WHERE id = ?', [id]);
}

export interface FicheVolReferenceUpdateInput {
  compagnie: string | null;
  immatriculation: string | null;
  baseLatitude: number | null;
  baseLongitude: number | null;
  baseAltitude: number | null;
}

/** A-Références : société, immatriculation, et la position GPS captée à cet
 * écran — qui alimente directement base_latitude/longitude/altitude (on est
 * en principe à la base au moment de remplir la fiche ; le slide C,
 * Informations sur les Bases, réutilisera cette valeur plutôt que d'en
 * recapturer une). */
export async function updateFicheVolReference(
  id: string,
  input: FicheVolReferenceUpdateInput
): Promise<DraftFicheVol> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE fiche_vol SET
      compagnie = ?, immatriculation = ?,
      base_latitude = ?, base_longitude = ?, base_altitude = ?,
      updated_at = ?
     WHERE id = ?`,
    [
      input.compagnie, input.immatriculation,
      input.baseLatitude, input.baseLongitude, input.baseAltitude,
      now, id,
    ]
  );

  const updated = await getFicheVol(id);
  if (!updated) throw new Error('Échec de la mise à jour de la fiche de vol locale');
  return updated;
}

export interface FicheVolEquipeUpdateInput {
  pilote: string | null;
  chefDeBase: string | null;
  consultantInternational: string | null;
  mecanicien: string | null;
}

/** B-Équipe : pilote, chef de base et mécanicien sont tous en saisie libre
 * (externes à l'IFVM ou, pour chef de base, alignés sur cette même
 * convention depuis la migration backend 0064) ; Consultant FAO reste
 * facultatif, comme sur la prospection extensive aérienne. */
export async function updateFicheVolEquipe(
  id: string,
  input: FicheVolEquipeUpdateInput
): Promise<DraftFicheVol> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE fiche_vol SET
      pilote = ?, chef_de_base = ?, consultant_international = ?, mecanicien = ?,
      updated_at = ?
     WHERE id = ?`,
    [
      input.pilote, input.chefDeBase, input.consultantInternational, input.mecanicien,
      now, id,
    ]
  );

  const updated = await getFicheVol(id);
  if (!updated) throw new Error('Échec de la mise à jour de la fiche de vol locale');
  return updated;
}
