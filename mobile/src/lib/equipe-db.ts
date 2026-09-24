import { getReferentielDb } from './referentiel-db';

/**
 * Lectures locales du référentiel « équipe » (#641) : équipes, membres, sites, aéronefs — tout ce
 * que l'Accueil et l'écran Équipes montrent, disponible hors-ligne (ADR-007).
 */

export interface EquipeAvecChef {
  id: string;
  nom: string;
  type: 'terrestre' | 'aerien';
  nb_membres: number;
  chef_nom: string | null;
  chef_prenom: string | null;
}

export interface MembreEquipeLocal {
  user_id: string;
  fonction: string;
  nom: string | null;
  prenom: string | null;
}

export interface SiteEquipe {
  id: string;
  parent_site_id: string | null;
  numero: string;
  localite: string;
  /** Début de la position active ; `null` pour un site sans implantation en cours. */
  date_debut_position: string | null;
}

export interface AeronefEquipe {
  id: string;
  immatriculation: string;
  societe: string;
}

export function aujourdhuiIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Équipes actives, terrestres et aériennes, avec leur chef et leur effectif. */
export async function listEquipesAvecChef(): Promise<EquipeAvecChef[]> {
  const db = await getReferentielDb();
  return db.getAllAsync<EquipeAvecChef>(
    `SELECT e.id, e.nom, e.type,
       (SELECT count(*) FROM equipe_membre m WHERE m.equipe_id = e.id) AS nb_membres,
       c.nom AS chef_nom, c.prenom AS chef_prenom
     FROM equipe e
     LEFT JOIN equipe_membre c ON c.equipe_id = e.id AND c.fonction = 'chef'
     WHERE e.actif = 1
     ORDER BY e.nom`
  );
}

/** Membres d'une équipe, le chef en tête. */
export async function listMembresEquipe(equipeId: string): Promise<MembreEquipeLocal[]> {
  const db = await getReferentielDb();
  return db.getAllAsync<MembreEquipeLocal>(
    `SELECT user_id, fonction, nom, prenom FROM equipe_membre
     WHERE equipe_id = ?
     ORDER BY CASE WHEN fonction = 'chef' THEN 0 ELSE 1 END, nom`,
    [equipeId]
  );
}

/**
 * Sites d'une équipe aérienne : ceux qu'elle porte (principaux) puis les secondaires rattachés à
 * ses sites principaux — un secondaire hérite de l'équipe de son principal (`parent_site_id`).
 */
export async function listSitesEquipe(equipeId: string): Promise<SiteEquipe[]> {
  const db = await getReferentielDb();
  return db.getAllAsync<SiteEquipe>(
    `SELECT id, parent_site_id, numero, localite, date_debut_position FROM site_aerien
     WHERE actif = 1 AND (
       equipe_id = ?
       OR parent_site_id IN (SELECT id FROM site_aerien WHERE equipe_id = ?)
     )
     ORDER BY CASE WHEN parent_site_id IS NULL THEN 0 ELSE 1 END, numero`,
    [equipeId, equipeId]
  );
}

/** Aéronefs actuellement affectés à l'équipe : l'affectation couvre la date donnée. */
export async function listAeronefsEquipe(equipeId: string, aujourdhui: string): Promise<AeronefEquipe[]> {
  const db = await getReferentielDb();
  return db.getAllAsync<AeronefEquipe>(
    `SELECT a.id, a.immatriculation, a.societe
     FROM equipe_aeronef ea JOIN aeronef a ON a.id = ea.aeronef_id
     WHERE ea.equipe_id = ? AND a.actif = 1
       AND ea.date_debut <= ? AND (ea.date_fin IS NULL OR ea.date_fin >= ?)
     ORDER BY a.immatriculation`,
    [equipeId, aujourdhui, aujourdhui]
  );
}
