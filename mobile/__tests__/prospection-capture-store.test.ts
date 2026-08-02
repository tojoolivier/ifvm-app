import {
  captureKey,
  countsToRows,
  dominantPhenotype,
  rowsToCounts,
  totalBySexe,
  totalCaptures,
  useProspectionCaptureStore,
} from '../src/lib/prospection-capture-store';
import { CaptureRow } from '../src/lib/prospection-repository';

describe('captureKey', () => {
  it('inclut le sexe quand fourni', () => {
    expect(captureKey('F', 'transiens', 'A1')).toBe('F|transiens|A1');
  });

  it('omet le sexe quand null (NSE / larves)', () => {
    expect(captureKey(null, 'transiens', 'L1')).toBe('transiens|L1');
  });
});

describe('totalCaptures / totalBySexe / dominantPhenotype', () => {
  const counts = {
    'F|transiens|A1': 5,
    'F|gregaire|A2': 3,
    'M|transiens|A1': 2,
  };

  it('totalise toutes les valeurs', () => {
    expect(totalCaptures(counts)).toBe(10);
  });

  it('filtre par sexe', () => {
    expect(totalBySexe(counts, 'F')).toBe(8);
    expect(totalBySexe(counts, 'M')).toBe(2);
  });

  it('trouve le phénotype dominant tous sexes confondus', () => {
    expect(dominantPhenotype(counts)).toBe('transiens');
  });

  it("renvoie null si aucun comptage", () => {
    expect(dominantPhenotype({})).toBeNull();
  });
});

describe('rowsToCounts / countsToRows', () => {
  it('round-trip des lignes de capture LMC imago (avec sexe)', () => {
    const rows: CaptureRow[] = [{ espece: 'LMC', categorie: 'imago', sexe: 'F', phase: 'transiens', stade: 'A1', effectif: 4 }];
    const counts = rowsToCounts(rows);
    expect(counts).toEqual({ 'F|transiens|A1': 4 });
    expect(countsToRows('LMC', 'imago', counts)).toEqual(rows);
  });

  it('round-trip des lignes NSE (sans sexe)', () => {
    const rows: CaptureRow[] = [{ espece: 'NSE', categorie: 'imago', sexe: null, phase: 'gregaire', stade: 'A5', effectif: 2 }];
    const counts = rowsToCounts(rows);
    expect(counts).toEqual({ 'gregaire|A5': 2 });
    expect(countsToRows('NSE', 'imago', counts)).toEqual(rows);
  });

  it('omet les comptages à 0', () => {
    expect(countsToRows('LMC', 'imago', { 'F|transiens|A1': 0 })).toEqual([]);
  });
});

describe('useProspectionCaptureStore', () => {
  beforeEach(() => {
    useProspectionCaptureStore.getState().reset();
  });

  it('initGrilles positionne le sexe F et le premier stade pour LMC imago', () => {
    useProspectionCaptureStore.getState().initGrilles([{ espece: 'LMC', categorie: 'imago' }], [], []);
    const state = useProspectionCaptureStore.getState();
    expect(state.currentGrilleIndex).toBe(0);
    expect(state.sexe).toBe('F');
    expect(state.currentStade).toBe('A1');
  });

  it('initGrilles reprend sur la première grille non complétée', () => {
    const order = [
      { espece: 'LMC' as const, categorie: 'imago' as const },
      { espece: 'LMC' as const, categorie: 'larve' as const },
    ];
    useProspectionCaptureStore.getState().initGrilles(order, ['LMC:imago'], []);
    expect(useProspectionCaptureStore.getState().currentGrilleIndex).toBe(1);
  });

  it('increment respecte le plafond de captures par espèce', () => {
    useProspectionCaptureStore.getState().initGrilles([{ espece: 'NSE', categorie: 'imago' }], [], []);
    useProspectionCaptureStore.setState({ counts: { 'transiens|A1': 30 } });
    useProspectionCaptureStore.getState().increment();
    expect(useProspectionCaptureStore.getState().counts['transiens|A1']).toBe(30);
  });

  it('decrement ne descend jamais sous 0', () => {
    useProspectionCaptureStore.getState().initGrilles([{ espece: 'LMC', categorie: 'imago' }], [], []);
    useProspectionCaptureStore.getState().decrement();
    expect(totalCaptures(useProspectionCaptureStore.getState().counts)).toBe(0);
  });

  it('setSexe remappe le stade courant', () => {
    useProspectionCaptureStore.getState().initGrilles([{ espece: 'LMC', categorie: 'imago' }], [], []);
    useProspectionCaptureStore.getState().setStade('A3¼');
    useProspectionCaptureStore.getState().setSexe('M');
    expect(useProspectionCaptureStore.getState().currentStade).toBe('A1');
  });

  it('markCurrentGrilleCompleted ajoute la clé une seule fois', () => {
    useProspectionCaptureStore.getState().initGrilles([{ espece: 'LMC', categorie: 'imago' }], [], []);
    useProspectionCaptureStore.getState().markCurrentGrilleCompleted();
    useProspectionCaptureStore.getState().markCurrentGrilleCompleted();
    expect(useProspectionCaptureStore.getState().completedGrilleKeys).toEqual(['LMC:imago']);
  });
});
