const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 });
const getFirstAsync = jest.fn();
const getAllAsync = jest.fn();

jest.mock('../src/lib/prospection-db', () => ({
  getDb: jest.fn().mockResolvedValue({
    runAsync: (...args: unknown[]) => runAsync(...args),
    getFirstAsync: (...args: unknown[]) => getFirstAsync(...args),
    getAllAsync: (...args: unknown[]) => getAllAsync(...args),
  }),
}));

import {
  createDraftProspection,
  getProspection,
  listDraftProspections,
  listRecentProspections,
  countUnsyncedProspections,
} from '../src/lib/prospection-repository';

const BASE_INPUT = {
  id: '11111111-1111-1111-1111-111111111111',
  typeProspection: 'intensive' as const,
  campagneId: '22222222-2222-2222-2222-222222222222',
  prospecteurId: '33333333-3333-3333-3333-333333333333',
  dateProspection: '2026-07-11',
};

const STORED_ROW = {
  id: BASE_INPUT.id,
  type_prospection: 'intensive',
  campagne_id: BASE_INPUT.campagneId,
  prospecteur_id: BASE_INPUT.prospecteurId,
  station_id: null,
  date_prospection: BASE_INPUT.dateProspection,
  latitude: null,
  longitude: null,
  altitude: null,
  surf_station: null,
  surf_prospectee: null,
  surf_infestee: null,
  statut: 'brouillon',
  statut_sync: 'local',
  created_at: '2026-07-11T00:00:00.000Z',
  updated_at: '2026-07-11T00:00:00.000Z',
};

beforeEach(() => {
  runAsync.mockClear();
  getFirstAsync.mockReset();
  getAllAsync.mockReset();
});

describe('createDraftProspection', () => {
  it('inserts a draft row with brouillon/local status', async () => {
    getFirstAsync.mockResolvedValueOnce(STORED_ROW);

    await createDraftProspection(BASE_INPUT);

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO prospection'),
      expect.arrayContaining([
        BASE_INPUT.id,
        BASE_INPUT.typeProspection,
        BASE_INPUT.campagneId,
        BASE_INPUT.prospecteurId,
      ])
    );
  });

  it('returns the row read back from local storage', async () => {
    getFirstAsync.mockResolvedValueOnce(STORED_ROW);

    const result = await createDraftProspection(BASE_INPUT);

    expect(result).toEqual(STORED_ROW);
  });

  it('throws if the row cannot be read back after insertion', async () => {
    getFirstAsync.mockResolvedValueOnce(null);

    await expect(createDraftProspection(BASE_INPUT)).rejects.toThrow(
      'Échec de la création de la fiche brouillon locale'
    );
  });
});

describe('getProspection', () => {
  it('returns null when no row matches the id', async () => {
    getFirstAsync.mockResolvedValueOnce(undefined);

    const result = await getProspection('does-not-exist');

    expect(result).toBeNull();
    expect(getFirstAsync).toHaveBeenCalledWith(
      'SELECT * FROM prospection WHERE id = ?',
      ['does-not-exist']
    );
  });

  it('returns the matching row', async () => {
    getFirstAsync.mockResolvedValueOnce(STORED_ROW);

    const result = await getProspection(BASE_INPUT.id);

    expect(result).toEqual(STORED_ROW);
  });
});

describe('listDraftProspections', () => {
  it('lists only brouillon rows ordered by most recently updated', async () => {
    getAllAsync.mockResolvedValueOnce([STORED_ROW]);

    const result = await listDraftProspections();

    expect(result).toEqual([STORED_ROW]);
    expect(getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("WHERE statut = 'brouillon'")
    );
  });
});

describe('listRecentProspections', () => {
  it('lists all statuses ordered by most recently updated, capped at the given limit', async () => {
    getAllAsync.mockResolvedValueOnce([STORED_ROW]);

    const result = await listRecentProspections(5);

    expect(result).toEqual([STORED_ROW]);
    expect(getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY updated_at DESC LIMIT ?'),
      [5]
    );
  });

  it('defaults the limit to 20', async () => {
    getAllAsync.mockResolvedValueOnce([]);

    await listRecentProspections();

    expect(getAllAsync).toHaveBeenCalledWith(expect.any(String), [20]);
  });
});

describe('countUnsyncedProspections', () => {
  it('counts rows whose statut_sync is not synced', async () => {
    getFirstAsync.mockResolvedValueOnce({ count: 3 });

    const result = await countUnsyncedProspections();

    expect(result).toBe(3);
    expect(getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining("statut_sync != 'synced'")
    );
  });

  it('returns 0 when the query yields no row', async () => {
    getFirstAsync.mockResolvedValueOnce(undefined);

    const result = await countUnsyncedProspections();

    expect(result).toBe(0);
  });
});
