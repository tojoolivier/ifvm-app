import { create } from 'zustand';
import {
  capturesMaxFor,
  Categorie,
  Espece,
  GrilleKey,
  Phenotype,
  Sexe,
  grilleKeyToString,
  phasesFor,
} from './prospection-especes-stades';
import { CaptureRow } from './prospection-repository';

export type CaptureCounts = Record<string, number>;

/**
 * Stades d'une grille, tels que le référentiel synchronisé les décrit. Rien n'est
 * énuméré ici : une liste écrite en dur finit par diverger de ce que le backend accepte,
 * et la fiche échoue à l'enregistrement (#201).
 */
export interface StadesGrille {
  F: string[];
  M: string[];
  larve: string[];
}

const STADES_GRILLE_VIDE: StadesGrille = { F: [], M: [], larve: [] };

export function captureKey(sexe: Sexe | null, phenotype: Phenotype, stade: string): string {
  return sexe ? `${sexe}|${phenotype}|${stade}` : `${phenotype}|${stade}`;
}

export function totalCaptures(counts: CaptureCounts): number {
  return Object.values(counts).reduce((sum, n) => sum + n, 0);
}

export function totalBySexe(counts: CaptureCounts, sexe: Sexe): number {
  return Object.entries(counts)
    .filter(([key]) => key.startsWith(`${sexe}|`))
    .reduce((sum, [, n]) => sum + n, 0);
}

export function dominantPhenotype(counts: CaptureCounts): Phenotype | null {
  const totals: Partial<Record<Phenotype, number>> = {};
  for (const [key, n] of Object.entries(counts)) {
    const parts = key.split('|');
    const phenotype = (parts.length === 3 ? parts[1] : parts[0]) as Phenotype;
    totals[phenotype] = (totals[phenotype] ?? 0) + n;
  }
  let best: Phenotype | null = null;
  let bestCount = 0;
  for (const [phenotype, n] of Object.entries(totals) as [Phenotype, number][]) {
    if (n > bestCount) {
      best = phenotype;
      bestCount = n;
    }
  }
  return best;
}

/**
 * Les paires proposées à la saisie du stade dominant (#regroupement-slides). L5-L6 et
 * L6-L7 couvrent NSE, qui va jusqu'à L7 (LMC s'arrête à L5).
 */
export type StadeDominantBucket = 'l1_l2' | 'l2_l3' | 'l3_l4' | 'l4_l5' | 'l5_l6' | 'l6_l7';

export interface DominantStadeLarve {
  /** Libellé brut du stade le plus capturé, ex. "L2". */
  stade: string;
  effectif: number;
  /** Regroupement attendu par le champ backend `stade_dominant` (StadeDominant : l1_l2/l2_l3/l3_l4/l4_l5). */
  bucket: StadeDominantBucket;
}

/**
 * Stade larvaire dominant, agrégé sur toutes les espèces (LMC+NSE) de la fiche : la
 * fiche d'infestation ne distingue pas l'espèce, donc on additionne les effectifs par
 * stade brut avant de retenir le plus capturé, puis on le classe dans la paire attendue.
 */
export function dominantStadeLarve(rows: CaptureRow[]): DominantStadeLarve | null {
  const totals: Record<string, number> = {};
  for (const row of rows) {
    if (row.categorie !== 'larve') continue;
    totals[row.stade] = (totals[row.stade] ?? 0) + row.effectif;
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [stade, n] of Object.entries(totals)) {
    if (n > bestCount) {
      best = stade;
      bestCount = n;
    }
  }
  if (!best || bestCount <= 0) return null;
  const numero = Number(best.replace(/\D/g, ''));
  // Paire se terminant sur le stade dominant (L3 → L2-L3, L4 → L3-L4...) ; L1 n'a pas de
  // paire "L0-L1", il retombe donc sur la première paire disponible, L1-L2. Au-delà de L7
  // (ne devrait pas arriver, NSE s'arrête là), on retombe sur la dernière paire, L6-L7.
  const bucket: StadeDominantBucket =
    !Number.isFinite(numero) || numero <= 2
      ? 'l1_l2'
      : numero === 3
        ? 'l2_l3'
        : numero === 4
          ? 'l3_l4'
          : numero === 5
            ? 'l4_l5'
            : numero === 6
              ? 'l5_l6'
              : 'l6_l7';
  return { stade: best, effectif: bestCount, bucket };
}

export interface DominantStadeImago {
  sexe: Sexe;
  /** Libellé brut du stade le plus capturé, ex. "A3" ou "A123". */
  stade: string;
  effectif: number;
}

/**
 * Stade imago dominant, agrégé sur toutes les espèces (LMC+NSE) de la fiche. Femelles et
 * mâles n'ont pas le même référentiel de stades (♀ A1..A5, ♂ A1/A123/A5) : chaque paire
 * (sexe, stade) est comptée séparément, on retient la plus capturée toutes confondues.
 * Purement informatif (affiché à l'écran) — le backend n'a pas de champ dédié pour ça.
 */
export function dominantStadeImago(rows: CaptureRow[]): DominantStadeImago | null {
  const totals: Record<string, number> = {};
  for (const row of rows) {
    if (row.categorie !== 'imago' || !row.sexe) continue;
    const key = `${row.sexe}|${row.stade}`;
    totals[key] = (totals[key] ?? 0) + row.effectif;
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [key, n] of Object.entries(totals)) {
    if (n > bestCount) {
      best = key;
      bestCount = n;
    }
  }
  if (!best || bestCount <= 0) return null;
  const [sexe, stade] = best.split('|') as [Sexe, string];
  return { sexe, stade, effectif: bestCount };
}

export function rowsToCounts(rows: CaptureRow[]): CaptureCounts {
  const counts: CaptureCounts = {};
  for (const row of rows) {
    const key = captureKey(row.sexe, row.phase as Phenotype, row.stade);
    counts[key] = (counts[key] || 0) + row.effectif;
  }
  return counts;
}

export function countsToRows(espece: Espece, categorie: Categorie, counts: CaptureCounts): CaptureRow[] {
  const rows: CaptureRow[] = [];
  for (const [key, effectif] of Object.entries(counts)) {
    if (effectif <= 0) continue;
    const parts = key.split('|');
    const [sexe, phase, stade] =
      parts.length === 3 ? (parts as [Sexe, string, string]) : [null, parts[0], parts[1]];
    rows.push({
      espece,
      categorie,
      sexe: sexe ?? null,
      phase: phase ?? null,
      stade,
      effectif,
    });
  }
  return rows;
}

function getInitialStades(stadesList: readonly string[]): Record<string, number> {
  const newStades: Record<string, number> = {};
  for (const stade of stadesList) {
    newStades[stade] = 0;
  }
  return newStades;
}

function getInitialPhases(phasesList: readonly string[]): Record<string, number> {
  const newPhases: Record<string, number> = {};
  for (const phase of phasesList) {
    newPhases[phase] = 0;
  }
  return newPhases;
}

export interface CaptureLoopState {
  grilleOrder: GrilleKey[];
  currentGrilleIndex: number;
  completedGrilleKeys: string[];
  sexe: Sexe | null;
  currentStade: string | null;
  currentPhenotype: Phenotype | null;
  counts: CaptureCounts;
  stadesData: Record<string, number>;
  stadesDataF: Record<string, number>;
  stadesDataM: Record<string, number>;
  phasesData: Record<string, number>;
  currentSexe: Sexe;
  /** Stades de chaque grille, lus dans le référentiel synchronisé, indexés par `grilleKeyToString`. */
  stadesParGrille: Record<string, StadesGrille>;
  setStadesParGrille: (stades: Record<string, StadesGrille>) => void;
  initGrilles: (order: GrilleKey[], completed: string[], allCaptures: CaptureRow[]) => void;
  goToGrille: (index: number, allCaptures: CaptureRow[]) => void;
  markCurrentGrilleCompleted: () => void;
  setSexe: (sexe: Sexe) => void;
  setStade: (stade: string) => void;
  setPhenotype: (phenotype: Phenotype) => void;
  increment: () => void;
  decrement: () => void;
  updateStade: (stade: string, value: number) => void;
  incrementStade: (stade: string) => void;
  decrementStade: (stade: string) => void;
  updateStadeBySex: (sexe: Sexe, stade: string, value: number) => void;
  incrementStadeBySex: (sexe: Sexe, stade: string) => void;
  decrementStadeBySex: (sexe: Sexe, stade: string) => void;
  updatePhase: (phase: string, value: number) => void;
  incrementPhase: (phase: string) => void;
  decrementPhase: (phase: string) => void;
  reset: () => void;
}

function stadesDe(state: { stadesParGrille: Record<string, StadesGrille> }, grille: GrilleKey): StadesGrille {
  return state.stadesParGrille[grilleKeyToString(grille)] ?? STADES_GRILLE_VIDE;
}

function firstIncompleteIndex(order: GrilleKey[], completed: string[]): number {
  const index = order.findIndex((g) => !completed.includes(grilleKeyToString(g)));
  return index === -1 ? Math.max(0, order.length - 1) : index;
}

function countsForGrille(grille: GrilleKey, allCaptures: CaptureRow[]): CaptureCounts {
  return rowsToCounts(allCaptures.filter((row) => row.espece === grille.espece && row.categorie === grille.categorie));
}

/**
 * Exportée pour `intensive-imagos.tsx`/`intensive-larves.tsx` (#Regroupement-slides) :
 * ces écrans reconstruisent l'état de saisie d'une grille sans passer par le slot
 * unique `goToGrille` du store (ils tiennent LMC et NSE en mémoire simultanément).
 * Même fonction, aucun changement de comportement.
 */
export function stadesDepuisCaptures(
  grille: GrilleKey,
  allCaptures: CaptureRow[],
  stadesAttendus: string[],
  sexe: Sexe | null
): Record<string, number> {
  const stades = getInitialStades(stadesAttendus);
  for (const row of allCaptures) {
    if (row.espece !== grille.espece || row.categorie !== grille.categorie) continue;
    if (row.sexe !== sexe) continue;
    if (Object.prototype.hasOwnProperty.call(stades, row.stade)) {
      // Cumul, jamais affectation : l'enregistrement répartit un stade entre les phases
      // saisies, donc un même stade arrive en plusieurs lignes. Écraser n'en gardait
      // qu'une — 10 captures ressortaient à 5, avec des phases restées à 10 (#201).
      stades[row.stade] += row.effectif;
    }
  }
  return stades;
}

/** Exportée pour la même raison que `stadesDepuisCaptures` ci-dessus. */
export function phasesFromCaptures(grille: GrilleKey, allCaptures: CaptureRow[]): Record<string, number> {
  const phases = getInitialPhases(phasesFor(grille.espece, grille.categorie));
  for (const row of allCaptures) {
    if (row.espece !== grille.espece || row.categorie !== grille.categorie) continue;
    const phase = row.phase;
    if (!phase || !Object.prototype.hasOwnProperty.call(phases, phase)) continue;
    phases[phase] += row.effectif;
  }
  return phases;
}

function buildGrilleData(grille: GrilleKey, allCaptures: CaptureRow[], stades: StadesGrille) {
  const isImago = grille.categorie === 'imago';
  const currentSexe: Sexe = 'F';
  return {
    currentSexe,
    currentStade: (isImago ? stades.F : stades.larve)[0] ?? null,
    currentPhenotype: 'transiens' as Phenotype,
    counts: countsForGrille(grille, allCaptures),
    stadesData: isImago ? {} : stadesDepuisCaptures(grille, allCaptures, stades.larve, null),
    stadesDataF: isImago ? stadesDepuisCaptures(grille, allCaptures, stades.F, 'F') : {},
    stadesDataM: isImago ? stadesDepuisCaptures(grille, allCaptures, stades.M, 'M') : {},
    phasesData: phasesFromCaptures(grille, allCaptures),
  };
}

export const useProspectionCaptureStore = create<CaptureLoopState>((set, get) => ({
  grilleOrder: [],
  currentGrilleIndex: 0,
  completedGrilleKeys: [],
  sexe: null,
  currentStade: null,
  currentPhenotype: null,
  counts: {},
  stadesData: {},
  stadesDataF: {},
  stadesDataM: {},
  phasesData: {},
  currentSexe: 'F',
  stadesParGrille: {},

  setStadesParGrille: (stadesParGrille) => set({ stadesParGrille }),

  initGrilles: (order, completed, allCaptures) => {
    const index = firstIncompleteIndex(order, completed);
    const grille = order[index];
    if (!grille) {
      set({
        grilleOrder: order,
        completedGrilleKeys: completed,
        currentGrilleIndex: index,
        sexe: null,
        currentSexe: 'F',
        currentStade: null,
        currentPhenotype: null,
        counts: {},
        stadesData: {},
        stadesDataF: {},
        stadesDataM: {},
        phasesData: {},
      });
      return;
    }
    const data = buildGrilleData(grille, allCaptures, stadesDe(get(), grille));
    set({
      grilleOrder: order,
      completedGrilleKeys: completed,
      currentGrilleIndex: index,
      sexe: grille.categorie === 'imago' ? 'F' : null,
      currentSexe: data.currentSexe,
      currentStade: data.currentStade,
      currentPhenotype: data.currentPhenotype,
      counts: data.counts,
      stadesData: data.stadesData,
      stadesDataF: data.stadesDataF,
      stadesDataM: data.stadesDataM,
      phasesData: data.phasesData,
    });
  },

  goToGrille: (index, allCaptures) => {
    const grille = get().grilleOrder[index];
    if (!grille) return;
    const data = buildGrilleData(grille, allCaptures, stadesDe(get(), grille));
    set({
      currentGrilleIndex: index,
      sexe: grille.categorie === 'imago' ? 'F' : null,
      currentSexe: data.currentSexe,
      currentStade: data.currentStade,
      currentPhenotype: data.currentPhenotype,
      counts: data.counts,
      stadesData: data.stadesData,
      stadesDataF: data.stadesDataF,
      stadesDataM: data.stadesDataM,
      phasesData: data.phasesData,
    });
  },

  markCurrentGrilleCompleted: () => {
    const state = get();
    const grille = state.grilleOrder[state.currentGrilleIndex];
    if (!grille) return;
    const key = grilleKeyToString(grille);
    set((state) => ({
      completedGrilleKeys: state.completedGrilleKeys.includes(key) ? state.completedGrilleKeys : [...state.completedGrilleKeys, key],
    }));
  },

  setSexe: (sexe) => {
    const state = get();
    const grille = state.grilleOrder[state.currentGrilleIndex];
    if (!grille) return;
    if (grille.categorie !== 'imago') return;
    // Les jeux femelle et mâle ne coïncident pas : un stade absent du nouveau jeu
    // retombe sur son premier stade.
    const stades = stadesDe(state, grille)[sexe];
    const currentStade =
      state.currentStade && stades.includes(state.currentStade) ? state.currentStade : (stades[0] ?? null);
    set({ sexe, currentSexe: sexe, currentStade });
  },

  setStade: (stade) => set({ currentStade: stade }),
  setPhenotype: (phenotype) => set({ currentPhenotype: phenotype }),

  increment: () => {
    const state = get();
    const grille = state.grilleOrder[state.currentGrilleIndex];
    if (!grille || !state.currentStade || !state.currentPhenotype) return;
    if (totalCaptures(state.counts) >= capturesMaxFor(grille.espece, grille.categorie)) return;
    const key = captureKey(state.sexe, state.currentPhenotype, state.currentStade);
    set({ counts: { ...state.counts, [key]: (state.counts[key] ?? 0) + 1 } });
  },

  decrement: () => {
    const state = get();
    if (!state.currentStade || !state.currentPhenotype) return;
    const key = captureKey(state.sexe, state.currentPhenotype, state.currentStade);
    const current = state.counts[key] ?? 0;
    if (current <= 0) return;
    set({ counts: { ...state.counts, [key]: current - 1 } });
  },

  updateStade: (stade, value) => {
    set((state) => ({
      stadesData: { ...state.stadesData, [stade]: Math.max(0, Number(value) || 0) },
    }));
  },

  incrementStade: (stade) => {
    set((state) => ({
      stadesData: { ...state.stadesData, [stade]: (state.stadesData[stade] || 0) + 1 },
    }));
  },

  decrementStade: (stade) => {
    set((state) => ({
      stadesData: { ...state.stadesData, [stade]: Math.max(0, (state.stadesData[stade] || 0) - 1) },
    }));
  },

  updateStadeBySex: (sexe, stade, value) => {
    const safeValue = Math.max(0, Number(value) || 0);
    set((state) => {
      if (sexe === 'F') {
        return { stadesDataF: { ...state.stadesDataF, [stade]: safeValue } };
      }
      return { stadesDataM: { ...state.stadesDataM, [stade]: safeValue } };
    });
  },

  incrementStadeBySex: (sexe, stade) => {
    set((state) => {
      if (sexe === 'F') {
        return { stadesDataF: { ...state.stadesDataF, [stade]: (state.stadesDataF[stade] || 0) + 1 } };
      }
      return { stadesDataM: { ...state.stadesDataM, [stade]: (state.stadesDataM[stade] || 0) + 1 } };
    });
  },

  decrementStadeBySex: (sexe, stade) => {
    set((state) => {
      if (sexe === 'F') {
        return { stadesDataF: { ...state.stadesDataF, [stade]: Math.max(0, (state.stadesDataF[stade] || 0) - 1) } };
      }
      return { stadesDataM: { ...state.stadesDataM, [stade]: Math.max(0, (state.stadesDataM[stade] || 0) - 1) } };
    });
  },

  updatePhase: (phase, value) => {
    set((state) => ({
      phasesData: { ...state.phasesData, [phase]: Math.max(0, Number(value) || 0) },
    }));
  },

  incrementPhase: (phase) => {
    set((state) => ({
      phasesData: { ...state.phasesData, [phase]: (state.phasesData[phase] || 0) + 1 },
    }));
  },

  decrementPhase: (phase) => {
    set((state) => ({
      phasesData: { ...state.phasesData, [phase]: Math.max(0, (state.phasesData[phase] || 0) - 1) },
    }));
  },

  // `stadesParGrille` survit : c'est le référentiel synchronisé, pas de la saisie.
  reset: () => {
    set({
      grilleOrder: [],
      currentGrilleIndex: 0,
      completedGrilleKeys: [],
      sexe: null,
      currentStade: null,
      currentPhenotype: null,
      counts: {},
      stadesData: {},
      stadesDataF: {},
      stadesDataM: {},
      phasesData: {},
      currentSexe: 'F',
    });
  },
}));