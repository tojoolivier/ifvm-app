import { getReferentielDb } from './referentiel-db';
import { REFERENTIEL_TABLES } from './referentiel-schema.generated';

/**
 * Consultation en lecture seule du référentiel synchronisé (Figma « Parcours — Référentiels »).
 * Les écrans lisent le cache SQLite local : rien ici n'écrit, et rien ne dépend du réseau.
 */

// --- Formateurs ------------------------------------------------------------------------------

const deuxChiffres = (n: number) => String(n).padStart(2, '0');

function lire(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** « 22/09 » — la mise à jour d'une table, telle que la montrent les lignes de l'accueil. */
export function formaterJourMois(iso: string | null | undefined): string {
  const date = lire(iso);
  return date ? `${deuxChiffres(date.getDate())}/${deuxChiffres(date.getMonth() + 1)}` : '—';
}

/** « 20/09/2026 · 08:12 » — la dernière mise à jour d'une entrée. */
export function formaterDateHeure(iso: string | null | undefined): string {
  const date = lire(iso);
  if (!date) return '—';
  const jour = `${deuxChiffres(date.getDate())}/${deuxChiffres(date.getMonth() + 1)}/${date.getFullYear()}`;
  return `${jour} · ${deuxChiffres(date.getHours())}:${deuxChiffres(date.getMinutes())}`;
}

function memeJour(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** « Aujourd’hui à 08:12 », « Hier à 23:05 », sinon « 03/09 à 07:00 ». */
export function formaterDerniereSynchro(iso: string | null | undefined, maintenant: Date = new Date()): string {
  const date = lire(iso);
  if (!date) return 'Jamais synchronisé';
  const heure = `${deuxChiffres(date.getHours())}:${deuxChiffres(date.getMinutes())}`;
  if (memeJour(date, maintenant)) return `Aujourd’hui à ${heure}`;
  const hier = new Date(maintenant);
  hier.setDate(hier.getDate() - 1);
  if (memeJour(date, hier)) return `Hier à ${heure}`;
  return `${formaterJourMois(iso)} à ${heure}`;
}

const VINGT_QUATRE_HEURES_MS = 24 * 60 * 60 * 1000;

export type EtatFraicheur = 'a_jour' | 'a_synchroniser' | 'jamais';

/** Le badge « À JOUR » : une synchronisation de moins de 24 h. */
export function etatFraicheur(iso: string | null | undefined, maintenant: Date = new Date()): EtatFraicheur {
  const date = lire(iso);
  if (!date) return 'jamais';
  return maintenant.getTime() - date.getTime() < VINGT_QUATRE_HEURES_MS ? 'a_jour' : 'a_synchroniser';
}

/** « 1 248 » — espace des milliers, comme la maquette. */
export function formaterNombre(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function libelleEntrees(n: number): string {
  return `${formaterNombre(n)} ${n > 1 ? 'entrées' : 'entrée'}`;
}

/** « 8f2c…a91d » — un identifiant serveur se lit au début et à la fin. */
export function abregerIdentifiant(id: string): string {
  return id.length > 9 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id;
}

// --- Résumé de l'accueil ---------------------------------------------------------------------

export interface EtatTable {
  table: string;
  lignes: number;
  /** Dernière mise à jour côté serveur ; `null` pour `equipe_membre`, qui n'a pas de `updated_at`. */
  majLe: string | null;
}

export interface ResumeReferentiel {
  derniereSynchro: string | null;
  tables: EtatTable[];
  totalLignes: number;
}

const TABLES_SANS_DATE = new Set(['equipe_membre']);

export async function resumerReferentielLocal(): Promise<ResumeReferentiel> {
  const db = await getReferentielDb();
  const tables: EtatTable[] = [];
  for (const table of REFERENTIEL_TABLES) {
    const sql = TABLES_SANS_DATE.has(table)
      ? `SELECT count(*) AS n, NULL AS maj FROM ${table}`
      : `SELECT count(*) AS n, max(updated_at) AS maj FROM ${table}`;
    const ligne = await db.getFirstAsync<{ n: number; maj: string | null }>(sql);
    tables.push({ table, lignes: ligne?.n ?? 0, majLe: ligne?.maj ?? null });
  }
  const synchro = await db.getFirstAsync<{ derniere: string | null }>(
    'SELECT max(last_pull_at) AS derniere FROM referentiel_sync_meta'
  );
  return {
    derniereSynchro: synchro?.derniere ?? null,
    tables,
    totalLignes: tables.reduce((somme, t) => somme + t.lignes, 0),
  };
}

// --- Requêtes communes -----------------------------------------------------------------------

export type StatutFiltre = 'tous' | 'actifs' | 'inactifs';

interface Requete {
  conditions: string[];
  params: (string | number)[];
}

function nouvelleRequete(): Requete {
  return { conditions: [], params: [] };
}

function ajouterRecherche(requete: Requete, recherche: string, colonnes: string[]): void {
  const terme = recherche.trim();
  if (!terme) return;
  // `%` et `_` saisis par l'agent sont des caractères, pas des jokers.
  const litteral = terme.replace(/[\\%_]/g, '\\$&');
  requete.conditions.push(`(${colonnes.map((c) => `${c} LIKE ? ESCAPE '\\'`).join(' OR ')})`);
  for (let i = 0; i < colonnes.length; i++) requete.params.push(`%${litteral}%`);
}

function ajouterStatut(requete: Requete, colonne: string, statut: StatutFiltre, inclureInactifs: boolean): void {
  if (!inclureInactifs || statut === 'actifs') requete.conditions.push(`${colonne} = 1`);
  else if (statut === 'inactifs') requete.conditions.push(`${colonne} = 0`);
}

function clauseWhere(requete: Requete): string {
  return requete.conditions.length ? ` WHERE ${requete.conditions.join(' AND ')}` : '';
}

export interface CompteStatuts {
  tous: number;
  actifs: number;
  inactifs: number;
  /** Dernière mise à jour de la table entière, filtres ou pas. */
  majLe: string | null;
}

async function compterParStatut(table: string): Promise<CompteStatuts> {
  const db = await getReferentielDb();
  const lignes = await db.getAllAsync<{ actif: number; n: number; maj: string | null }>(
    `SELECT actif, count(*) AS n, max(updated_at) AS maj FROM ${table} GROUP BY actif`
  );
  const actifs = lignes.find((l) => l.actif === 1)?.n ?? 0;
  const inactifs = lignes.find((l) => l.actif === 0)?.n ?? 0;
  const majLe = lignes.reduce<string | null>((max, l) => (l.maj && (!max || l.maj > max) ? l.maj : max), null);
  return { tous: actifs + inactifs, actifs, inactifs, majLe };
}

type AvecActifBrut<T extends { actif: boolean }> = Omit<T, 'actif'> & { actif: number };

/** SQLite stocke `actif` en 0/1 ; les écrans le lisent en booléen. */
function versLigne<T extends { actif: boolean }>(brut: AvecActifBrut<T>): T {
  return { ...brut, actif: brut.actif === 1 } as T;
}

// --- Pesticides ------------------------------------------------------------------------------

export type TriPesticide = 'nom' | 'code' | 'maj';

export interface FiltrePesticides {
  recherche: string;
  statut: StatutFiltre;
  type: string | null;
  matiereActive: string | null;
  tri: TriPesticide;
  inclureInactifs: boolean;
}

export interface PesticideLigne {
  id: string;
  code: string;
  nom: string;
  matiere_active: string | null;
  dose_reference: string | null;
  type_produit: string | null;
  actif: boolean;
  updated_at: string;
}

const TRI_PESTICIDE: Record<TriPesticide, string> = {
  nom: 'nom COLLATE NOCASE',
  code: 'code',
  maj: 'updated_at DESC',
};

export async function listerPesticides(filtre: FiltrePesticides): Promise<PesticideLigne[]> {
  const db = await getReferentielDb();
  const requete = nouvelleRequete();
  ajouterRecherche(requete, filtre.recherche, ['nom', 'code', 'matiere_active']);
  if (filtre.type) {
    requete.conditions.push('type_produit = ?');
    requete.params.push(filtre.type);
  }
  if (filtre.matiereActive) {
    requete.conditions.push('matiere_active = ?');
    requete.params.push(filtre.matiereActive);
  }
  ajouterStatut(requete, 'actif', filtre.statut, filtre.inclureInactifs);

  const lignes = await db.getAllAsync<AvecActifBrut<PesticideLigne>>(
    `SELECT id, code, nom, matiere_active, dose_reference, type_produit, actif, updated_at FROM pesticide${clauseWhere(requete)} ORDER BY ${TRI_PESTICIDE[filtre.tri]}`,
    requete.params
  );
  return lignes.map((l) => versLigne<PesticideLigne>(l));
}

export function compterPesticides() {
  return compterParStatut('pesticide');
}

export async function listerTypesPesticide(): Promise<string[]> {
  const db = await getReferentielDb();
  const lignes = await db.getAllAsync<{ valeur: string }>(
    'SELECT DISTINCT type_produit AS valeur FROM pesticide WHERE type_produit IS NOT NULL ORDER BY type_produit'
  );
  return lignes.map((l) => l.valeur);
}

export async function listerMatieresActives(): Promise<string[]> {
  const db = await getReferentielDb();
  const lignes = await db.getAllAsync<{ valeur: string }>(
    'SELECT DISTINCT matiere_active AS valeur FROM pesticide WHERE matiere_active IS NOT NULL ORDER BY matiere_active'
  );
  return lignes.map((l) => l.valeur);
}

export async function getPesticide(id: string): Promise<PesticideLigne | null> {
  const db = await getReferentielDb();
  const ligne = await db.getFirstAsync<AvecActifBrut<PesticideLigne>>(
    'SELECT id, code, nom, matiere_active, dose_reference, type_produit, actif, updated_at FROM pesticide WHERE id = ?',
    [id]
  );
  return ligne ? versLigne<PesticideLigne>(ligne) : null;
}

// --- Stations fixes --------------------------------------------------------------------------

export type TriStation = 'nom' | 'code' | 'maj';

export interface FiltreStations {
  recherche: string;
  statut: StatutFiltre;
  region: string | null;
  tri: TriStation;
}

export interface StationLigne {
  id: string;
  code: string;
  nom: string;
  commune: string;
  district: string;
  region: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  actif: boolean;
  updated_at: string;
  poste_code: string | null;
  poste_nom: string | null;
}

const TRI_STATION: Record<TriStation, string> = {
  nom: 's.nom COLLATE NOCASE',
  code: 's.code',
  maj: 's.updated_at DESC',
};

const SELECT_STATION = `SELECT s.id, s.code, s.nom, s.commune, s.district, s.region, s.latitude, s.longitude, s.altitude,
       s.actif, s.updated_at, p.code AS poste_code, p.nom AS poste_nom
     FROM station_fixe s LEFT JOIN poste_acridien p ON p.id = s.pa_id`;

export async function listerStations(filtre: FiltreStations): Promise<StationLigne[]> {
  const db = await getReferentielDb();
  const requete = nouvelleRequete();
  ajouterRecherche(requete, filtre.recherche, ['s.nom', 's.code', 's.commune', 'p.nom']);
  if (filtre.region) {
    requete.conditions.push('s.region = ?');
    requete.params.push(filtre.region);
  }
  ajouterStatut(requete, 's.actif', filtre.statut, filtre.statut !== 'actifs');

  const lignes = await db.getAllAsync<AvecActifBrut<StationLigne>>(
    `${SELECT_STATION}${clauseWhere(requete)} ORDER BY ${TRI_STATION[filtre.tri]}`,
    requete.params
  );
  return lignes.map((l) => versLigne<StationLigne>(l));
}

export function compterStations() {
  return compterParStatut('station_fixe');
}

export async function listerRegionsStations(): Promise<string[]> {
  const db = await getReferentielDb();
  const lignes = await db.getAllAsync<{ valeur: string }>(
    'SELECT DISTINCT region AS valeur FROM station_fixe WHERE region IS NOT NULL ORDER BY region'
  );
  return lignes.map((l) => l.valeur);
}

export async function getStation(id: string): Promise<StationLigne | null> {
  const db = await getReferentielDb();
  const ligne = await db.getFirstAsync<AvecActifBrut<StationLigne>>(
    `${SELECT_STATION} WHERE s.id = ?`,
    [id]
  );
  return ligne ? versLigne<StationLigne>(ligne) : null;
}

// --- Codes stades ----------------------------------------------------------------------------

export type SexeFiltre = 'tous' | 'F' | 'M' | 'non_sexe';
export type CategorieFiltre = 'toutes' | 'imago' | 'larve';

export interface FiltreCodesStades {
  recherche: string;
  sexe: SexeFiltre;
  espece: string | null;
  categorie: CategorieFiltre;
}

export interface CodeStadeLigne {
  id: string;
  code: string;
  libelle: string;
  categorie: string | null;
  sexe: string | null;
  espece: string | null;
  ordre: number;
  actif: boolean;
  updated_at: string;
}

const SELECT_CODE_STADE = 'SELECT id, code, libelle, categorie, sexe, espece, ordre, actif, updated_at FROM code_stade';

export async function listerCodesStades(filtre: FiltreCodesStades): Promise<CodeStadeLigne[]> {
  const db = await getReferentielDb();
  const requete = nouvelleRequete();
  requete.conditions.push('actif = 1');
  ajouterRecherche(requete, filtre.recherche, ['code', 'libelle']);
  if (filtre.categorie !== 'toutes') {
    requete.conditions.push('categorie = ?');
    requete.params.push(filtre.categorie);
  }
  // Un stade sans sexe (larve) ou sans espèce vaut pour tous : il reste visible sous un filtre précis.
  if (filtre.sexe === 'non_sexe') {
    requete.conditions.push('sexe IS NULL');
  } else if (filtre.sexe !== 'tous') {
    requete.conditions.push('(sexe IS NULL OR sexe = ?)');
    requete.params.push(filtre.sexe);
  }
  if (filtre.espece) {
    requete.conditions.push('(espece IS NULL OR espece = ?)');
    requete.params.push(filtre.espece);
  }

  const lignes = await db.getAllAsync<AvecActifBrut<CodeStadeLigne>>(
    `${SELECT_CODE_STADE}${clauseWhere(requete)} ORDER BY ordre`,
    requete.params
  );
  return lignes.map((l) => versLigne<CodeStadeLigne>(l));
}

export async function listerEspecesCodesStades(): Promise<string[]> {
  const db = await getReferentielDb();
  const lignes = await db.getAllAsync<{ valeur: string }>(
    'SELECT DISTINCT espece AS valeur FROM code_stade WHERE espece IS NOT NULL ORDER BY espece'
  );
  return lignes.map((l) => l.valeur);
}

export async function getCodeStade(id: string): Promise<CodeStadeLigne | null> {
  const db = await getReferentielDb();
  const ligne = await db.getFirstAsync<AvecActifBrut<CodeStadeLigne>>(
    `${SELECT_CODE_STADE} WHERE id = ?`,
    [id]
  );
  return ligne ? versLigne<CodeStadeLigne>(ligne) : null;
}

export interface GroupeCodesStades {
  cle: string;
  titre: string;
  lignes: CodeStadeLigne[];
}

const RANG_CATEGORIE: Record<string, number> = { imago: 0, larve: 1 };
const RANG_SEXE: Record<string, number> = { F: 0, M: 1 };
const LIBELLE_SEXE: Record<string, string> = { F: 'FEMELLE', M: 'MÂLE' };

/** Sections de la liste : « IMAGO · FEMELLE », « IMAGO · MÂLE », « LARVE » — imago avant larve. */
export function grouperCodesStades(lignes: CodeStadeLigne[]): GroupeCodesStades[] {
  const groupes = new Map<string, GroupeCodesStades & { rang: [number, number] }>();
  for (const ligne of lignes) {
    const categorie = ligne.categorie ?? '';
    const sexe = ligne.sexe ?? '';
    const cle = `${categorie}|${sexe}`;
    let groupe = groupes.get(cle);
    if (!groupe) {
      const base = categorie ? categorie.toUpperCase() : 'AUTRES';
      groupe = {
        cle,
        titre: sexe && LIBELLE_SEXE[sexe] ? `${base} · ${LIBELLE_SEXE[sexe]}` : base,
        lignes: [],
        rang: [RANG_CATEGORIE[categorie] ?? 9, RANG_SEXE[sexe] ?? 9],
      };
      groupes.set(cle, groupe);
    }
    groupe.lignes.push(ligne);
  }
  return [...groupes.values()]
    .sort((a, b) => a.rang[0] - b.rang[0] || a.rang[1] - b.rang[1])
    .map(({ rang: _rang, ...groupe }) => ({
      ...groupe,
      lignes: [...groupe.lignes].sort((a, b) => a.ordre - b.ordre),
    }));
}

// --- Libellés --------------------------------------------------------------------------------

const TYPES_PRODUIT: Record<string, string> = {
  produit_choc: 'Produit de choc',
  produit_barriere: 'Produit barrière',
};

/** « produit_choc » → « Produit de choc » ; un type inconnu reste lisible plutôt que brut. */
export function libelleTypeProduit(type: string | null | undefined): string {
  if (!type) return '—';
  if (TYPES_PRODUIT[type]) return TYPES_PRODUIT[type];
  const texte = type.replace(/_/g, ' ');
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

export function glypheSexe(sexe: string | null | undefined): string | null {
  if (sexe === 'F') return '♀';
  if (sexe === 'M') return '♂';
  return null;
}

/** « Femelle ♀ », « Mâle ♂ » ; un stade sans sexe vaut « Non sexé ». */
export function libelleSexe(sexe: string | null | undefined): string {
  if (sexe === 'F') return 'Femelle ♀';
  if (sexe === 'M') return 'Mâle ♂';
  return 'Non sexé';
}

export function libelleCategorie(categorie: string | null | undefined): string {
  if (!categorie) return '—';
  return categorie.charAt(0).toUpperCase() + categorie.slice(1);
}

/** « Nomadacris septemfasciata » → « Nomadacris » (puce et liste) ; sans espèce : « Toutes espèces ». */
export function especeCourte(espece: string | null | undefined): string {
  return espece ? espece.split(' ')[0] : 'Toutes espèces';
}

export const LIBELLE_TRI: Record<'nom' | 'code' | 'maj', string> = {
  nom: 'Nom A→Z',
  code: 'Code',
  maj: 'Dernière màj',
};

/** « 38 RÉSULTATS » ; en français, 0 et 1 sont au singulier. */
export function libelleResultats(n: number): string {
  return `${n} ${n > 1 ? 'RÉSULTATS' : 'RÉSULTAT'}`;
}

/** Le bouton de la feuille de filtres : « Voir les 38 résultats », « Voir le résultat », « Aucun résultat ». */
export function libelleVoirResultats(n: number): string {
  if (n === 0) return 'Aucun résultat';
  return n === 1 ? 'Voir le résultat' : `Voir les ${n} résultats`;
}
