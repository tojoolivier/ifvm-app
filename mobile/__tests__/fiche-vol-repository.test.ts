import {
  createDraftFicheVol,
  getFicheVol,
  updateFicheVolReference,
  updateFicheVolEquipe,
} from '../src/lib/fiche-vol-repository';

const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 });
const getFirstAsync = jest.fn();

jest.mock('../src/lib/prospection-db', () => ({
  getDb: jest.fn().mockResolvedValue({
    runAsync: (...args: unknown[]) => runAsync(...args),
    getFirstAsync: (...args: unknown[]) => getFirstAsync(...args),
  }),
}));

const STORED_ROW = {
  id: '11111111-1111-1111-1111-111111111111',
  numero_fiche: null,
  date_vol: '2026-09-14',
  compagnie: null,
  immatriculation: null,
  base_code: null,
  base_nom: null,
  base_latitude: null,
  base_longitude: null,
  base_altitude: null,
  stand_nom: null,
  stand_latitude: null,
  stand_longitude: null,
  stand_altitude: null,
  pilote: null,
  mecanicien: null,
  chef_de_base: null,
  consultant_international: null,
  observations: null,
  statut: 'brouillon',
  statut_sync: 'local',
  created_at: '2026-09-14T00:00:00.000Z',
  updated_at: '2026-09-14T00:00:00.000Z',
};

beforeEach(() => {
  runAsync.mockClear();
  getFirstAsync.mockReset();
});

describe('createDraftFicheVol', () => {
  it('inserts a draft row with brouillon/local status and today’s date', async () => {
    getFirstAsync.mockResolvedValueOnce(STORED_ROW);

    await createDraftFicheVol();

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO fiche_vol"),
      expect.arrayContaining([expect.any(String), expect.any(String), expect.any(String), expect.any(String)])
    );
    const [sql] = runAsync.mock.calls[0];
    expect(sql).toContain("'brouillon'");
    expect(sql).toContain("'local'");
  });

  it('returns the row read back from local storage', async () => {
    getFirstAsync.mockResolvedValueOnce(STORED_ROW);

    const result = await createDraftFicheVol();

    expect(result).toEqual(STORED_ROW);
  });

  it('throws if the row cannot be read back after insertion', async () => {
    getFirstAsync.mockResolvedValueOnce(null);

    await expect(createDraftFicheVol()).rejects.toThrow(
      'Échec de la création de la fiche de vol locale'
    );
  });
});

describe('getFicheVol', () => {
  it('reads a single row by id', async () => {
    getFirstAsync.mockResolvedValueOnce(STORED_ROW);

    const result = await getFicheVol(STORED_ROW.id);

    expect(getFirstAsync).toHaveBeenCalledWith(
      'SELECT * FROM fiche_vol WHERE id = ?',
      [STORED_ROW.id]
    );
    expect(result).toEqual(STORED_ROW);
  });

  it('returns null when the fiche does not exist', async () => {
    getFirstAsync.mockResolvedValueOnce(null);

    const result = await getFicheVol('unknown-id');

    expect(result).toBeNull();
  });
});

describe('updateFicheVolReference', () => {
  const REFERENCE_INPUT = {
    compagnie: 'Aviation Malgache',
    immatriculation: '5R-ABC',
    baseLatitude: -18.9,
    baseLongitude: 47.5,
    baseAltitude: 1280,
  };

  it('updates compagnie, immatriculation and base GPS position on the draft row', async () => {
    getFirstAsync.mockResolvedValueOnce({ ...STORED_ROW, ...REFERENCE_INPUT });

    await updateFicheVolReference(STORED_ROW.id, REFERENCE_INPUT);

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE fiche_vol SET'),
      expect.arrayContaining([
        REFERENCE_INPUT.compagnie,
        REFERENCE_INPUT.immatriculation,
        REFERENCE_INPUT.baseLatitude,
        REFERENCE_INPUT.baseLongitude,
        REFERENCE_INPUT.baseAltitude,
      ])
    );
  });

  it('returns the updated row read back from local storage', async () => {
    getFirstAsync.mockResolvedValueOnce({ ...STORED_ROW, ...REFERENCE_INPUT });

    const result = await updateFicheVolReference(STORED_ROW.id, REFERENCE_INPUT);

    expect(result).toEqual({ ...STORED_ROW, ...REFERENCE_INPUT });
  });

  it('throws if the row cannot be read back after the update', async () => {
    getFirstAsync.mockResolvedValueOnce(null);

    await expect(updateFicheVolReference(STORED_ROW.id, REFERENCE_INPUT)).rejects.toThrow(
      'Échec de la mise à jour de la fiche de vol locale'
    );
  });
});

describe('updateFicheVolEquipe', () => {
  const EQUIPE_INPUT = {
    pilote: 'Rakoto A.',
    chefDeBase: 'Rasoa C.',
    consultantInternational: 'Dupont M.',
    mecanicien: 'Randria B.',
  };

  it('updates pilote, chef de base, consultant FAO and mécanicien on the draft row', async () => {
    getFirstAsync.mockResolvedValueOnce({ ...STORED_ROW, ...EQUIPE_INPUT });

    await updateFicheVolEquipe(STORED_ROW.id, EQUIPE_INPUT);

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE fiche_vol SET'),
      expect.arrayContaining([
        EQUIPE_INPUT.pilote,
        EQUIPE_INPUT.chefDeBase,
        EQUIPE_INPUT.consultantInternational,
        EQUIPE_INPUT.mecanicien,
      ])
    );
  });

  it('accepts a null Consultant FAO (facultatif)', async () => {
    getFirstAsync.mockResolvedValueOnce({ ...STORED_ROW, ...EQUIPE_INPUT, consultant_international: null });

    await updateFicheVolEquipe(STORED_ROW.id, { ...EQUIPE_INPUT, consultantInternational: null });

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE fiche_vol SET'),
      expect.arrayContaining([null])
    );
  });

  it('throws if the row cannot be read back after the update', async () => {
    getFirstAsync.mockResolvedValueOnce(null);

    await expect(updateFicheVolEquipe(STORED_ROW.id, EQUIPE_INPUT)).rejects.toThrow(
      'Échec de la mise à jour de la fiche de vol locale'
    );
  });
});
