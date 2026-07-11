import { updateProspectionVegetation } from '../src/lib/prospection-repository';

jest.mock('../src/lib/prospection-repository', () => ({
  updateProspectionVegetation: jest.fn(),
}));

import {
  DEFAULT_VEGETATION_SOL,
  STRATE_KEYS,
  StratesState,
  VegetationSolState,
  buildSolJson,
  buildVegetationJson,
  clampRecouvrement,
  isVegetationSolComplete,
  parseVegetationSol,
  saveVegetationSol,
  totalRecouvrement,
} from '../src/lib/prospection-vegetation';

const mockUpdateVegetation = jest.mocked(updateProspectionVegetation);

beforeEach(() => {
  mockUpdateVegetation.mockReset();
});

function stratesWithTotal(recouvrementByKey: Partial<Record<(typeof STRATE_KEYS)[number], number>>): StratesState {
  const strates = {} as StratesState;
  for (const key of STRATE_KEYS) {
    strates[key] = { recouvrement: recouvrementByKey[key] ?? 0, phenologie: null, hauteur: null };
  }
  return strates;
}

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

describe('totalRecouvrement', () => {
  it('sums the recouvrement of all 6 strates', () => {
    const strates = stratesWithTotal({ arboree: 10, herbeuse: 40, sol_nu: 20 });
    expect(totalRecouvrement(strates)).toBe(70);
  });

  it('is 0 for the default strates', () => {
    expect(totalRecouvrement(DEFAULT_VEGETATION_SOL.strates)).toBe(0);
  });
});

describe('isVegetationSolComplete', () => {
  it('is false when a selector is missing', () => {
    expect(isVegetationSolComplete(DEFAULT_VEGETATION_SOL)).toBe(false);
  });

  it('is false when the strates total is not 100', () => {
    const state: VegetationSolState = {
      strates: stratesWithTotal({ herbeuse: 40 }),
      humidite: 'surface',
      texture: 'limoneuse',
      degatsCultures: 'nuls',
    };
    expect(isVegetationSolComplete(state)).toBe(false);
  });

  it('is true once humidite/texture/degatsCultures are set and strates total 100', () => {
    const state: VegetationSolState = {
      strates: stratesWithTotal({ arboree: 20, herbeuse: 60, sol_nu: 20 }),
      humidite: 'surface',
      texture: 'limoneuse',
      degatsCultures: 'nuls',
    };
    expect(isVegetationSolComplete(state)).toBe(true);
  });
});

describe('buildVegetationJson / buildSolJson / parseVegetationSol', () => {
  it('round-trips a full state through JSON, including per-strate phenologie/hauteur', () => {
    const strates = stratesWithTotal({ arboree: 30, herbeuse: 50, sol_nu: 20 });
    strates.arboree = { recouvrement: 30, phenologie: 'floraison', hauteur: 4.5 };
    strates.herbeuse = { recouvrement: 50, phenologie: 'sec', hauteur: 0.3 };
    const state: VegetationSolState = {
      strates,
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

  it('migrates the pre-#15 single-recouvrement format onto the strate herbeuse', () => {
    const vegetation = JSON.stringify({ recouvrement_herbeux: 65 });
    const parsed = parseVegetationSol(vegetation, null, null);
    expect(parsed.strates.herbeuse).toEqual({ recouvrement: 65, phenologie: null, hauteur: null });
    expect(totalRecouvrement(parsed.strates)).toBe(65);
  });
});

describe('saveVegetationSol', () => {
  it('persists vegetation/sol/degats_cultures via the repository', async () => {
    const state: VegetationSolState = {
      strates: stratesWithTotal({ arboree: 20, herbeuse: 60, sol_nu: 20 }),
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
