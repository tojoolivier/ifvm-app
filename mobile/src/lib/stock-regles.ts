import type { components } from './api-schema.generated';

/**
 * Règles du stock de pesticides côté terrain (#645, ADR-018). Le solde d'un (site, produit, unité)
 * vient du serveur ; les mouvements saisis hors-ligne et pas encore partis s'y ajoutent pour
 * l'affichage seulement. L et kg ne s'additionnent jamais : l'unité fait partie de la clé.
 */

export type UniteStock = 'L' | 'kg';
export type TypeMouvementSaisi = 'approvisionnement' | 'transfert';

export interface MouvementSaisi {
  type: TypeMouvementSaisi;
  pesticideId: string | null;
  siteId: string | null;
  siteDestinationId: string | null;
  /** Texte du champ : la virgule décimale est acceptée. */
  quantite: string;
  unite: UniteStock;
}

/** Nombre saisi (virgule ou point) ; `null` si ce n'en est pas un. */
export function lireQuantite(texte: string): number | null {
  const valeur = Number(texte.trim().replace(',', '.'));
  return texte.trim() !== '' && Number.isFinite(valeur) ? valeur : null;
}

export function validerMouvement(saisie: MouvementSaisi): string[] {
  const erreurs: string[] = [];
  if (!saisie.pesticideId) erreurs.push('Choisissez un produit.');
  if (!saisie.siteId) erreurs.push('Choisissez le site.');
  const quantite = lireQuantite(saisie.quantite);
  if (quantite === null || quantite <= 0) erreurs.push('La quantité doit être supérieure à zéro.');
  if (saisie.type === 'transfert') {
    if (!saisie.siteDestinationId) erreurs.push('Choisissez le site de destination.');
    else if (saisie.siteDestinationId === saisie.siteId) erreurs.push('La destination doit être un autre site.');
  }
  return erreurs;
}

export type SoldeServeur = components['schemas']['SoldePesticideRead'];

export interface MouvementEnAttente {
  type: TypeMouvementSaisi;
  pesticide_id: string;
  site_id: string;
  site_destination_id: string | null;
  quantite: number;
  unite: UniteStock;
}

export interface LigneSolde {
  siteId: string;
  pesticideId: string;
  unite: string;
  /** Dernier solde synchronisé. */
  serveur: number;
  /** Effet net des mouvements locaux pas encore envoyés. */
  enAttente: number;
  /** Ce que l'écran affiche : `serveur + enAttente`. */
  affiche: number;
}

/** Effet d'un mouvement en attente sur le solde du `siteId` (0 s'il ne le concerne pas). */
function effetSurSite(mouvement: MouvementEnAttente, siteId: string): number {
  if (mouvement.site_id === siteId) {
    return mouvement.type === 'transfert' ? -mouvement.quantite : mouvement.quantite;
  }
  if (mouvement.type === 'transfert' && mouvement.site_destination_id === siteId) return mouvement.quantite;
  return 0;
}

/** Une ligne par (produit, unité) du site : le solde serveur, les mouvements locaux, le total affiché. */
export function calculerSoldes(
  serveur: SoldeServeur[],
  enAttente: MouvementEnAttente[],
  siteId: string
): LigneSolde[] {
  const lignes = new Map<string, LigneSolde>();
  const ligne = (pesticideId: string, unite: string): LigneSolde => {
    const cle = `${pesticideId}|${unite}`;
    let existante = lignes.get(cle);
    if (!existante) {
      existante = { siteId, pesticideId, unite, serveur: 0, enAttente: 0, affiche: 0 };
      lignes.set(cle, existante);
    }
    return existante;
  };

  for (const solde of serveur) {
    if (solde.site_id === siteId) ligne(solde.pesticide_id, solde.unite).serveur = solde.quantite;
  }
  for (const mouvement of enAttente) {
    const effet = effetSurSite(mouvement, siteId);
    if (effet !== 0) ligne(mouvement.pesticide_id, mouvement.unite).enAttente += effet;
  }
  for (const l of lignes.values()) l.affiche = l.serveur + l.enAttente;
  return [...lignes.values()];
}

export function formaterQuantite(valeur: number): string {
  return String(Math.round(valeur * 100) / 100).replace('.', ',');
}

export function formaterVariation(valeur: number, unite: string): string {
  return `${valeur > 0 ? '+' : ''}${formaterQuantite(valeur)} ${unite}`;
}
