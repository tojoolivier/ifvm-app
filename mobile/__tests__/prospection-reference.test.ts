import { updateProspectionReference, DraftProspection } from '../src/lib/prospection-repository';

jest.mock('../src/lib/prospection-repository', () => ({
  updateProspectionReference: jest.fn(),
}));

import { validateSurfaces, generateNumeroFiche, saveReference } from '../src/lib/prospection-reference';

const mockUpdate = jest.mocked(updateProspectionReference);

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

describe('validateSurfaces', () => {
  it('accepts infestée <= prospectée <= station', () => {
    expect(
      validateSurfaces({ surfStation: 10, surfProspectee: 8, surfInfestee: 2 })
    ).toBe(true);
  });

  it('accepts equal values', () => {
    expect(
      validateSurfaces({ surfStation: 5, surfProspectee: 5, surfInfestee: 5 })
    ).toBe(true);
  });

  it('rejects prospectée > station', () => {
    expect(
      validateSurfaces({ surfStation: 5, surfProspectee: 8, surfInfestee: 2 })
    ).toBe(false);
  });

  it('rejects infestée > prospectée', () => {
    expect(
      validateSurfaces({ surfStation: 10, surfProspectee: 5, surfInfestee: 8 })
    ).toBe(false);
  });

  it('rejects negative values', () => {
    expect(
      validateSurfaces({ surfStation: 10, surfProspectee: 5, surfInfestee: -1 })
    ).toBe(false);
  });

  it('rejects when a field is missing', () => {
    expect(
      validateSurfaces({ surfStation: 10, surfProspectee: null, surfInfestee: 2 })
    ).toBe(false);
  });
});

describe('generateNumeroFiche', () => {
  it('is deterministic for a given draft id and date', () => {
    const a = generateNumeroFiche('11111111-1111-1111-1111-111111111111', '2026-07-11');
    const b = generateNumeroFiche('11111111-1111-1111-1111-111111111111', '2026-07-11');
    expect(a).toBe(b);
  });

  it('embeds the date and a slice of the draft id', () => {
    const numero = generateNumeroFiche('abcdef12-3456-7890-abcd-ef1234567890', '2026-07-11');
    expect(numero).toBe('FI-20260711-ABCDEF');
  });
});

describe('saveReference', () => {
  const POSITION = { latitude: -18.9, longitude: 47.5, altitude: 1280, accuracy: 5 };

  it('persists valid surfaces and position via the repository', async () => {
    mockUpdate.mockResolvedValueOnce(STORED_ROW);

    const result = await saveReference({
      draftId: STORED_ROW.id,
      position: POSITION,
      surfaces: { surfStation: 10, surfProspectee: 8, surfInfestee: 2 },
      numeroFiche: STORED_ROW.n_fiche as string,
    });

    expect(result).toEqual(STORED_ROW);
    expect(mockUpdate).toHaveBeenCalledWith(STORED_ROW.id, {
      latitude: POSITION.latitude,
      longitude: POSITION.longitude,
      altitude: POSITION.altitude,
      surfStation: 10,
      surfProspectee: 8,
      surfInfestee: 2,
      nFiche: STORED_ROW.n_fiche,
    });
  });

  it('rejects invalid surfaces without touching the repository', async () => {
    await expect(
      saveReference({
        draftId: STORED_ROW.id,
        position: POSITION,
        surfaces: { surfStation: 5, surfProspectee: 8, surfInfestee: 2 },
        numeroFiche: 'FI-20260711-111111',
      })
    ).rejects.toThrow('Surfaces invalides');

    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
