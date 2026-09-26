import type { CategorieGrille, TypeGrille } from './prospection-capture-rules';

/** Sexe sous lequel un stade est vu : les imagos ont un jeu par sexe, les larves n'en ont pas. */
export type SexeVu = 'F' | 'M' | 'sans_sexe';

export interface GrilleVue {
  phases: string[];
  stades: Record<SexeVu, string[]>;
}

/** Ce que l'agent a vu : une entrée par grille cochée, clé `espece:categorie`. */
export interface FiltreObservation {
  aucunCriquet: boolean;
  grilles: Record<string, GrilleVue>;
}

/** Espèces proposées à l'agent, dans l'ordre de la maquette. */
export const ESPECES = ['LMC', 'NSE'] as const;

const cle =(espece: string, categorie: CategorieGrille) => `${espece}:${categorie}`;

export const filtreVide = (): FiltreObservation => ({ aucunCriquet: false, grilles: {} });

export function basculerGrille(
  filtre: FiltreObservation,
  espece: string,
  categorie: CategorieGrille
): FiltreObservation {
  const { [cle(espece, categorie)]: dejaCochee, ...autres } = filtre.grilles;
  if (dejaCochee) return { ...filtre, grilles: autres };
  return {
    aucunCriquet: false,
    grilles: { ...filtre.grilles, [cle(espece, categorie)]: { phases: [], stades: { F: [], M: [], sans_sexe: [] } } },
  };
}

export const grilleVue = (filtre: FiltreObservation, espece: string, categorie: CategorieGrille) =>
  filtre.grilles[cle(espece, categorie)];

const basculer = (liste: string[], valeur: string) =>
  liste.includes(valeur) ? liste.filter((v) => v !== valeur) : [...liste, valeur];

function modifierGrille(
  filtre: FiltreObservation,
  espece: string,
  categorie: CategorieGrille,
  maj: (grille: GrilleVue) => GrilleVue
): FiltreObservation {
  const grille = grilleVue(filtre, espece, categorie);
  if (!grille) return filtre;
  return { ...filtre, grilles: { ...filtre.grilles, [cle(espece, categorie)]: maj(grille) } };
}

export const basculerPhase = (filtre: FiltreObservation, espece: string, categorie: CategorieGrille, phase: string) =>
  modifierGrille(filtre, espece, categorie, (g) => ({ ...g, phases: basculer(g.phases, phase) }));

export const basculerStade = (
  filtre: FiltreObservation,
  espece: string,
  categorie: CategorieGrille,
  sexe: SexeVu,
  stade: string
) => modifierGrille(filtre, espece, categorie, (g) => ({ ...g, stades: { ...g.stades, [sexe]: basculer(g.stades[sexe], stade) } }));

/** Bouton « Tous » d'une ligne de stades : coche tous les `codes` affichés, ou les décoche s'ils sont déjà tous cochés. */
export const basculerTousLesStades = (
  filtre: FiltreObservation,
  espece: string,
  categorie: CategorieGrille,
  sexe: SexeVu,
  codes: string[]
) =>
  modifierGrille(filtre, espece, categorie, (g) => {
    const tousCoches = codes.every((code) => g.stades[sexe].includes(code));
    return { ...g, stades: { ...g.stades, [sexe]: tousCoches ? [] : [...codes] } };
  });

/** « Aucun criquet observé » est exclusif : il vide toutes les grilles. */
export const choisirAucunCriquet = (_filtre: FiltreObservation): FiltreObservation => ({
  aucunCriquet: true,
  grilles: {},
});

export const nbGrilles = (filtre: FiltreObservation) => Object.keys(filtre.grilles).length;

/** Les quarts de A3 (A3-1/4 … A3-4/4) ne se saisissent que sur la fiche intensive. */
const estQuartDeA3 = (code: string) => /^A3-\d\/\d$/.test(code);

/** Stades proposés en puces : le référentiel complet en intensif, sans le détail des quarts de A3 ailleurs. */
export const stadesAffiches = <T extends { code: string }>(type: TypeGrille, stades: T[]): T[] =>
  type === 'intensive' ? stades : stades.filter((s) => !estQuartDeA3(s.code));
