import { updateProspectionEspeces, DraftProspection } from '../src/lib/prospection-repository';

import {
  countGrilles,
  hasSelection,
  buildGrilles,
  parseEspeceSelection,
  saveEspeceSelection,
  EMPTY_ESPECE_SELECTION,
} from '../src/lib/prospection-especes';

jest.mock('../src/lib/prospection-repository', () => ({
  updateProspectionEspeces: jest.fn(),
}));

const mockUpdate = jest.mocked(updateProspectionEspeces);

const STORED_ROW: DraftProspection = {
  id: '11111111-1111-1111-1111-111111111111',
  type_prospection: 'intensive',
  campagne_id: '22222222-2222-2222-2222-222222222222',
  prospecteur_id: '33333333-3333-3333-3333-333333333333',
  station_id: null,
  region: null,
  district: null,
  commune: null,
  za: null,
  pa_code: null,
  n_releve: null,
  n_fiche: 'FI-20260711-111111',
  n_message: null,
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
  degats_cultures_pourcent: null,
  verdissement_pourcent: null,
  hauteur_herbe_cm: null,
  derniere_pluie: null,
  intensite_pluie: null,
  vegetation: null,
  sol: null,
  ennemis_naturels: null,
  observations: null,
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
    expect(countGrilles({ lmcImago: true, lmcLarve: false, nseImago: false, nseLarve: false })).toBe(1);
    expect(countGrilles({ lmcImago: true, lmcLarve: true, nseImago: false, nseLarve: false })).toBe(2);
    expect(countGrilles({ lmcImago: true, lmcLarve: true, nseImago: true, nseLarve: false })).toBe(3);
    expect(countGrilles({ lmcImago: true, lmcLarve: true, nseImago: true, nseLarve: true })).toBe(4);
    expect(hasSelection({ lmcImago: false, lmcLarve: true, nseImago: false, nseLarve: false })).toBe(true);
  });
});

describe('buildGrilles', () => {
  it('returns one grille per active toggle, LMC before NSE, imago before larve', () => {
    expect(buildGrilles({ lmcImago: true, lmcLarve: true, nseImago: true, nseLarve: true })).toEqual([
      { espece: 'LMC', categorie: 'imago' },
      { espece: 'LMC', categorie: 'larve' },
      { espece: 'NSE', categorie: 'imago' },
      { espece: 'NSE', categorie: 'larve' },
    ]);
  });

  it('returns an empty list when nothing is selected', () => {
    expect(buildGrilles(EMPTY_ESPECE_SELECTION)).toEqual([]);
  });

  it('includes only the NSE larve grille when it is the sole toggle active', () => {
    expect(buildGrilles({ lmcImago: false, lmcLarve: false, nseImago: false, nseLarve: true })).toEqual([
      { espece: 'NSE', categorie: 'larve' },
    ]);
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
    const stored = JSON.stringify({ lmcImago: true, lmcLarve: false, nseImago: true, nseLarve: true });
    expect(parseEspeceSelection(stored)).toEqual({
      lmcImago: true,
      lmcLarve: false,
      nseImago: true,
      nseLarve: true,
    });
  });
});

describe('saveEspeceSelection', () => {
  it('persists the selection via the repository as JSON', async () => {
    mockUpdate.mockResolvedValueOnce(STORED_ROW);
    const selection = { lmcImago: true, lmcLarve: false, nseImago: true, nseLarve: false };

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
