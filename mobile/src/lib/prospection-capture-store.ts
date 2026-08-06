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

// ==========================================
// CONFIGURATION IMPORTÉE DU COMPOSANT
// ==========================================
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
};

const PHASES_CONFIG = {
  LMC: {
    imago: {
      F: ['solitaire', 'transiens', 'solitario_transiens', 'gregaire'],
      M: ['solitaire', 'transiens', 'solitario_transiens', 'gregaire'],
    },
    larve: {
      F: ['solitaire', 'transiens', 'solitario_transiens', 'gregaire'],
      M: ['solitaire', 'transiens', 'solitario_transiens', 'gregaire'],
    },
  },
  NSE: {
    imago: {
      F: ['solitaire', 'transiens', 'solitario_transiens', 'gregaire'],
      M: ['solitaire', 'transiens', 'gregaire'],
    },
    larve: {
      F: ['solitaire', 'transiens', 'gregaire'],
      M: ['solitaire', 'transiens', 'gregaire'],
    },
  },
};

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
    counts[captureKey(row.sexe as Sexe | null, row.phase as Phenotype, row.stade)] = row.effectif;
  }
  return counts;
}

export function countsToRows(espece: Espece, categorie: Categorie, counts: CaptureCounts): CaptureRow[] {
  const rows: CaptureRow[] = [];
  for (const [key, effectif] of Object.entries(counts)) {
    if (effectif <= 0) continue;
    const parts = key.split('|');
    const [sexe, phenotype, stade] = parts.length === 3 ? (parts as [Sexe, Phenotype, string]) : [null, parts[0] as Phenotype, parts[1]];
    rows.push({ espece, categorie, sexe: sexe ?? null, phase: phenotype, stade, effectif });
  }
  return rows;
}

// ==========================================
// FONCTIONS D'INITIALISATION DES STADES/PHASES
// ==========================================
function getInitialStades(stadesList: string[]): Record<string, number> {
  const newStades: Record<string, number> = {};
  for (const stade of stadesList) {
    newStades[stade] = 0;
  }
  return newStades;
}

function getInitialPhases(phasesList: string[]): Record<string, number> {
  const newPhases: Record<string, number> = {};
  for (const phase of phasesList) {
    newPhases[phase] = 0;
  }
  return newPhases;
}

// ==========================================
// INTERFACE DU STORE
// ==========================================
interface CaptureLoopState {
  grilleOrder: GrilleKey[];
  currentGrilleIndex: number;
  completedGrilleKeys: string[];
  sexe: Sexe | null;
  currentStade: string | null;
  currentPhenotype: Phenotype | null;
  counts: CaptureCounts;
  // NOUVEAUX CHAMPS POUR STADES/PHASES
  stadesData: Record<string, number>;
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
  reset: () => void;
  // NOUVELLES FONCTIONS
  updateStade: (stade: string, value: number) => void;
  updatePhase: (phase: string, value: number) => void;
  incrementStade: (stade: string) => void;
  decrementStade: (stade: string) => void;
  incrementPhase: (phase: string) => void;
  decrementPhase: (phase: string) => void;
}

function firstIncompleteIndex(order: GrilleKey[], completed: string[]): number {
  const index = order.findIndex((g) => !completed.includes(grilleKeyToString(g)));
  return index === -1 ? Math.max(0, order.length - 1) : index;
}

function countsForGrille(grille: GrilleKey, allCaptures: CaptureRow[]): CaptureCounts {
  return rowsToCounts(allCaptures.filter((row) => row.espece === grille.espece && row.categorie === grille.categorie));
}

// ==========================================
// INITIALISATION DES DONNÉES STADES/PHASES
// ==========================================
function initStadesPhases(grille: GrilleKey, sexe: Sexe): { stades: Record<string, number>; phases: Record<string, number> } {
  const category = grille.categorie as 'imago' | 'larve';
  const sexeKey = grille.categorie === 'imago' ? sexe : 'F';
  
  const stadesList = grille.categorie === 'imago'
    ? STADES_CONFIG.imago[grille.espece]?.[sexe] || []
    : STADES_CONFIG.larve[grille.espece] || [];
  
  const phasesList = PHASES_CONFIG[grille.espece]?.[category]?.[sexeKey] || [];
  
  return {
    stades: getInitialStades(stadesList),
    phases: getInitialPhases(phasesList),
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
  phasesData: {},
  currentSexe: 'F',

  initGrilles: (order, completed, allCaptures) => {
    const index = firstIncompleteIndex(order, completed);
    const grille = order[index];
    const sexe = grille?.categorie === 'imago' ? 'F' : null;
    const stadesPhases = grille ? initStadesPhases(grille, 'F') : { stades: {}, phases: {} };
    
    set({
      grilleOrder: order,
      completedGrilleKeys: completed,
      currentGrilleIndex: index,
      sexe: sexe,
      currentSexe: 'F',
      currentPhenotype: 'transiens',
      currentStade: grille ? stadesFor(grille.espece, grille.categorie, 'F')[0] : null,
      counts: grille ? countsForGrille(grille, allCaptures) : {},
      stadesData: stadesPhases.stades,
      phasesData: stadesPhases.phases,
    });
  },

  goToGrille: (index, allCaptures) => {
    const grille = get().grilleOrder[index];
    if (!grille) return;
    const sexe = grille.categorie === 'imago' ? 'F' : null;
    const stadesPhases = initStadesPhases(grille, 'F');
    
    set({
      currentGrilleIndex: index,
      sexe,
      currentSexe: 'F',
      currentPhenotype: 'transiens',
      currentStade: stadesFor(grille.espece, grille.categorie, sexe)[0],
      counts: countsForGrille(grille, allCaptures),
      stadesData: stadesPhases.stades,
      phasesData: stadesPhases.phases,
    });
  },

  markCurrentGrilleCompleted: () => {
    const grille = get().grilleOrder[get().currentGrilleIndex];
    if (!grille) return;
    const key = grilleKeyToString(grille);
    set((state) => ({
      completedGrilleKeys: state.completedGrilleKeys.includes(key)
        ? state.completedGrilleKeys
        : [...state.completedGrilleKeys, key],
    }));
  },

  setSexe: (sexe) => {
    const grille = get().grilleOrder[get().currentGrilleIndex];
    if (!grille) return;
    
    // Mettre à jour sexe et stades/phases
    const stadesPhases = initStadesPhases(grille, sexe);
    
    set((state) => ({
      sexe,
      currentSexe: sexe,
      currentStade: remapStadeForSexeChange(state.currentStade, sexe),
      stadesData: stadesPhases.stades,
      phasesData: stadesPhases.phases,
    }));
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

  // ==========================================
  // NOUVELLES FONCTIONS POUR STADES/PHASES
  // ==========================================
  updateStade: (stade: string, value: number) => {
    set((state) => ({
      stadesData: { ...state.stadesData, [stade]: Math.max(0, value) },
    }));
  },

  updatePhase: (phase: string, value: number) => {
    set((state) => ({
      phasesData: { ...state.phasesData, [phase]: Math.max(0, value) },
    }));
  },

  incrementStade: (stade: string) => {
    set((state) => ({
      stadesData: { ...state.stadesData, [stade]: (state.stadesData[stade] || 0) + 1 },
    }));
  },

  decrementStade: (stade: string) => {
    set((state) => ({
      stadesData: { ...state.stadesData, [stade]: Math.max(0, (state.stadesData[stade] || 0) - 1) },
    }));
  },

  incrementPhase: (phase: string) => {
    set((state) => ({
      phasesData: { ...state.phasesData, [phase]: (state.phasesData[phase] || 0) + 1 },
    }));
  },

  decrementPhase: (phase: string) => {
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
      phasesData: {},
      currentSexe: 'F',
    });
  },
}));