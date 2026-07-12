import { getProspectionInfestation, saveProspectionInfestation, InfestationRow } from '../src/lib/prospection-repository';

jest.mock('../src/lib/prospection-repository', () => ({
  getProspectionInfestation: jest.fn(),
  saveProspectionInfestation: jest.fn(),
}));

import {
  COMPORTEMENT_OPTIONS,
  DIRECTION_OPTIONS,
  EMPTY_INFESTATION_COMPORTEMENT,
  EMPTY_INFESTATION_DESCRIPTION,
  TYPE_CIBLE_OPTIONS,
  isInfestationDescriptionComplete,
  parseInfestationComportement,
  parseInfestationDescription,
  saveInfestationComportement,
  saveInfestationDescription,
} from '../src/lib/prospection-infestation';

const mockGetInfestation = jest.mocked(getProspectionInfestation);
const mockSaveInfestation = jest.mocked(saveProspectionInfestation);

beforeEach(() => {
  mockGetInfestation.mockReset();
  mockSaveInfestation.mockReset();
});

const ROW: InfestationRow = {
  type_cible: 'bande_larvaire',
  taille_min: 1,
  taille_max: 3,
  taille_moy: 2,
  surface_tot: 12.5,
  densite_min: 5,
  densite_max: 20,
  densite_moy: 10,
  interdistance: 4,
  comportement: 'deplacement',
  direction_vers: 'NE',
  vent_de: 'S',
  vent_vitesse: 15,
};

describe('TYPE_CIBLE_OPTIONS / COMPORTEMENT_OPTIONS / DIRECTION_OPTIONS', () => {
  it('exposes the 4 target types', () => {
    expect(TYPE_CIBLE_OPTIONS.map((o) => o.value)).toEqual([
      'tache_larvaire',
      'bande_larvaire',
      'vol_clair',
      'essaim',
    ]);
  });

  it('exposes repos/deplacement', () => {
    expect(COMPORTEMENT_OPTIONS.map((o) => o.value)).toEqual(['repos', 'deplacement']);
  });

  it('exposes the 8 rose-des-vents directions', () => {
    expect(DIRECTION_OPTIONS.map((o) => o.value)).toEqual(['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']);
  });
});

describe('parseInfestationDescription', () => {
  it('returns the empty state when no row exists', () => {
    expect(parseInfestationDescription(null)).toEqual(EMPTY_INFESTATION_DESCRIPTION);
  });

  it('reads description fields from the row', () => {
    expect(parseInfestationDescription(ROW)).toEqual({
      typeCible: 'bande_larvaire',
      tailleMin: '1',
      tailleMax: '3',
      tailleMoy: '2',
      surfaceTot: '12.5',
      densiteMin: '5',
      densiteMax: '20',
      densiteMoy: '10',
      interdistance: '4',
    });
  });
});

describe('isInfestationDescriptionComplete', () => {
  it('is false without a type de cible', () => {
    expect(isInfestationDescriptionComplete(EMPTY_INFESTATION_DESCRIPTION)).toBe(false);
  });

  it('is true once a type de cible is selected', () => {
    expect(
      isInfestationDescriptionComplete({ ...EMPTY_INFESTATION_DESCRIPTION, typeCible: 'essaim' })
    ).toBe(true);
  });
});

describe('parseInfestationComportement', () => {
  it('returns the empty state when no row exists', () => {
    expect(parseInfestationComportement(null)).toEqual(EMPTY_INFESTATION_COMPORTEMENT);
  });

  it('reads comportement fields from the row', () => {
    expect(parseInfestationComportement(ROW)).toEqual({
      comportement: 'deplacement',
      directionVers: 'NE',
      ventDe: 'S',
      ventVitesse: '15',
    });
  });
});

describe('saveInfestationDescription', () => {
  it('writes description fields, preserving existing comportement', async () => {
    mockGetInfestation.mockResolvedValueOnce(ROW);

    await saveInfestationDescription('prospection-1', {
      typeCible: 'essaim',
      tailleMin: '2',
      tailleMax: '6',
      tailleMoy: '4',
      surfaceTot: '30',
      densiteMin: '8',
      densiteMax: '40',
      densiteMoy: '20',
      interdistance: '2',
    });

    expect(mockSaveInfestation).toHaveBeenCalledWith('prospection-1', {
      type_cible: 'essaim',
      taille_min: 2,
      taille_max: 6,
      taille_moy: 4,
      surface_tot: 30,
      densite_min: 8,
      densite_max: 40,
      densite_moy: 20,
      interdistance: 2,
      comportement: 'deplacement',
      direction_vers: 'NE',
      vent_de: 'S',
      vent_vitesse: 15,
    });
  });

  it('treats blank fields as null rather than NaN', async () => {
    mockGetInfestation.mockResolvedValueOnce(null);

    await saveInfestationDescription('prospection-1', {
      ...EMPTY_INFESTATION_DESCRIPTION,
      typeCible: 'tache_larvaire',
    });

    expect(mockSaveInfestation).toHaveBeenCalledWith(
      'prospection-1',
      expect.objectContaining({ taille_min: null, surface_tot: null, interdistance: null })
    );
  });
});

describe('saveInfestationComportement', () => {
  it('writes comportement fields, preserving existing description', async () => {
    mockGetInfestation.mockResolvedValueOnce(ROW);

    await saveInfestationComportement('prospection-1', {
      comportement: 'repos',
      directionVers: 'S',
      ventDe: 'N',
      ventVitesse: '5',
    });

    expect(mockSaveInfestation).toHaveBeenCalledWith('prospection-1', {
      type_cible: 'bande_larvaire',
      taille_min: 1,
      taille_max: 3,
      taille_moy: 2,
      surface_tot: 12.5,
      densite_min: 5,
      densite_max: 20,
      densite_moy: 10,
      interdistance: 4,
      comportement: 'repos',
      direction_vers: 'S',
      vent_de: 'N',
      vent_vitesse: 5,
    });
  });
});
