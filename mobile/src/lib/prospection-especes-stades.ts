import { PHENOTYPES, PHENOTYPES_3, Phenotype } from './prospection-fiche-lecture';

export type Sexe = 'F' | 'M';
export type Espece = 'LMC' | 'NSE';
export type Categorie = 'imago' | 'larve';

export interface GrilleKey {
  espece: Espece;
  categorie: Categorie;
}

export function grilleKeyToString(key: GrilleKey): string {
  return `${key.espece}:${key.categorie}`;
}

export function grilleKeyFromString(value: string): GrilleKey {
  const [espece, categorie] = value.split(':') as [Espece, Categorie];
  return { espece, categorie };
}

/**
 * Vocabulaire des stades — autorité unique côté mobile. Ces codes partent tels quels
 * vers `prospection_capture.stade`, qui référence le référentiel `code_stade` : une
 * liste recopiée ailleurs dérive et fait échouer l'enregistrement de la fiche (#201).
 */

/** Imagos femelles (LMC et NSE) : 9 stades incluant les sous-stades A3 — même jeu pour les deux espèces (PDF officiel). */
export const LMC_FEMALE_STADES = ['A1', 'A2', 'A3', 'A3-1/4', 'A3-1/2', 'A3-3/4', 'A3-4/4', 'A4', 'A5'];
/** Imagos mâles (LMC et NSE) : jeu simplifié — A2, A3 et A4 sont regroupés en A234. */
export const LMC_MALE_STADES = ['A1', 'A234', 'A5'];
/** Larves : stades propres à chaque espèce (ADR-006). */
export const LMC_LARVE_STADES = ['L1', 'L2', 'L3', 'L4', 'L5'];
export const NSE_LARVE_STADES = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'];

export const PHASES_LMC = ['solitaire', 'transiens', 'solitaro_trans', 'gregaire'];
/** Nomadacris larvaire ne distingue pas le solitaro-transiens (PDF 16). */
export const PHASES_NSE_LARVE = ['solitaire', 'transiens', 'gregaire'];

export function stadesFor(espece: Espece, categorie: Categorie, sexe: Sexe | null): string[] {
  if (categorie === 'larve') return espece === 'LMC' ? LMC_LARVE_STADES : NSE_LARVE_STADES;
  return sexe === 'F' ? LMC_FEMALE_STADES : LMC_MALE_STADES;
}

export function phasesFor(espece: Espece, categorie: Categorie): string[] {
  return espece === 'NSE' && categorie === 'larve' ? PHASES_NSE_LARVE : PHASES_LMC;
}

/** Ramène le stade courant vers le premier stade du nouveau jeu si absent du nouveau jeu (bascule sexe imago). */
export function remapStadeForSexeChange(currentStade: string | null, newSexe: Sexe): string {
  const stades = newSexe === 'F' ? LMC_FEMALE_STADES : LMC_MALE_STADES;
  return currentStade && stades.includes(currentStade) ? currentStade : stades[0];
}

/** Plafonds de capture par fiche (PDF) : LMC imago 50, LMC larve 65, NSE imago 30, NSE larve 75. */
const CAPTURES_MAX_BY_GRILLE: Record<string, number> = {
  'LMC:imago': 50,
  'LMC:larve': 65,
  'NSE:imago': 30,
  'NSE:larve': 75,
};

export function capturesMaxFor(espece: Espece, categorie: Categorie): number {
  return CAPTURES_MAX_BY_GRILLE[`${espece}:${categorie}`];
}

export const CHRONO_MAX_SECONDS = 30 * 60;

/** Options Accouplement/Ponte : Nomadacris n'a pas le niveau "Dominant" (PDF 11 vs PDF 16). */
export const ACCOUPLEMENT_OPTIONS_LMC = ['Néant', 'Rare', 'Peu', 'Beaucoup', 'Dominant'];
export const ACCOUPLEMENT_OPTIONS_NSE = ['Néant', 'Rare', 'Peu', 'Beaucoup'];

export function accouplementOptionsFor(espece: Espece): string[] {
  return espece === 'LMC' ? ACCOUPLEMENT_OPTIONS_LMC : ACCOUPLEMENT_OPTIONS_NSE;
}

export { PHENOTYPES, PHENOTYPES_3 } from './prospection-fiche-lecture';
export type { Phenotype };

/** Phénotypes disponibles par grille : NSE larve n'a pas "Solitaro-trans" (PDF). */
export function phenotypesFor(espece: Espece, categorie: Categorie): typeof PHENOTYPES {
  return espece === 'NSE' && categorie === 'larve' ? PHENOTYPES_3 : PHENOTYPES;
}
