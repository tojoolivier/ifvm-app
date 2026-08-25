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

/** Vocabulaire tel que le référentiel synchronisé le livre — le store n'en énumère aucun. */
const STADES_REFERENTIEL = {
  'LMC:imago': { F: ['A1', 'A2', 'A3', 'A3-1/4', 'A3-1/2', 'A3-3/4', 'A3-4/4', 'A4', 'A5'], M: ['A1', 'A234', 'A5'], larve: [] },
  'NSE:imago': { F: ['A1', 'A2', 'A3', 'A3-1/4', 'A3-1/2', 'A3-3/4', 'A3-4/4', 'A4', 'A5'], M: ['A1', 'A234', 'A5'], larve: [] },
  'LMC:larve': { F: [], M: [], larve: ['L1', 'L2', 'L3', 'L4', 'L5'] },
  'NSE:larve': { F: [], M: [], larve: ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'] },
};

describe('useProspectionCaptureStore', () => {
  beforeEach(() => {
    useProspectionCaptureStore.getState().reset();
    useProspectionCaptureStore.getState().setStadesParGrille(STADES_REFERENTIEL);
  });

  it('initGrilles positionne le sexe F et le premier stade pour LMC imago', () => {
    useProspectionCaptureStore.getState().initGrilles([{ espece: 'LMC', categorie: 'imago' }], [], []);
    const state = useProspectionCaptureStore.getState();
    expect(state.currentGrilleIndex).toBe(0);
    expect(state.sexe).toBe('F');
    expect(state.currentStade).toBe('A1');
  });

  it('initGrilles positionne aussi le sexe F pour NSE imago (même bascule que LMC)', () => {
    useProspectionCaptureStore.getState().initGrilles([{ espece: 'NSE', categorie: 'imago' }], [], []);
    const state = useProspectionCaptureStore.getState();
    expect(state.sexe).toBe('F');
    expect(state.currentStade).toBe('A1');
  });

  it('initGrilles ne positionne pas de sexe pour les larves (LMC ou NSE)', () => {
    useProspectionCaptureStore.getState().initGrilles([{ espece: 'NSE', categorie: 'larve' }], [], []);
    expect(useProspectionCaptureStore.getState().sexe).toBeNull();
  });

  it('initGrilles reprend sur la première grille non complétée', () => {
    const order = [
      { espece: 'LMC' as const, categorie: 'imago' as const },
      { espece: 'LMC' as const, categorie: 'larve' as const },
    ];
    useProspectionCaptureStore.getState().initGrilles(order, ['LMC:imago'], []);
    expect(useProspectionCaptureStore.getState().currentGrilleIndex).toBe(1);
  });

  it('increment respecte le plafond de captures par espèce+catégorie (NSE imago : 30)', () => {
    useProspectionCaptureStore.getState().initGrilles([{ espece: 'NSE', categorie: 'imago' }], [], []);
    useProspectionCaptureStore.setState({ counts: { 'F|transiens|A1': 30 } });
    useProspectionCaptureStore.getState().increment();
    expect(useProspectionCaptureStore.getState().counts['F|transiens|A1']).toBe(30);
  });

  it('increment respecte le plafond spécifique aux larves (NSE larve : 75, distinct de NSE imago 30)', () => {
    useProspectionCaptureStore.getState().initGrilles([{ espece: 'NSE', categorie: 'larve' }], [], []);
    useProspectionCaptureStore.setState({ counts: { 'transiens|L1': 74 } });
    useProspectionCaptureStore.getState().increment();
    expect(totalCaptures(useProspectionCaptureStore.getState().counts)).toBe(75);
    useProspectionCaptureStore.getState().increment();
    expect(totalCaptures(useProspectionCaptureStore.getState().counts)).toBe(75);
  });

  it('decrement ne descend jamais sous 0', () => {
    useProspectionCaptureStore.getState().initGrilles([{ espece: 'LMC', categorie: 'imago' }], [], []);
    useProspectionCaptureStore.getState().decrement();
    expect(totalCaptures(useProspectionCaptureStore.getState().counts)).toBe(0);
  });

  it('setSexe remappe le stade courant', () => {
    useProspectionCaptureStore.getState().initGrilles([{ espece: 'LMC', categorie: 'imago' }], [], []);
    useProspectionCaptureStore.getState().setStade('A3-1/4');
    useProspectionCaptureStore.getState().setSexe('M');
    expect(useProspectionCaptureStore.getState().currentStade).toBe('A1');
  });

  it('cumule les effectifs d’un stade réparti sur plusieurs phases (#201)', () => {
    // L'enregistrement répartit un stade entre les phases saisies : 10 larves L1
    // deviennent deux lignes (5 solitaires + 5 grégaires). À la réouverture, le stade
    // doit valoir 10 — écraser au lieu de cumuler perdait la moitié de la saisie, avec
    // des phases à 10 et des stades à 5.
    const capturesReparties: CaptureRow[] = [
      { espece: 'LMC', categorie: 'larve', sexe: null, phase: 'solitaire', stade: 'L1', effectif: 5 },
      { espece: 'LMC', categorie: 'larve', sexe: null, phase: 'gregaire', stade: 'L1', effectif: 5 },
    ];

    useProspectionCaptureStore
      .getState()
      .initGrilles([{ espece: 'LMC', categorie: 'larve' }], [], capturesReparties);

    const state = useProspectionCaptureStore.getState();
    expect(state.stadesData['L1']).toBe(10);
    // Les deux totaux doivent concorder, c'est la règle de saisie.
    const totalPhases = Object.values(state.phasesData).reduce((s, n) => s + n, 0);
    expect(totalPhases).toBe(10);
  });

  it('cumule aussi côté imagos, par sexe (#201)', () => {
    const capturesReparties: CaptureRow[] = [
      { espece: 'LMC', categorie: 'imago', sexe: 'F', phase: 'solitaire', stade: 'A1', effectif: 3 },
      { espece: 'LMC', categorie: 'imago', sexe: 'F', phase: 'gregaire', stade: 'A1', effectif: 4 },
      { espece: 'LMC', categorie: 'imago', sexe: 'M', phase: 'gregaire', stade: 'A1', effectif: 2 },
    ];

    useProspectionCaptureStore
      .getState()
      .initGrilles([{ espece: 'LMC', categorie: 'imago' }], [], capturesReparties);

    const state = useProspectionCaptureStore.getState();
    expect(state.stadesDataF['A1']).toBe(7);
    expect(state.stadesDataM['A1']).toBe(2);
  });

  it('markCurrentGrilleCompleted ajoute la clé une seule fois', () => {
    useProspectionCaptureStore.getState().initGrilles([{ espece: 'LMC', categorie: 'imago' }], [], []);
    useProspectionCaptureStore.getState().markCurrentGrilleCompleted();
    useProspectionCaptureStore.getState().markCurrentGrilleCompleted();
    expect(useProspectionCaptureStore.getState().completedGrilleKeys).toEqual(['LMC:imago']);
  });

  describe('cohérence des stades ♀/♂ au basculement (#99)', () => {
    beforeEach(() => {
      useProspectionCaptureStore.getState().initGrilles([{ espece: 'LMC', categorie: 'imago' }], [], []);
    });

    it('saisir un stade femelle puis basculer sur mâles ne perd pas la valeur femelle', () => {
      useProspectionCaptureStore.getState().updateStadeBySex('F', 'A1', 4);
      useProspectionCaptureStore.getState().setSexe('M');
      expect(useProspectionCaptureStore.getState().stadesDataF['A1']).toBe(4);
    });

    it('saisir un stade mâle puis revenir sur femelles ne perd pas la valeur mâle', () => {
      useProspectionCaptureStore.getState().setSexe('M');
      useProspectionCaptureStore.getState().updateStadeBySex('M', 'A1', 3);
      useProspectionCaptureStore.getState().setSexe('F');
      expect(useProspectionCaptureStore.getState().stadesDataM['A1']).toBe(3);
    });

    it('aller-retour F -> M -> F conserve les deux valeurs simultanément', () => {
      useProspectionCaptureStore.getState().updateStadeBySex('F', 'A2', 5);
      useProspectionCaptureStore.getState().setSexe('M');
      useProspectionCaptureStore.getState().updateStadeBySex('M', 'A1', 2);
      useProspectionCaptureStore.getState().setSexe('F');
      const state = useProspectionCaptureStore.getState();
      expect(state.stadesDataF['A2']).toBe(5);
      expect(state.stadesDataM['A1']).toBe(2);
    });

    it('updateStadeBySex ne modifie jamais les clés de stades du sexe opposé', () => {
      useProspectionCaptureStore.getState().updateStadeBySex('F', 'A1', 1);
      const stadesMAvant = useProspectionCaptureStore.getState().stadesDataM;
      useProspectionCaptureStore.getState().updateStadeBySex('F', 'A2', 7);
      expect(useProspectionCaptureStore.getState().stadesDataM).toEqual(stadesMAvant);
    });
  });
});
