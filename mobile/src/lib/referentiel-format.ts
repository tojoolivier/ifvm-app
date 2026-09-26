/**
 * Formatage et libellés du parcours « Référentiels » : dates, nombres, sexe, type de produit. Fonctions
 * pures, sans accès au cache — `referentiel-consultation` les ré-exporte pour que les écrans n'aient
 * qu'un seul point d'entrée.
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
