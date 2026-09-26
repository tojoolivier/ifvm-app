import type { ProspectionCreate } from './prospection-db';

/**
 * Étapes du wizard de prospection (#683), déclarées une seule fois : l'en-tête, la navigation et la
 * reprise d'un brouillon lisent tous cette liste. Intensive, extensive et validation partagent le même ordre.
 */
export const ETAPES = ['reference', 'vegetation', 'sol', 'observations', 'recapitulatif'] as const;
export type Etape = (typeof ETAPES)[number];
export const NB_ETAPES = ETAPES.length;

/** Ce que le badge de l'en-tête affiche : le type de fiche, ou « revalidation » pour une fiche chaînée. */
export type TypeWizard = 'intensive' | 'extensive' | 'validation' | 'revalidation';

const TYPES: readonly TypeWizard[] = ['intensive', 'extensive', 'validation', 'revalidation'];

export function estTypeWizard(valeur: unknown): valeur is TypeWizard {
  return typeof valeur === 'string' && (TYPES as readonly string[]).includes(valeur);
}

/** Le type choisi à l'entrée : jamais modifiable dans le wizard, seulement relu depuis la fiche. */
export function typeDeFiche(fiche: Pick<ProspectionCreate, 'type_prospection' | 'revalide_de_id'>): TypeWizard {
  return fiche.revalide_de_id ? 'revalidation' : fiche.type_prospection;
}

export function estRenseignee(valeur: unknown): boolean {
  if (valeur == null) return false;
  if (typeof valeur === 'string') return valeur.trim() !== '';
  if (Array.isArray(valeur)) return valeur.length > 0;
  if (typeof valeur === 'object') return Object.values(valeur).some(estRenseignee);
  return true;
}

type Saisie = Partial<ProspectionCreate>;

/** Une étape est « faite » quand ses champs clés sont renseignés ; la récap n'a pas de saisie propre. */
const ESTIMATEURS: Record<Exclude<Etape, 'recapitulatif'>, (s: Saisie) => boolean> = {
  reference: (s) => estRenseignee(s.station_id) && estRenseignee(s.date_prospection),
  // En extensif, la végétation n'est pas un JSON mais trois colonnes (#688).
  vegetation: (s) =>
    s.type_prospection === 'extensive'
      ? estRenseignee(s.hauteur_herbe_cm) || estRenseignee(s.verdissement_pourcent) || estRenseignee(s.degats_cultures)
      : estRenseignee(s.vegetation),
  // En intensif, `sol` contient déjà `solNu` dès l'étape Végétation : seules humidité et texture (obligatoires) font l'étape Sol (#689).
  sol: (s) => (s.type_prospection === 'intensive' ? estRenseignee(s.sol?.humidite) && estRenseignee(s.sol?.texture) : estRenseignee(s.sol)),
  observations: (s) => estRenseignee(s.observations) || estRenseignee(s.ennemis_naturels),
};

/** Reprise d'un brouillon : première étape non renseignée (0-indexé), la récap si tout est fait. */
export function etapeDeReprise(saisie: Saisie): number {
  const i = ETAPES.findIndex((e) => e !== 'recapitulatif' && !ESTIMATEURS[e](saisie));
  return i === -1 ? NB_ETAPES - 1 : i;
}
