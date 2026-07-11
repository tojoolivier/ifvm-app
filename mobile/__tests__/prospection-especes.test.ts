import { updateProspectionEspeces, DraftProspection } from '../src/lib/prospection-repository';

jest.mock('../src/lib/prospection-repository', () => ({
  updateProspectionEspeces: jest.fn(),
}));

import {
  countGrilles,
  hasSelection,
  buildGrilles,
  parseEspeceSelection,
  saveEspeceSelection,
  EMPTY_ESPECE_SELECTION,
} from '../src/lib/prospection-especes';

const mockUpdate = jest.mocked(updateProspectionEspeces);

const STORED_ROW: DraftProspection = {
  id: '11111111-1111-1111-1111-111111111111',
  type_prospection: 'intensive',
  campagne_id: '22222222-2222-2222-2222-222222222222',
  prospecteur_id: '33333333-3333-3333-3333-333333333333',
  station_id: null,
  n_fiche: 'FI-20260711-111111',
  especes: null,
  capture_started_at: null,
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
  mockUpdate.mockReset();
});

describe('countGrilles / hasSelection', () => {
  it('counts zero for an empty selection', () => {
    expect(countGrilles(EMPTY_ESPECE_SELECTION)).toBe(0);
    expect(hasSelection(EMPTY_ESPECE_SELECTION)).toBe(false);
  });

  it('counts each active toggle independently', () => {
    expect(countGrilles({ lmcImago: true, lmcLarve: false, nseImago: false })).toBe(1);
    expect(countGrilles({ lmcImago: true, lmcLarve: true, nseImago: false })).toBe(2);
    expect(countGrilles({ lmcImago: true, lmcLarve: true, nseImago: true })).toBe(3);
    expect(hasSelection({ lmcImago: false, lmcLarve: true, nseImago: false })).toBe(true);
  });
});

describe('buildGrilles', () => {
  it('returns one grille per active toggle, LMC before NSE', () => {
    expect(buildGrilles({ lmcImago: true, lmcLarve: true, nseImago: true })).toEqual([
      { espece: 'LMC', categorie: 'imago' },
      { espece: 'LMC', categorie: 'larve' },
      { espece: 'NSE', categorie: 'imago' },
    ]);
  });

  it('returns an empty list when nothing is selected', () => {
    expect(buildGrilles(EMPTY_ESPECE_SELECTION)).toEqual([]);
  });
});

describe('parseEspeceSelection', () => {
  it('returns an empty selection for null input', () => {
    expect(parseEspeceSelection(null)).toEqual(EMPTY_ESPECE_SELECTION);
  });

  it('returns an empty selection for invalid JSON', () => {
    expect(parseEspeceSelection('{not json')).toEqual(EMPTY_ESPECE_SELECTION);
  });

  it('parses a stored selection back', () => {
    const stored = JSON.stringify({ lmcImago: true, lmcLarve: false, nseImago: true });
    expect(parseEspeceSelection(stored)).toEqual({ lmcImago: true, lmcLarve: false, nseImago: true });
  });
});

describe('saveEspeceSelection', () => {
  it('persists the selection via the repository as JSON', async () => {
    mockUpdate.mockResolvedValueOnce(STORED_ROW);
    const selection = { lmcImago: true, lmcLarve: false, nseImago: true };

    const result = await saveEspeceSelection(STORED_ROW.id, selection);

    expect(result).toEqual(STORED_ROW);
    expect(mockUpdate).toHaveBeenCalledWith(STORED_ROW.id, JSON.stringify(selection));
  });

  it('rejects an empty selection without touching the repository', async () => {
    await expect(saveEspeceSelection(STORED_ROW.id, EMPTY_ESPECE_SELECTION)).rejects.toThrow(
      'Au moins une espèce/stade doit être sélectionné'
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
