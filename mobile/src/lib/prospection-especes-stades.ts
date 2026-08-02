import { Phenotype } from './prospection-fiche-lecture';

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

/** LMC imagos femelles : 9 stades incluant les sous-stades A3. */
export const LMC_FEMALE_STADES = ['A1', 'A2', 'A3', 'A3¼', 'A3½', 'A3¾', 'A3 4/4', 'A4', 'A5'];
/** LMC imagos mâles : jeu simplifié, sans sous-stades. */
export const LMC_MALE_STADES = ['A1', 'A234', 'A5'];
/** NSE imagos : pas de bascule sexe, même forme que le jeu mâle simplifié. */
export const NSE_STADES = LMC_MALE_STADES;
/** Larves : stades propres à chaque espèce (ADR-006). */
export const LMC_LARVE_STADES = ['L1', 'L2', 'L3', 'L4', 'L5'];
export const NSE_LARVE_STADES = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'];

export function stadesFor(espece: Espece, categorie: Categorie, sexe: Sexe | null): string[] {
  if (categorie === 'larve') return espece === 'LMC' ? LMC_LARVE_STADES : NSE_LARVE_STADES;
  if (espece === 'NSE') return NSE_STADES;
  return sexe === 'F' ? LMC_FEMALE_STADES : LMC_MALE_STADES;
}

/** Ramène le stade courant vers le premier stade du nouveau jeu si absent du nouveau jeu (bascule sexe LMC imago). */
export function remapStadeForSexeChange(currentStade: string | null, newSexe: Sexe): string {
  const stades = newSexe === 'F' ? LMC_FEMALE_STADES : LMC_MALE_STADES;
  return currentStade && stades.includes(currentStade) ? currentStade : stades[0];
}

export const CAPTURES_MAX: Record<Espece, number> = { LMC: 50, NSE: 30 };
export const CHRONO_MAX_SECONDS = 30 * 60;

export { PHENOTYPES } from './prospection-fiche-lecture';
export type { Phenotype };
