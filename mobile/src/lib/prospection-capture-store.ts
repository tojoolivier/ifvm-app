import { create } from 'zustand';
import {
  capturesMaxFor,
  Categorie,
  Espece,
  GrilleKey,
  Phenotype,
  Sexe,
  grilleKeyToString,
  remapStadeForSexeChange,
  stadesFor,
} from './prospection-especes-stades';
import { CaptureRow } from './prospection-repository';

export type CaptureCounts = Record<string, number>;

const STADES_CONFIG = {
  imago: {
    LMC: {
      F: ['A1', 'A2', 'A3', 'A3-1/4', 'A3-1/2', 'A3-3/4', 'A3-4/4', 'A4', 'A5'],
      M: ['A1', 'A123', 'A5'],
    },
    NSE: {
      F: ['A1', 'A2', 'A3', 'A3-1/4', 'A3-1/2', 'A3-3/4', 'A3-4/4', 'A4', 'A5'],
      M: ['A1', 'A123', 'A5'],
    },
  },
  larve: {
    LMC: ['L1', 'L2', 'L3', 'L4', 'L5'],
    NSE: ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'],
  },
} as const;

const PHASES_CONFIG = {
  LMC: {
    imago: ['solitaire', 'transiens', 'solitario_transiens', 'gregaire'],
    larve: ['solitaire', 'transiens', 'solitario_transiens', 'gregaire'],
  },
  NSE: {
    imago: ['solitaire', 'transiens', 'solitario_transiens', 'gregaire'],
    larve: ['solitaire', 'transiens', 'gregaire'],
  },
} as const;

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

export function rowsToCounts(rows: CaptureRow[]): CaptureCounts {
  const counts: CaptureCounts = {};
  for (const row of rows) {
    const key = row.sexe ? `${row.sexe}|${row.stade}` : row.stade;
    counts[key] = (counts[key] || 0) + row.effectif;
  }
  return counts;
}

export function countsToRows(espece: Espece, categorie: Categorie, counts: CaptureCounts): CaptureRow[] {
  const rows: CaptureRow[] = [];
  for (const [key, effectif] of Object.entries(counts)) {
    if (effectif <= 0) continue;
    const parts = key.split('|');
    const [sexe, stade] = parts.length === 2 ? (parts as [Sexe, string]) : [null, parts[0]];
    rows.push({
      espece,
      categorie,
      sexe: sexe ?? null,
      phase: null,
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

function firstIncompleteIndex(order: GrilleKey[], completed: string[]): number {
  const index = order.findIndex((g) => !completed.includes(grilleKeyToString(g)));
  return index === -1 ? Math.max(0, order.length - 1) : index;
}

function countsForGrille(grille: GrilleKey, allCaptures: CaptureRow[]): CaptureCounts {
  return rowsToCounts(allCaptures.filter((row) => row.espece === grille.espece && row.categorie === grille.categorie));
}

function stadesFemellesFromCaptures(grille: GrilleKey, allCaptures: CaptureRow[]): Record<string, number> {
  const stades = getInitialStades(grille.categorie === 'imago' ? STADES_CONFIG.imago[grille.espece].F : []);
  for (const row of allCaptures) {
    if (row.espece !== grille.espece || row.categorie !== grille.categorie) continue;
    if (grille.categorie !== 'imago') continue;
    if (row.sexe !== 'F') continue;
    if (Object.prototype.hasOwnProperty.call(stades, row.stade)) {
      stades[row.stade] = row.effectif;
    }
  }
  return stades;
}

function stadesMalesFromCaptures(grille: GrilleKey, allCaptures: CaptureRow[]): Record<string, number> {
  const stades = getInitialStades(grille.categorie === 'imago' ? STADES_CONFIG.imago[grille.espece].M : []);
  for (const row of allCaptures) {
    if (row.espece !== grille.espece || row.categorie !== grille.categorie) continue;
    if (grille.categorie !== 'imago') continue;
    if (row.sexe !== 'M') continue;
    if (Object.prototype.hasOwnProperty.call(stades, row.stade)) {
      stades[row.stade] = row.effectif;
    }
  }
  return stades;
}

function stadesLarvesFromCaptures(grille: GrilleKey, allCaptures: CaptureRow[]): Record<string, number> {
  const stades = getInitialStades(grille.categorie === 'larve' ? STADES_CONFIG.larve[grille.espece] : []);
  for (const row of allCaptures) {
    if (row.espece !== grille.espece || row.categorie !== grille.categorie) continue;
    if (grille.categorie !== 'larve') continue;
    if (Object.prototype.hasOwnProperty.call(stades, row.stade)) {
      stades[row.stade] = row.effectif;
    }
  }
  return stades;
}

function phasesFromCaptures(grille: GrilleKey, allCaptures: CaptureRow[]): Record<string, number> {
  const category = grille.categorie as 'imago' | 'larve';
  const phasesList = PHASES_CONFIG[grille.espece][category];
  const phases = getInitialPhases(phasesList);
  for (const row of allCaptures) {
    if (row.espece !== grille.espece || row.categorie !== grille.categorie) continue;
    const phase = row.phase;
    if (!phase || !Object.prototype.hasOwnProperty.call(phases, phase)) continue;
    phases[phase] += row.effectif;
  }
  return phases;
}

function buildGrilleData(grille: GrilleKey, allCaptures: CaptureRow[]) {
  const currentSexe: Sexe = grille.categorie === 'imago' ? 'F' : 'F';
  const stadesDataF = grille.categorie === 'imago' ? stadesFemellesFromCaptures(grille, allCaptures) : {};
  const stadesDataM = grille.categorie === 'imago' ? stadesMalesFromCaptures(grille, allCaptures) : {};
  const stadesData = grille.categorie === 'larve' ? stadesLarvesFromCaptures(grille, allCaptures) : {};
  const phasesData = phasesFromCaptures(grille, allCaptures);
  return {
    currentSexe,
    currentStade: stadesFor(grille.espece, grille.categorie, grille.categorie === 'imago' ? currentSexe : 'F')[0] ?? null,
    currentPhenotype: 'transiens' as Phenotype,
    counts: countsForGrille(grille, allCaptures),
    stadesData,
    stadesDataF,
    stadesDataM,
    phasesData,
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
    const data = buildGrilleData(grille, allCaptures);
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
    const data = buildGrilleData(grille, allCaptures);
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
    const grille = get().grilleOrder[get().currentGrilleIndex];
    if (!grille) return;
    if (grille.categorie !== 'imago') return;
    const currentStade = remapStadeForSexeChange(get().currentStade, sexe);
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