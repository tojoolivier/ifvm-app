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
 * Stades larvaires de la fiche **extensive** uniquement. Ils ne partent pas dans
 * `prospection_capture.stade` mais servent de clés à `densites_larve` (JSONB, sans
 * contrainte). La fiche intensive, elle, lit le référentiel synchronisé
 * (`listStadesGrille`) : c'est là que la divergence coûtait cher (#201).
 */
export const LMC_LARVE_STADES = ['L1', 'L2', 'L3', 'L4', 'L5'];
export const NSE_LARVE_STADES = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'];

// #phase-ordre-affichage : Solitaire → Solitaro-trans → Transiens → Grégaire —
// même ordre que `PHENOTYPES` (prospection-fiche-lecture.ts) et `PHASES`
// (frontend/src/lib/prospection-reference-data.ts), qui l'avaient déjà.
export const PHASES_LMC = ['solitaire', 'solitaro_trans', 'transiens', 'gregaire'];
/** Nomadacris larvaire ne distingue pas le solitaro-transiens (PDF 16). */
export const PHASES_NSE_LARVE = ['solitaire', 'transiens', 'gregaire'];

export function stadesLarvairesFor(espece: Espece): string[] {
  return espece === 'LMC' ? LMC_LARVE_STADES : NSE_LARVE_STADES;
}

export function phasesFor(espece: Espece, categorie: Categorie): string[] {
  return espece === 'NSE' && categorie === 'larve' ? PHASES_NSE_LARVE : PHASES_LMC;
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

/**
 * Options Accouplement/Ponte — réduites à 3 niveaux communs LMC/NSE (migration
 * backend 0059, remplace les 5/4 niveaux d'origine issus du PDF papier : LMC
 * avait "Peu"/"Dominant" en plus, Nomadacris n'avait déjà pas "Dominant"
 * (PDF 11 vs PDF 16) — les deux espèces partagent désormais la même échelle.
 */
export const ACCOUPLEMENT_OPTIONS_LMC = ['Néant', 'Rare', 'Beaucoup'];
export const ACCOUPLEMENT_OPTIONS_NSE = ['Néant', 'Rare', 'Beaucoup'];

export function accouplementOptionsFor(espece: Espece): string[] {
  return espece === 'LMC' ? ACCOUPLEMENT_OPTIONS_LMC : ACCOUPLEMENT_OPTIONS_NSE;
}

export { PHENOTYPES, PHENOTYPES_3 } from './prospection-fiche-lecture';
export type { Phenotype };

/** Phénotypes disponibles par grille : NSE larve n'a pas "Solitaro-trans" (PDF). */
export function phenotypesFor(espece: Espece, categorie: Categorie): typeof PHENOTYPES {
  return espece === 'NSE' && categorie === 'larve' ? PHENOTYPES_3 : PHENOTYPES;
}
