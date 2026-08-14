import { apiClient, Campagne } from '../src/lib/api-client';
import {
  createDraftProspection,
  countUnsyncedProspections,
  listDraftProspections,
  listRecentProspections,
  deleteProspection,
  DraftProspection,
} from '../src/lib/prospection-repository';
import { listCampagnesLocal } from '../src/lib/referentiel-db';

import {
  loadAccueilData,
  loadValidatedProspections,
  pickCurrentCampagneId,
  startNewProspection,
  deleteDraftProspection,
} from '../src/lib/prospection-accueil';

jest.mock('../src/lib/api-client', () => ({
  apiClient: {
    listProspections: jest.fn(),
  },
}));

jest.mock('../src/lib/prospection-repository', () => ({
  createDraftProspection: jest.fn(),
  countUnsyncedProspections: jest.fn(),
  listDraftProspections: jest.fn(),
  listRecentProspections: jest.fn(),
  deleteProspection: jest.fn(),
}));

jest.mock('../src/lib/referentiel-db', () => ({
  listCampagnesLocal: jest.fn(),
}));

const mockApiClient = jest.mocked(apiClient);
const mockCreateDraft = jest.mocked(createDraftProspection);
const mockCountUnsynced = jest.mocked(countUnsyncedProspections);
const mockListDrafts = jest.mocked(listDraftProspections);
const mockListRecent = jest.mocked(listRecentProspections);
const mockDeleteLocal = jest.mocked(deleteProspection);
const mockListCampagnesLocal = jest.mocked(listCampagnesLocal);

const STORED_ROW: DraftProspection = {
  id: '11111111-1111-1111-1111-111111111111',
  type_prospection: 'intensive',
  campagne_id: '22222222-2222-2222-2222-222222222222',
  prospecteur_id: '33333333-3333-3333-3333-333333333333',
  station_id: null,
  biotope: 'Mesophyle',
  region: null,
  district: null,
  commune: null,
  za: null,
  pa_code: null,
  pa_nom: null,
  station_nom: null,
  n_releve: null,
  n_fiche: null,
  n_message: null,
  especes: null,
  capture_started_at: null,
  grilles_completees: null,
  date_prospection: '2026-07-11',
  latitude: null,
  longitude: null,
  altitude: null,
  surf_station: null,
  surf_prospectee: null,
  surf_infestee: null,
  degats_cultures: null,
  degats_cultures_pourcent: null,
  verdissement_pourcent: null,
  hauteur_herbe_cm: null,
  station_libre: null,
  type_station: null,
  verdure_strate: null,
  signalement_source: null,
  signalement_date: null,
  signalement_description: null,
  conclusion_validation: null,
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
  jest.resetAllMocks();
});

describe('loadAccueilData', () => {
  it('returns empty state when there is no local fiche', async () => {
    mockListDrafts.mockResolvedValueOnce([]);
    mockListRecent.mockResolvedValueOnce([]);
    mockCountUnsynced.mockResolvedValueOnce(0);

    const result = await loadAccueilData();

    expect(result).toEqual({ unsyncedCount: 0, activeDraft: null, recent: [], validated: [] });
  });

  it('surfaces the most recent draft and the unsynced count', async () => {
    mockListDrafts.mockResolvedValueOnce([STORED_ROW]);
    mockListRecent.mockResolvedValueOnce([STORED_ROW]);
    mockCountUnsynced.mockResolvedValueOnce(1);

    const result = await loadAccueilData();

    expect(result.activeDraft).toEqual(STORED_ROW);
    expect(result.recent).toEqual([STORED_ROW]);
    expect(result.unsyncedCount).toBe(1);
  });
});

describe('pickCurrentCampagneId', () => {
  const CAMPAGNES: Campagne[] = [
    { id: 'past', name: 'Passée', start_date: '2025-01-01', end_date: '2025-06-30' },
    { id: 'current', name: 'En cours', start_date: '2026-06-01', end_date: null },
    { id: 'future', name: 'Future', start_date: '2027-01-01', end_date: null },
  ];

  it('picks the campagne whose date range covers today', () => {
    const result = pickCurrentCampagneId(CAMPAGNES, new Date('2026-07-11'));
    expect(result).toBe('current');
  });

  it('falls back to the most recently started campagne when none is in range', () => {
    const noneInRange: Campagne[] = [
      { id: 'a', name: 'A', start_date: '2020-01-01', end_date: '2020-06-30' },
      { id: 'b', name: 'B', start_date: '2021-01-01', end_date: '2021-06-30' },
    ];

    const result = pickCurrentCampagneId(noneInRange, new Date('2026-07-11'));
    expect(result).toBe('b');
  });

  it('returns null when there is no campagne at all', () => {
    expect(pickCurrentCampagneId([])).toBeNull();
  });
});

describe('startNewProspection', () => {
  it('creates a local draft attached to the current campagne, read from the local référentiel', async () => {
    mockListCampagnesLocal.mockResolvedValueOnce([
      { id: 'current', name: 'En cours', start_date: '2020-01-01', end_date: null },
    ]);
    mockCreateDraft.mockResolvedValueOnce(STORED_ROW);

    const result = await startNewProspection({
      token: 'tok',
      prospecteurId: '33333333-3333-3333-3333-333333333333',
    });

    expect(result).toEqual(STORED_ROW);
    expect(mockCreateDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        campagneId: 'current',
        prospecteurId: '33333333-3333-3333-3333-333333333333',
        typeProspection: 'intensive',
      })
    );
  });

  it('does not call the network — reads only from the local référentiel cache', async () => {
    mockListCampagnesLocal.mockResolvedValueOnce([
      { id: 'current', name: 'En cours', start_date: '2020-01-01', end_date: null },
    ]);
    mockCreateDraft.mockResolvedValueOnce(STORED_ROW);

    await startNewProspection({ token: 'tok', prospecteurId: 'p1' });

    expect(mockApiClient.listProspections).not.toHaveBeenCalled();
  });

  it('throws when no campagne is available locally (référentiel jamais synchronisé)', async () => {
    mockListCampagnesLocal.mockResolvedValueOnce([]);

    await expect(
      startNewProspection({ token: 'tok', prospecteurId: 'p1' })
    ).rejects.toThrow('Aucune campagne disponible');
    expect(mockCreateDraft).not.toHaveBeenCalled();
  });

  it('throws when the selected campagne has not started yet (#105)', async () => {
    mockListCampagnesLocal.mockResolvedValueOnce([
      { id: 'future', name: 'Future', start_date: '2099-01-01', end_date: null },
    ]);

    await expect(
      startNewProspection({ token: 'tok', prospecteurId: 'p1' })
    ).rejects.toThrow('antérieure au début de la mission');
    expect(mockCreateDraft).not.toHaveBeenCalled();
  });
});

describe('loadValidatedProspections', () => {
  it('fetches fiches with statut validee for the given prospecteur', async () => {
    mockApiClient.listProspections.mockResolvedValueOnce([]);

    await loadValidatedProspections('tok', 'p1');

    expect(mockApiClient.listProspections).toHaveBeenCalledWith('tok', {
      statut: 'validee',
      prospecteur_id: 'p1',
    });
  });

  it('returns an empty list instead of throwing when offline', async () => {
    mockApiClient.listProspections.mockRejectedValueOnce(new Error('offline'));

    const result = await loadValidatedProspections('tok', 'p1');

    expect(result).toEqual([]);
  });
});

describe('deleteDraftProspection', () => {
  it('deletes the local row when the draft is a brouillon', async () => {
    mockDeleteLocal.mockResolvedValueOnce(true);

    await deleteDraftProspection({ ...STORED_ROW, statut: 'brouillon' });

    expect(mockDeleteLocal).toHaveBeenCalledWith(STORED_ROW.id);
  });

  it('refuses to delete a fiche that is no longer a brouillon', async () => {
    await expect(
      deleteDraftProspection({ ...STORED_ROW, statut: 'en_attente' })
    ).rejects.toThrow('brouillon');

    expect(mockDeleteLocal).not.toHaveBeenCalled();
  });
});
