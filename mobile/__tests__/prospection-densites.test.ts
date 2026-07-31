import { getProspectionPopulation, saveProspectionPopulation, PopulationRow } from '../src/lib/prospection-repository';

import {
  EMPTY_DENSITES,
  EMPTY_REPRODUCTION,
  INTENSITE_OPTIONS,
  METHODE_OPTIONS,
  parseDensites,
  parseReproduction,
  saveDensites,
  saveReproduction,
} from '../src/lib/prospection-densites';

jest.mock('../src/lib/prospection-repository', () => ({
  getProspectionPopulation: jest.fn(),
  saveProspectionPopulation: jest.fn(),
}));

const mockGetPopulation = jest.mocked(getProspectionPopulation);
const mockSavePopulation = jest.mocked(saveProspectionPopulation);

beforeEach(() => {
  mockGetPopulation.mockReset();
  mockSavePopulation.mockReset();
});

const IMAGO_ROW: PopulationRow = {
  espece: 'LMC',
  categorie: 'imago',
  densite_diffuse: 12.5,
  densite_groupee: 3,
  methode: 'battage',
  accouplement: 'rare',
  ponte: 'peu',
};

const LARVE_ROW: PopulationRow = {
  espece: 'LMC',
  categorie: 'larve',
  densite_diffuse: 7,
  densite_groupee: 1.5,
  methode: 'battage',
  accouplement: null,
  ponte: null,
};

describe('METHODE_OPTIONS / INTENSITE_OPTIONS', () => {
  it('exposes battage and comptage direct', () => {
    expect(METHODE_OPTIONS.map((o) => o.value)).toEqual(['battage', 'comptage_direct']);
  });

  it('exposes the 5 intensity levels in order', () => {
    expect(INTENSITE_OPTIONS.map((o) => o.value)).toEqual(['neant', 'rare', 'peu', 'beaucoup', 'dominant']);
  });
});

describe('parseDensites', () => {
  it('returns the empty state when no rows exist', () => {
    expect(parseDensites(null, null)).toEqual(EMPTY_DENSITES);
  });

  it('reads diffuse/groupee/methode from the imago and larve rows', () => {
    expect(parseDensites(IMAGO_ROW, LARVE_ROW)).toEqual({
      diffuseImago: '12.5',
      diffuseLarve: '7',
      groupeeImago: '3',
      groupeeLarve: '1.5',
      methode: 'battage',
    });
  });

  it('falls back to the larve methode when the imago row is missing', () => {
    expect(parseDensites(null, LARVE_ROW).methode).toBe('battage');
  });
});

describe('saveDensites', () => {
  it('writes one row per categorie, preserving existing accouplement/ponte', async () => {
    mockGetPopulation.mockResolvedValueOnce(IMAGO_ROW).mockResolvedValueOnce(LARVE_ROW);

    await saveDensites('prospection-1', 'LMC', {
      diffuseImago: '20',
      diffuseLarve: '10',
      groupeeImago: '4',
      groupeeLarve: '2',
      methode: 'comptage_direct',
    });

    expect(mockSavePopulation).toHaveBeenNthCalledWith(1, 'prospection-1', {
      espece: 'LMC',
      categorie: 'imago',
      densite_diffuse: 20,
      densite_groupee: 4,
      methode: 'comptage_direct',
      accouplement: 'rare',
      ponte: 'peu',
    });
    expect(mockSavePopulation).toHaveBeenNthCalledWith(2, 'prospection-1', {
      espece: 'LMC',
      categorie: 'larve',
      densite_diffuse: 10,
      densite_groupee: 2,
      methode: 'comptage_direct',
      accouplement: null,
      ponte: null,
    });
  });

  it('treats blank fields as null rather than NaN', async () => {
    mockGetPopulation.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await saveDensites('prospection-1', 'NSE', {
      diffuseImago: '',
      diffuseLarve: '',
      groupeeImago: '',
      groupeeLarve: '',
      methode: null,
    });

    expect(mockSavePopulation).toHaveBeenNthCalledWith(
      1,
      'prospection-1',
      expect.objectContaining({ densite_diffuse: null, densite_groupee: null })
    );
  });
});

describe('parseReproduction', () => {
  it('returns the empty state when no imago row exists', () => {
    expect(parseReproduction(null)).toEqual(EMPTY_REPRODUCTION);
  });

  it('reads accouplement/ponte from the imago row', () => {
    expect(parseReproduction(IMAGO_ROW)).toEqual({ accouplement: 'rare', ponte: 'peu' });
  });
});

describe('saveReproduction', () => {
  it('writes accouplement/ponte on the imago row, preserving existing densities', async () => {
    mockGetPopulation.mockResolvedValueOnce(IMAGO_ROW);

    await saveReproduction('prospection-1', 'LMC', { accouplement: 'dominant', ponte: 'beaucoup' });

    expect(mockSavePopulation).toHaveBeenCalledWith('prospection-1', {
      espece: 'LMC',
      categorie: 'imago',
      densite_diffuse: 12.5,
      densite_groupee: 3,
      methode: 'battage',
      accouplement: 'dominant',
      ponte: 'beaucoup',
    });
  });
});
