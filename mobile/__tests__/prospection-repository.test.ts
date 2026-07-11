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
  updateProspectionReference,
  updateProspectionEspeces,
  updateProspectionVegetation,
  startCaptureTimer,
  saveProspectionCaptures,
  listProspectionCaptures,
  markGrilleCompleted,
  getProspectionPopulation,
  saveProspectionPopulation,
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
  n_fiche: null,
  especes: null,
  capture_started_at: null,
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

describe('updateProspectionReference', () => {
  const REFERENCE_INPUT = {
    latitude: -18.9,
    longitude: 47.5,
    altitude: 1280,
    surfStation: 10,
    surfProspectee: 8,
    surfInfestee: 2,
    nFiche: 'FI-20260711-111111',
  };

  it('updates position, surfaces and n° fiche on the draft row', async () => {
    getFirstAsync.mockResolvedValueOnce({ ...STORED_ROW, ...REFERENCE_INPUT });

    await updateProspectionReference(BASE_INPUT.id, REFERENCE_INPUT);

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE prospection SET'),
      expect.arrayContaining([
        REFERENCE_INPUT.latitude,
        REFERENCE_INPUT.longitude,
        REFERENCE_INPUT.altitude,
        REFERENCE_INPUT.surfStation,
        REFERENCE_INPUT.surfProspectee,
        REFERENCE_INPUT.surfInfestee,
        REFERENCE_INPUT.nFiche,
      ])
    );
  });

  it('returns the updated row read back from local storage', async () => {
    const updated = { ...STORED_ROW, ...REFERENCE_INPUT };
    getFirstAsync.mockResolvedValueOnce(updated);

    const result = await updateProspectionReference(BASE_INPUT.id, REFERENCE_INPUT);

    expect(result).toEqual(updated);
  });

  it('throws if the row cannot be read back after the update', async () => {
    getFirstAsync.mockResolvedValueOnce(null);

    await expect(updateProspectionReference(BASE_INPUT.id, REFERENCE_INPUT)).rejects.toThrow(
      'Échec de la mise à jour de la fiche brouillon locale'
    );
  });
});

describe('updateProspectionEspeces', () => {
  const ESPECES_JSON = JSON.stringify({ lmcImago: true, lmcLarve: false, nseImago: true });

  it('updates the especes column on the draft row', async () => {
    getFirstAsync.mockResolvedValueOnce({ ...STORED_ROW, especes: ESPECES_JSON });

    await updateProspectionEspeces(BASE_INPUT.id, ESPECES_JSON);

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE prospection SET especes'),
      expect.arrayContaining([ESPECES_JSON, BASE_INPUT.id])
    );
  });

  it('returns the updated row read back from local storage', async () => {
    const updated = { ...STORED_ROW, especes: ESPECES_JSON };
    getFirstAsync.mockResolvedValueOnce(updated);

    const result = await updateProspectionEspeces(BASE_INPUT.id, ESPECES_JSON);

    expect(result).toEqual(updated);
  });

  it('throws if the row cannot be read back after the update', async () => {
    getFirstAsync.mockResolvedValueOnce(null);

    await expect(updateProspectionEspeces(BASE_INPUT.id, ESPECES_JSON)).rejects.toThrow(
      'Échec de la mise à jour de la fiche brouillon locale'
    );
  });
});

describe('updateProspectionVegetation', () => {
  const VEGETATION_INPUT = {
    vegetation: JSON.stringify({ recouvrement_herbeux: 40 }),
    sol: JSON.stringify({ humidite: 'surface', texture: 'limoneuse' }),
    degatsCultures: 'nuls',
  };

  it('updates vegetation/sol/degats_cultures columns on the draft row', async () => {
    getFirstAsync.mockResolvedValueOnce({ ...STORED_ROW, ...VEGETATION_INPUT });

    await updateProspectionVegetation(BASE_INPUT.id, VEGETATION_INPUT);

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE prospection SET vegetation'),
      expect.arrayContaining([
        VEGETATION_INPUT.vegetation,
        VEGETATION_INPUT.sol,
        VEGETATION_INPUT.degatsCultures,
        BASE_INPUT.id,
      ])
    );
  });

  it('returns the updated row read back from local storage', async () => {
    const updated = { ...STORED_ROW, ...VEGETATION_INPUT };
    getFirstAsync.mockResolvedValueOnce(updated);

    const result = await updateProspectionVegetation(BASE_INPUT.id, VEGETATION_INPUT);

    expect(result).toEqual(updated);
  });

  it('throws if the row cannot be read back after the update', async () => {
    getFirstAsync.mockResolvedValueOnce(null);

    await expect(updateProspectionVegetation(BASE_INPUT.id, VEGETATION_INPUT)).rejects.toThrow(
      'Échec de la mise à jour de la fiche brouillon locale'
    );
  });
});

describe('startCaptureTimer', () => {
  it('sets capture_started_at only when not already running', async () => {
    getFirstAsync.mockResolvedValueOnce({ ...STORED_ROW, capture_started_at: '2026-07-11T10:00:00.000Z' });

    await startCaptureTimer(BASE_INPUT.id);

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('capture_started_at IS NULL'),
      expect.arrayContaining([BASE_INPUT.id])
    );
  });

  it('throws if the row cannot be read back after the update', async () => {
    getFirstAsync.mockResolvedValueOnce(null);

    await expect(startCaptureTimer(BASE_INPUT.id)).rejects.toThrow(
      'Échec de la mise à jour de la fiche brouillon locale'
    );
  });
});

describe('markGrilleCompleted', () => {
  it('stores the first completed grille as a single-element JSON array', async () => {
    getFirstAsync.mockResolvedValueOnce({ ...STORED_ROW, grilles_completees: null });
    getFirstAsync.mockResolvedValueOnce({ ...STORED_ROW, grilles_completees: JSON.stringify(['LMC|imago']) });

    await markGrilleCompleted(BASE_INPUT.id, 'LMC|imago');

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE prospection SET grilles_completees'),
      [JSON.stringify(['LMC|imago']), expect.any(String), BASE_INPUT.id]
    );
  });

  it('is idempotent and accumulates distinct grilles', async () => {
    getFirstAsync.mockResolvedValueOnce({ ...STORED_ROW, grilles_completees: JSON.stringify(['LMC|imago']) });
    getFirstAsync.mockResolvedValueOnce({
      ...STORED_ROW,
      grilles_completees: JSON.stringify(['LMC|imago', 'NSE|imago']),
    });

    await markGrilleCompleted(BASE_INPUT.id, 'NSE|imago');

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE prospection SET grilles_completees'),
      [JSON.stringify(['LMC|imago', 'NSE|imago']), expect.any(String), BASE_INPUT.id]
    );
  });

  it('re-marking the same grille does not duplicate it', async () => {
    getFirstAsync.mockResolvedValueOnce({ ...STORED_ROW, grilles_completees: JSON.stringify(['LMC|imago']) });
    getFirstAsync.mockResolvedValueOnce({ ...STORED_ROW, grilles_completees: JSON.stringify(['LMC|imago']) });

    await markGrilleCompleted(BASE_INPUT.id, 'LMC|imago');

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE prospection SET grilles_completees'),
      [JSON.stringify(['LMC|imago']), expect.any(String), BASE_INPUT.id]
    );
  });

  it('throws if the row cannot be read back after the update', async () => {
    getFirstAsync.mockResolvedValueOnce({ ...STORED_ROW, grilles_completees: null });
    getFirstAsync.mockResolvedValueOnce(null);

    await expect(markGrilleCompleted(BASE_INPUT.id, 'LMC|imago')).rejects.toThrow(
      'Échec de la mise à jour de la fiche brouillon locale'
    );
  });
});

describe('saveProspectionCaptures', () => {
  const ROWS = [{ espece: 'LMC' as const, categorie: 'imago' as const, sexe: 'F' as const, phase: 'solitaire', stade: 'A1', effectif: 2 }];

  it('deletes existing rows for the grille then inserts the new ones', async () => {
    await saveProspectionCaptures(BASE_INPUT.id, 'LMC', 'imago', ROWS);

    expect(runAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('DELETE FROM prospection_capture'),
      [BASE_INPUT.id, 'LMC', 'imago']
    );
    expect(runAsync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO prospection_capture'),
      expect.arrayContaining([BASE_INPUT.id, 'LMC', 'imago', 'F', 'solitaire', 'A1', 2])
    );
  });

  it('only deletes when there are no rows to persist', async () => {
    await saveProspectionCaptures(BASE_INPUT.id, 'LMC', 'imago', []);

    expect(runAsync).toHaveBeenCalledTimes(1);
  });
});

describe('listProspectionCaptures', () => {
  it('lists rows for a given grille', async () => {
    const rows = [{ espece: 'LMC', categorie: 'imago', sexe: 'F', phase: 'solitaire', stade: 'A1', effectif: 2 }];
    getAllAsync.mockResolvedValueOnce(rows);

    const result = await listProspectionCaptures(BASE_INPUT.id, 'LMC', 'imago');

    expect(result).toEqual(rows);
    expect(getAllAsync).toHaveBeenCalledWith(expect.any(String), [BASE_INPUT.id, 'LMC', 'imago']);
  });
});

describe('getProspectionPopulation', () => {
  it('returns null when no row matches', async () => {
    getFirstAsync.mockResolvedValueOnce(undefined);

    const result = await getProspectionPopulation(BASE_INPUT.id, 'LMC', 'imago');

    expect(result).toBeNull();
    expect(getFirstAsync).toHaveBeenCalledWith(expect.any(String), [BASE_INPUT.id, 'LMC', 'imago']);
  });

  it('returns the matching row', async () => {
    const row = {
      espece: 'LMC',
      categorie: 'imago',
      densite_diffuse: 10,
      densite_groupee: 2,
      methode: 'battage',
      accouplement: 'rare',
      ponte: 'peu',
    };
    getFirstAsync.mockResolvedValueOnce(row);

    const result = await getProspectionPopulation(BASE_INPUT.id, 'LMC', 'imago');

    expect(result).toEqual(row);
  });
});

describe('saveProspectionPopulation', () => {
  const ROW = {
    espece: 'LMC' as const,
    categorie: 'imago' as const,
    densite_diffuse: 10,
    densite_groupee: 2,
    methode: 'battage',
    accouplement: 'rare',
    ponte: 'peu',
  };

  it('inserts a new row when none exists for the espece/categorie', async () => {
    getFirstAsync.mockResolvedValueOnce(undefined);

    await saveProspectionPopulation(BASE_INPUT.id, ROW);

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO prospection_population'),
      expect.arrayContaining([BASE_INPUT.id, 'LMC', 'imago', 10, 2, 'battage', 'rare', 'peu'])
    );
  });

  it('updates the existing row when one already exists', async () => {
    getFirstAsync.mockResolvedValueOnce({ id: 'existing-id' });

    await saveProspectionPopulation(BASE_INPUT.id, ROW);

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE prospection_population SET'),
      [10, 2, 'battage', 'rare', 'peu', 'existing-id']
    );
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
