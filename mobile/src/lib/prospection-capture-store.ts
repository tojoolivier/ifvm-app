import { create } from 'zustand';
import {
  CAPTURES_MAX,
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

interface CaptureLoopState {
  grilleOrder: GrilleKey[];
  currentGrilleIndex: number;
  completedGrilleKeys: string[];
  sexe: Sexe | null;
  currentStade: string | null;
  currentPhenotype: Phenotype | null;
  counts: CaptureCounts;

  initGrilles: (order: GrilleKey[], completed: string[], allCaptures: CaptureRow[]) => void;
  goToGrille: (index: number, allCaptures: CaptureRow[]) => void;
  markCurrentGrilleCompleted: () => void;
  setSexe: (sexe: Sexe) => void;
  setStade: (stade: string) => void;
  setPhenotype: (phenotype: Phenotype) => void;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
}

function firstIncompleteIndex(order: GrilleKey[], completed: string[]): number {
  const index = order.findIndex((g) => !completed.includes(grilleKeyToString(g)));
  return index === -1 ? Math.max(0, order.length - 1) : index;
}

function countsForGrille(grille: GrilleKey, allCaptures: CaptureRow[]): CaptureCounts {
  return rowsToCounts(allCaptures.filter((row) => row.espece === grille.espece && row.categorie === grille.categorie));
}

export const useProspectionCaptureStore = create<CaptureLoopState>((set, get) => ({
  grilleOrder: [],
  currentGrilleIndex: 0,
  completedGrilleKeys: [],
  sexe: null,
  currentStade: null,
  currentPhenotype: null,
  counts: {},

  initGrilles: (order, completed, allCaptures) => {
    const index = firstIncompleteIndex(order, completed);
    const grille = order[index];
    set({
      grilleOrder: order,
      completedGrilleKeys: completed,
      currentGrilleIndex: index,
      sexe: grille?.espece === 'LMC' && grille.categorie === 'imago' ? 'F' : null,
      currentPhenotype: 'transiens',
      currentStade: grille ? stadesFor(grille.espece, grille.categorie, 'F')[0] : null,
      counts: grille ? countsForGrille(grille, allCaptures) : {},
    });
  },

  goToGrille: (index, allCaptures) => {
    const grille = get().grilleOrder[index];
    if (!grille) return;
    const sexe = grille.espece === 'LMC' && grille.categorie === 'imago' ? 'F' : null;
    set({
      currentGrilleIndex: index,
      sexe,
      currentPhenotype: 'transiens',
      currentStade: stadesFor(grille.espece, grille.categorie, sexe)[0],
      counts: countsForGrille(grille, allCaptures),
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
    set((state) => ({ sexe, currentStade: remapStadeForSexeChange(state.currentStade, sexe) }));
  },

  setStade: (stade) => set({ currentStade: stade }),
  setPhenotype: (phenotype) => set({ currentPhenotype: phenotype }),

  increment: () => {
    const state = get();
    const grille = state.grilleOrder[state.currentGrilleIndex];
    if (!grille || !state.currentStade || !state.currentPhenotype) return;
    if (totalCaptures(state.counts) >= CAPTURES_MAX[grille.espece]) return;
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

  reset: () => {
    set({
      grilleOrder: [],
      currentGrilleIndex: 0,
      completedGrilleKeys: [],
      sexe: null,
      currentStade: null,
      currentPhenotype: null,
      counts: {},
    });
  },
}));
