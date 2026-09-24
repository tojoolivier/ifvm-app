import { derniereInterventionEquipe } from './prospection-repository';
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

/**
 * Aéronefs actuellement affectés à l'équipe : l'affectation couvre la date donnée. L'intervalle est
 * semi-ouvert `[date_debut, date_fin)` comme côté serveur : le jour de `date_fin`, l'appareil est déjà libre.
 */
export async function listAeronefsEquipe(equipeId: string, aujourdhui: string): Promise<AeronefEquipe[]> {
  const db = await getReferentielDb();
  return db.getAllAsync<AeronefEquipe>(
    `SELECT a.id, a.immatriculation, a.societe
     FROM equipe_aeronef ea JOIN aeronef a ON a.id = ea.aeronef_id
     WHERE ea.equipe_id = ? AND a.actif = 1
       AND ea.date_debut <= ? AND (ea.date_fin IS NULL OR ea.date_fin > ?)
     ORDER BY a.immatriculation`,
    [equipeId, aujourdhui, aujourdhui]
  );
}

export interface AeronefParc {
  id: string;
  immatriculation: string;
  societe: string;
  volume_cuve_l: number;
  /** Équipe à laquelle l'appareil est affecté à la date donnée ; `null` s'il est libre. */
  equipe_id: string | null;
  equipe_nom: string | null;
}

/** Parc complet : chaque aéronef actif avec son équipe du jour (`null` = libre). */
export async function listParcAeronefs(aujourdhui: string): Promise<AeronefParc[]> {
  const db = await getReferentielDb();
  return db.getAllAsync<AeronefParc>(
    `SELECT a.id, a.immatriculation, a.societe, a.volume_cuve_l, e.id AS equipe_id, e.nom AS equipe_nom
     FROM aeronef a
     LEFT JOIN equipe_aeronef ea ON ea.aeronef_id = a.id
       AND ea.date_debut <= ? AND (ea.date_fin IS NULL OR ea.date_fin > ?)
     LEFT JOIN equipe e ON e.id = ea.equipe_id
     WHERE a.actif = 1
     ORDER BY a.immatriculation`,
    [aujourdhui, aujourdhui]
  );
}

export interface AffectationLocale {
  id: string;
  aeronef_id: string;
  immatriculation: string;
  societe: string;
  date_debut: string;
  /** `null` : affectation en cours. */
  date_fin: string | null;
}

/** Historique des affectations d'une équipe, la plus récente d'abord. */
export async function listAffectationsEquipe(equipeId: string): Promise<AffectationLocale[]> {
  const db = await getReferentielDb();
  return db.getAllAsync<AffectationLocale>(
    `SELECT ea.id, ea.aeronef_id, a.immatriculation, a.societe, ea.date_debut, ea.date_fin
     FROM equipe_aeronef ea JOIN aeronef a ON a.id = ea.aeronef_id
     WHERE ea.equipe_id = ?
     ORDER BY ea.date_debut DESC`,
    [equipeId]
  );
}

export interface ResumeEquipe {
  sitePrincipal: SiteEquipe | null;
  sitesSecondaires: SiteEquipe[];
  /** Aéronef en service ; le premier si plusieurs sont affectés. */
  aeronef: AeronefEquipe | null;
  /** Équipe terrestre : date de sa dernière intervention rattachée. */
  derniereIntervention: string | null;
}

/**
 * Ce que la carte « Équipe de travail » de l'Accueil montre : pour une équipe aérienne son site
 * principal actif, ses sites secondaires et son aéronef en service ; pour une équipe mobile
 * terrestre sa dernière intervention (position courante déduite, #607).
 */
export async function chargerResumeEquipe(
  equipe: { id: string; type: 'terrestre' | 'aerien' },
  aujourdhui: string
): Promise<ResumeEquipe> {
  if (equipe.type === 'terrestre') {
    return {
      sitePrincipal: null,
      sitesSecondaires: [],
      aeronef: null,
      derniereIntervention: await derniereInterventionEquipe(equipe.id),
    };
  }
  const [sites, aeronefs] = await Promise.all([
    listSitesEquipe(equipe.id),
    listAeronefsEquipe(equipe.id, aujourdhui),
  ]);
  return {
    sitePrincipal: sites.find((s) => s.parent_site_id === null) ?? null,
    sitesSecondaires: sites.filter((s) => s.parent_site_id !== null),
    aeronef: aeronefs[0] ?? null,
    derniereIntervention: null,
  };
}

export interface EquipeDeListe {
  equipe: EquipeAvecChef;
  resume: ResumeEquipe;
}

/** Toutes les équipes actives avec leur résumé — l'écran Équipes (#641). */
export async function chargerListeEquipes(aujourdhui: string): Promise<EquipeDeListe[]> {
  const equipes = await listEquipesAvecChef();
  return Promise.all(
    equipes.map(async (equipe) => ({ equipe, resume: await chargerResumeEquipe(equipe, aujourdhui) }))
  );
}

export interface AeronefLocal {
  id: string;
  immatriculation: string;
  societe: string;
}

/** Aéronefs actifs, pour choisir celui d'une nouvelle équipe aérienne. */
export async function listAeronefsActifs(): Promise<AeronefLocal[]> {
  const db = await getReferentielDb();
  return db.getAllAsync<AeronefLocal>(
    'SELECT id, immatriculation, societe FROM aeronef WHERE actif = 1 ORDER BY immatriculation'
  );
}

export interface UtilisateurAnnuaire {
  id: string;
  nom: string;
  prenom: string;
  role: string;
}

/**
 * Annuaire local : utilisateurs actifs dont le nom ou le prénom contient `recherche`, éventuellement
 * restreints à des rôles. Fonctionne hors-ligne, comme le reste du référentiel.
 */
export async function listAnnuaire(recherche: string, roles?: string[]): Promise<UtilisateurAnnuaire[]> {
  const db = await getReferentielDb();
  const motif = `%${recherche.trim()}%`;
  const filtreRoles = roles && roles.length > 0 ? ` AND role IN (${roles.map(() => '?').join(', ')})` : '';
  return db.getAllAsync<UtilisateurAnnuaire>(
    `SELECT id, nom, prenom, role FROM utilisateur_equipe
     WHERE actif = 1 AND (nom LIKE ? OR prenom LIKE ?)${filtreRoles}
     ORDER BY nom, prenom`,
    [motif, motif, ...(roles ?? [])]
  );
}

/** Utilisateurs déjà chefs d'une autre équipe — un utilisateur ne dirige qu'une équipe. */
export async function listChefsDAutresEquipes(equipeId: string): Promise<Set<string>> {
  const db = await getReferentielDb();
  const rows = await db.getAllAsync<{ user_id: string }>(
    "SELECT user_id FROM equipe_membre WHERE fonction = 'chef' AND equipe_id <> ?",
    [equipeId]
  );
  return new Set(rows.map((r) => r.user_id));
}
