import type { CategorieGrille } from './prospection-capture-rules';

export interface GrilleVue {
  phases: string[];
  stades: string[];
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
    grilles: { ...filtre.grilles, [cle(espece, categorie)]: { phases: [], stades: [] } },
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

export const basculerStade = (filtre: FiltreObservation, espece: string, categorie: CategorieGrille, stade: string) =>
  modifierGrille(filtre, espece, categorie, (g) => ({ ...g, stades: basculer(g.stades, stade) }));

/** « Aucun criquet observé » est exclusif : il vide toutes les grilles. */
export const choisirAucunCriquet = (_filtre: FiltreObservation): FiltreObservation => ({
  aucunCriquet: true,
  grilles: {},
});

export const nbGrilles = (filtre: FiltreObservation) => Object.keys(filtre.grilles).length;
