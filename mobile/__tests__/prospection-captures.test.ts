import { startCaptureTimer, saveProspectionCaptures, DraftProspection } from '../src/lib/prospection-repository';

jest.mock('../src/lib/prospection-repository', () => ({
  startCaptureTimer: jest.fn(),
  saveProspectionCaptures: jest.fn(),
}));

import {
  CAPTURES_MAX,
  CHRONO_MAX_SECONDS,
  FEMALE_STADES,
  LMC_LARVE_CAPTURES_MAX,
  LMC_LARVE_STADES,
  MALE_STADES,
  NSE_CAPTURES_MAX,
  NSE_LARVE_CAPTURES_MAX,
  NSE_LARVE_STADES,
  NSE_PHENOTYPES,
  NSE_STADES,
  PHENOTYPES,
  buildCaptureRows,
  buildLarveCaptureRows,
  buildNseCaptureRows,
  chronoSeconds,
  decrementCapture,
  decrementLarveCapture,
  decrementNseCapture,
  dominantLarvePhenotype,
  dominantNsePhenotype,
  dominantPhenotype,
  ensureCaptureTimerStarted,
  formatChrono,
  incrementCapture,
  incrementLarveCapture,
  incrementNseCapture,
  larveCaptureKey,
  nseCaptureKey,
  parseCaptureRows,
  parseLarveCaptureRows,
  parseNseCaptureRows,
  saveCaptureCounts,
  saveLarveCaptureCounts,
  saveNseCaptureCounts,
  stadeForSexeSwitch,
  stadesForSexe,
  totalBySexe,
  totalCaptures,
} from '../src/lib/prospection-captures';

const mockStartTimer = jest.mocked(startCaptureTimer);
const mockSaveCaptures = jest.mocked(saveProspectionCaptures);

const STORED_ROW: DraftProspection = {
  id: '11111111-1111-1111-1111-111111111111',
  type_prospection: 'intensive',
  campagne_id: '22222222-2222-2222-2222-222222222222',
  prospecteur_id: '33333333-3333-3333-3333-333333333333',
  station_id: null,
  n_fiche: 'FI-20260711-111111',
  especes: null,
  capture_started_at: null,
  grilles_completees: null,
  date_prospection: '2026-07-11',
  latitude: -18.9,
  longitude: 47.5,
  altitude: 1280,
  surf_station: 10,
  surf_prospectee: 8,
  surf_infestee: 2,
  degats_cultures: null,
  vegetation: null,
  sol: null,
  statut: 'brouillon',
  statut_sync: 'local',
  created_at: '2026-07-11T00:00:00.000Z',
  updated_at: '2026-07-11T00:00:00.000Z',
};

beforeEach(() => {
  mockStartTimer.mockReset();
  mockSaveCaptures.mockReset();
});

describe('stadesForSexe / stadeForSexeSwitch', () => {
  it('returns the detailed set of stades for females', () => {
    expect(stadesForSexe('F')).toEqual(FEMALE_STADES);
  });

  it('returns the simplified set of stades for males', () => {
    expect(stadesForSexe('M')).toEqual(MALE_STADES);
  });

  it('keeps the current stade when it exists in the new set', () => {
    expect(stadeForSexeSwitch('A1', 'M')).toBe('A1');
  });

  it('falls back to the first stade of the new set when the current one does not exist', () => {
    expect(stadeForSexeSwitch('A3¼', 'M')).toBe(MALE_STADES[0]);
  });
});

describe('increment / decrement', () => {
  it('increments the count for a given combination', () => {
    const counts = incrementCapture({}, 'F', 'solitaire', 'A1');
    expect(counts).toEqual({ 'F|solitaire|A1': 1 });
  });

  it('decrements without going below zero', () => {
    const empty = decrementCapture({}, 'F', 'solitaire', 'A1');
    expect(empty).toEqual({});
  });

  it('decrements an existing count', () => {
    const counts = decrementCapture({ 'F|solitaire|A1': 2 }, 'F', 'solitaire', 'A1');
    expect(counts).toEqual({ 'F|solitaire|A1': 1 });
  });

  it('caps the total at CAPTURES_MAX', () => {
    const counts = { 'F|solitaire|A1': CAPTURES_MAX };
    expect(totalCaptures(counts)).toBe(CAPTURES_MAX);
    expect(incrementCapture(counts, 'F', 'gregaire', 'A2')).toBe(counts);
  });
});

describe('totalBySexe / totalCaptures', () => {
  it('sums counts across all combinations', () => {
    const counts = { 'F|solitaire|A1': 2, 'M|gregaire|A5': 3 };
    expect(totalCaptures(counts)).toBe(5);
  });

  it('sums only the given sexe', () => {
    const counts = { 'F|solitaire|A1': 2, 'F|gregaire|A2': 1, 'M|gregaire|A5': 3 };
    expect(totalBySexe(counts, 'F')).toBe(3);
    expect(totalBySexe(counts, 'M')).toBe(3);
  });
});

describe('dominantPhenotype', () => {
  it('returns null when there are no captures', () => {
    expect(dominantPhenotype({})).toBeNull();
  });

  it('returns the phenotype with the highest total across sexes and stades', () => {
    const counts = {
      'F|solitaire|A1': 2,
      'M|solitaire|A1': 1,
      'F|gregaire|A5': 4,
    };
    expect(dominantPhenotype(counts)).toBe('gregaire');
  });
});

describe('chronoSeconds / formatChrono', () => {
  it('returns 0 when no timer has started', () => {
    expect(chronoSeconds(null)).toBe(0);
  });

  it('computes elapsed seconds from the start timestamp', () => {
    const start = new Date('2026-07-11T10:00:00.000Z');
    const now = new Date('2026-07-11T10:02:30.000Z');
    expect(chronoSeconds(start.toISOString(), now)).toBe(150);
  });

  it('caps elapsed seconds at CHRONO_MAX_SECONDS', () => {
    const start = new Date('2026-07-11T10:00:00.000Z');
    const now = new Date('2026-07-11T11:00:00.000Z');
    expect(chronoSeconds(start.toISOString(), now)).toBe(CHRONO_MAX_SECONDS);
  });

  it('formats seconds as mm:ss', () => {
    expect(formatChrono(0)).toBe('00:00');
    expect(formatChrono(65)).toBe('01:05');
    expect(formatChrono(CHRONO_MAX_SECONDS)).toBe('30:00');
  });
});

describe('ensureCaptureTimerStarted', () => {
  it('starts the timer when none is running yet', async () => {
    const started = { ...STORED_ROW, capture_started_at: '2026-07-11T10:00:00.000Z' };
    mockStartTimer.mockResolvedValueOnce(started);

    const result = await ensureCaptureTimerStarted(STORED_ROW);

    expect(mockStartTimer).toHaveBeenCalledWith(STORED_ROW.id);
    expect(result).toEqual(started);
  });

  it('does not restart an already running timer', async () => {
    const running = { ...STORED_ROW, capture_started_at: '2026-07-11T09:00:00.000Z' };

    const result = await ensureCaptureTimerStarted(running);

    expect(mockStartTimer).not.toHaveBeenCalled();
    expect(result).toEqual(running);
  });
});

describe('buildCaptureRows / parseCaptureRows', () => {
  it('builds one row per non-zero combination', () => {
    const rows = buildCaptureRows('LMC', 'imago', { 'F|solitaire|A1': 2, 'M|gregaire|A5': 0 });
    expect(rows).toEqual([{ espece: 'LMC', categorie: 'imago', sexe: 'F', phase: 'solitaire', stade: 'A1', effectif: 2 }]);
  });

  it('round-trips through rows back to counts', () => {
    const rows = buildCaptureRows('NSE', 'imago', { 'M|transiens|A234': 3 });
    expect(parseCaptureRows(rows)).toEqual({ 'M|transiens|A234': 3 });
  });
});

describe('saveCaptureCounts', () => {
  it('persists non-zero counts as capture rows via the repository', async () => {
    await saveCaptureCounts('prospection-1', 'LMC', 'imago', { 'F|solitaire|A1': 2 });

    expect(mockSaveCaptures).toHaveBeenCalledWith('prospection-1', 'LMC', 'imago', [
      { espece: 'LMC', categorie: 'imago', sexe: 'F', phase: 'solitaire', stade: 'A1', effectif: 2 },
    ]);
  });
});

describe('Nomadacris imagos (NSE) — pas de bascule sexe', () => {
  it('exposes the simplified phase set (A1/A234/A5) shared with LMC males', () => {
    expect(NSE_STADES).toEqual(MALE_STADES);
  });

  it('exposes 3 phénotypes, no Solitaro-trans', () => {
    expect(NSE_PHENOTYPES.map((p) => p.value)).toEqual(['solitaire', 'transiens', 'gregaire']);
  });

  it('increments and decrements without a sexe dimension', () => {
    const incremented = incrementNseCapture({}, 'transiens', 'A234');
    expect(incremented).toEqual({ [nseCaptureKey('transiens', 'A234')]: 1 });

    const decremented = decrementNseCapture(incremented, 'transiens', 'A234');
    expect(decremented).toEqual({ [nseCaptureKey('transiens', 'A234')]: 0 });
  });

  it('caps the total at NSE_CAPTURES_MAX, distinct from LMC', () => {
    expect(NSE_CAPTURES_MAX).not.toBe(CAPTURES_MAX);
    const counts = { [nseCaptureKey('gregaire', 'A5')]: NSE_CAPTURES_MAX };
    expect(incrementNseCapture(counts, 'solitaire', 'A1')).toBe(counts);
  });

  it('picks the dominant phénotype across stades', () => {
    const counts = {
      [nseCaptureKey('solitaire', 'A1')]: 2,
      [nseCaptureKey('gregaire', 'A5')]: 5,
      [nseCaptureKey('gregaire', 'A234')]: 1,
    };
    expect(dominantNsePhenotype(counts)).toBe('gregaire');
  });

  it('builds rows with sexe=null and round-trips back to counts', () => {
    const counts = { [nseCaptureKey('transiens', 'A1')]: 4 };
    const rows = buildNseCaptureRows(counts);
    expect(rows).toEqual([{ espece: 'NSE', categorie: 'imago', sexe: null, phase: 'transiens', stade: 'A1', effectif: 4 }]);
    expect(parseNseCaptureRows(rows)).toEqual(counts);
  });

  it('persists via saveProspectionCaptures with sexe=null', async () => {
    await saveNseCaptureCounts('prospection-1', { [nseCaptureKey('gregaire', 'A5')]: 1 });

    expect(mockSaveCaptures).toHaveBeenCalledWith('prospection-1', 'NSE', 'imago', [
      { espece: 'NSE', categorie: 'imago', sexe: null, phase: 'gregaire', stade: 'A5', effectif: 1 },
    ]);
  });
});

describe('Larves LMC (L1→L5) & NSE (L1→L7) — pas de bascule sexe', () => {
  it('exposes distinct stade sets per espèce', () => {
    expect(LMC_LARVE_STADES).toEqual(['L1', 'L2', 'L3', 'L4', 'L5']);
    expect(NSE_LARVE_STADES).toEqual(['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7']);
  });

  it('caps captures at a plafond distinct from the imago plafonds of each espèce', () => {
    expect(LMC_LARVE_CAPTURES_MAX).not.toBe(CAPTURES_MAX);
    expect(NSE_LARVE_CAPTURES_MAX).not.toBe(NSE_CAPTURES_MAX);

    const atMax = { [larveCaptureKey('solitaire', 'L1')]: LMC_LARVE_CAPTURES_MAX };
    expect(incrementLarveCapture(atMax, 'gregaire', 'L2', LMC_LARVE_CAPTURES_MAX)).toBe(atMax);
  });

  it('increments and decrements without a sexe dimension, reusing the 4 phénotypes for LMC larves', () => {
    const incremented = incrementLarveCapture({}, 'transiens', 'L3', LMC_LARVE_CAPTURES_MAX);
    expect(incremented).toEqual({ [larveCaptureKey('transiens', 'L3')]: 1 });

    const decremented = decrementLarveCapture(incremented, 'transiens', 'L3');
    expect(decremented).toEqual({ [larveCaptureKey('transiens', 'L3')]: 0 });

    expect(PHENOTYPES.map((p) => p.value)).toContain('solitaro_trans');
  });

  it('picks the dominant phénotype across stades', () => {
    const counts = {
      [larveCaptureKey('solitaire', 'L1')]: 1,
      [larveCaptureKey('gregaire', 'L4')]: 5,
      [larveCaptureKey('gregaire', 'L2')]: 2,
    };
    expect(dominantLarvePhenotype(counts)).toBe('gregaire');
  });

  it('builds rows with categorie=larve and sexe=null and round-trips back to counts', () => {
    const counts = { [larveCaptureKey('transiens', 'L2')]: 4 };
    const rows = buildLarveCaptureRows('LMC', counts);
    expect(rows).toEqual([
      { espece: 'LMC', categorie: 'larve', sexe: null, phase: 'transiens', stade: 'L2', effectif: 4 },
    ]);
    expect(parseLarveCaptureRows(rows)).toEqual(counts);
  });

  it('persists NSE larves via saveProspectionCaptures with categorie=larve and sexe=null', async () => {
    await saveLarveCaptureCounts('prospection-1', 'NSE', { [larveCaptureKey('gregaire', 'L7')]: 2 });

    expect(mockSaveCaptures).toHaveBeenCalledWith('prospection-1', 'NSE', 'larve', [
      { espece: 'NSE', categorie: 'larve', sexe: null, phase: 'gregaire', stade: 'L7', effectif: 2 },
    ]);
  });
});
