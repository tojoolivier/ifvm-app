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

export const PHASES_LMC = ['solitaire', 'transiens', 'solitaro_trans', 'gregaire'];
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

export interface PhaseAllocation {
  phase: string;
  effectif: number;
}

/**
 * Répartit `count` individus d'un stade entre les phases renseignées, proportionnellement
 * à leur effectif déclaré — algorithme extrait à l'identique de `captures.tsx`
 * (`createRowsForStade`, historique #201/#228) pour être partagé par les écrans de saisie
 * intensifs (`intensive-imagos.tsx`, `intensive-larves.tsx`). La dernière phase de la liste
 * absorbe l'écart d'arrondi, garantissant que la somme des effectifs alloués retombe
 * exactement sur `count` — c'est la règle bloquante Captures = Phases = Stades qui l'exige.
 */
export function repartirStadeSurPhases(
  count: number,
  phasesAvecEffectifs: { phase: string; count: number }[]
): PhaseAllocation[] {
  if (count <= 0 || phasesAvecEffectifs.length === 0) return [];
  const totalPhaseCount = phasesAvecEffectifs.reduce((sum, p) => sum + p.count, 0);
  const allocations: PhaseAllocation[] = [];
  let remaining = count;
  for (let i = 0; i < phasesAvecEffectifs.length; i++) {
    const phase = phasesAvecEffectifs[i];
    if (i === phasesAvecEffectifs.length - 1) {
      if (remaining > 0) allocations.push({ phase: phase.phase, effectif: remaining });
    } else {
      const proportion = phase.count / totalPhaseCount;
      const allocated = Math.round(count * proportion);
      if (allocated > 0) {
        allocations.push({ phase: phase.phase, effectif: allocated });
        remaining -= allocated;
      }
    }
  }
  return allocations;
}
