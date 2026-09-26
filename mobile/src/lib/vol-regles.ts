/**
 * Règles métier de la saisie d'un vol (#644), les mêmes que `CreateVol` côté backend : site principal
 * + stand pour la mise en place et l'application, motif pour le convoyage et le divers, lieux pour le
 * convoyage, fin après début. Vérifiées ici pour donner à l'agent une liste lisible avant
 * l'enregistrement hors-ligne ; le serveur reste juge (422).
 */

import type { components } from './api-schema.generated';

/** Catégories du contrat OpenAPI (`VolCreate.type`), jamais recopiées à la main. */
export type CategorieVol = components['schemas']['VolCreate']['type'];

export interface VolSaisi {
  categorie: CategorieVol;
  /** Type de l'équipe de travail : un vol ne se mène qu'avec une équipe aérienne. `null` : équipe inconnue de l'appareil. */
  equipeType: 'terrestre' | 'aerien' | null;
  aeronefId: string | null;
  /** `YYYY-MM-DD` */
  date: string;
  debut: string;
  fin: string;
  sitePrincipalId: string | null;
  standId: string | null;
  baseSecondaireId: string | null;
  motif: string;
  lieuDepart: string;
  lieuArrivee: string;
}

export interface ContexteVol {
  /** Sites dépendants (stands, bases secondaires) du site principal. */
  dependantIds: string[];
}

const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;

const AVEC_SITE_ET_STAND: CategorieVol[] = ['mise_en_place', 'application'];
const AVEC_MOTIF: CategorieVol[] = ['convoyage', 'divers'];

export function validerVol(vol: VolSaisi, { dependantIds }: ContexteVol): string[] {
  const erreurs: string[] = [];

  if (vol.equipeType === null) {
    erreurs.push('Équipe de travail introuvable sur l’appareil : synchronisez les référentiels puis réessayez.');
  } else if (vol.equipeType !== 'aerien') {
    erreurs.push('Un vol se mène avec une équipe aérienne : changez d’équipe de travail dans Paramètres.');
  }
  if (!vol.aeronefId) erreurs.push('L’équipe n’a aucun aéronef en service : impossible de saisir un vol.');

  const debutOk = HEURE.test(vol.debut);
  const finOk = HEURE.test(vol.fin);
  if (!debutOk) erreurs.push('L’heure de début est obligatoire (HH:MM).');
  if (!finOk) erreurs.push('L’heure de fin est obligatoire (HH:MM).');
  // « HH:MM » se compare lexicographiquement.
  if (debutOk && finOk && vol.fin <= vol.debut) {
    erreurs.push('L’heure de fin doit être postérieure à l’heure de début.');
  }

  if (AVEC_SITE_ET_STAND.includes(vol.categorie)) {
    if (!vol.sitePrincipalId) erreurs.push('Aucun site principal actif : impossible de saisir ce vol.');
    if (!vol.standId) erreurs.push('Choisissez le stand de remplissage.');
  }
  // Sans site principal, aucun dépendant n'est valable : le serveur refuse un stand ou une base orphelins.
  if (vol.standId && !dependantIds.includes(vol.standId)) {
    erreurs.push('Le stand choisi ne dépend pas du site principal.');
  }
  if (vol.baseSecondaireId && !dependantIds.includes(vol.baseSecondaireId)) {
    erreurs.push('La base secondaire choisie ne dépend pas du site principal.');
  }

  if (AVEC_MOTIF.includes(vol.categorie) && !vol.motif.trim()) erreurs.push('Le motif est obligatoire.');
  if (vol.categorie === 'convoyage') {
    if (!vol.lieuDepart.trim()) erreurs.push('Le lieu de départ est obligatoire.');
    if (!vol.lieuArrivee.trim()) erreurs.push('Le lieu d’arrivée est obligatoire.');
  }

  return erreurs;
}

/** Durée en minutes entre deux heures `HH:MM` (0 si l'une est illisible). */
export function dureeMinutes(debut: string, fin: string): number {
  if (!HEURE.test(debut) || !HEURE.test(fin)) return 0;
  const minutes = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
  return Math.max(0, minutes(fin) - minutes(debut));
}

/** `165` → « 2h 45min » (format des maquettes Figma) ; `court` : « 2h 45 » (lignes de « Mes vols »). */
export function formaterDuree(totalMinutes: number, court = false): string {
  const heures = Math.floor(totalMinutes / 60);
  const minutes = String(totalMinutes % 60).padStart(2, '0');
  return `${heures}h ${minutes}${court ? '' : 'min'}`;
}
