import { updateProspectionVegetation } from '../src/lib/prospection-repository';

jest.mock('../src/lib/prospection-repository', () => ({
  updateProspectionVegetation: jest.fn(),
}));

import {
  DEFAULT_VEGETATION_SOL,
  VegetationSolState,
  buildSolJson,
  buildVegetationJson,
  clampRecouvrement,
  isVegetationSolComplete,
  parseVegetationSol,
  saveVegetationSol,
} from '../src/lib/prospection-vegetation';

const mockUpdateVegetation = jest.mocked(updateProspectionVegetation);

beforeEach(() => {
  mockUpdateVegetation.mockReset();
});

describe('clampRecouvrement', () => {
  it('clamps values below 0 to 0', () => {
    expect(clampRecouvrement(-5)).toBe(0);
  });

  it('clamps values above 100 to 100', () => {
    expect(clampRecouvrement(150)).toBe(100);
  });

  it('rounds fractional values', () => {
    expect(clampRecouvrement(42.6)).toBe(43);
  });

  it('passes through in-range integer values', () => {
    expect(clampRecouvrement(30)).toBe(30);
  });
});

describe('isVegetationSolComplete', () => {
  it('is false when a selector is missing', () => {
    expect(isVegetationSolComplete(DEFAULT_VEGETATION_SOL)).toBe(false);
  });

  it('is true once humidite/texture/degatsCultures are all set', () => {
    const state: VegetationSolState = {
      recouvrementHerbeux: 20,
      humidite: 'surface',
      texture: 'limoneuse',
      degatsCultures: 'nuls',
    };
    expect(isVegetationSolComplete(state)).toBe(true);
  });
});

describe('buildVegetationJson / buildSolJson / parseVegetationSol', () => {
  it('round-trips a full state through JSON', () => {
    const state: VegetationSolState = {
      recouvrementHerbeux: 65,
      humidite: '5_12cm',
      texture: 'sable_fin',
      degatsCultures: 'moyens',
    };

    const vegetation = buildVegetationJson(state);
    const sol = buildSolJson(state);
    const parsed = parseVegetationSol(vegetation, sol, state.degatsCultures);

    expect(parsed).toEqual(state);
  });

  it('parses null columns back to the default state', () => {
    expect(parseVegetationSol(null, null, null)).toEqual(DEFAULT_VEGETATION_SOL);
  });
});

describe('saveVegetationSol', () => {
  it('persists vegetation/sol/degats_cultures via the repository', async () => {
    const state: VegetationSolState = {
      recouvrementHerbeux: 40,
      humidite: '12_30cm',
      texture: 'argileuse',
      degatsCultures: 'faibles',
    };

    await saveVegetationSol('prospection-1', state);

    expect(mockUpdateVegetation).toHaveBeenCalledWith('prospection-1', {
      vegetation: buildVegetationJson(state),
      sol: buildSolJson(state),
      degatsCultures: 'faibles',
    });
  });
});
