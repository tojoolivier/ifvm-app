import {
  emptyExtensiveImagoState,
  emptyExtensiveLarveState,
  imagoStateToPopulationRow,
  imagoTotal,
  imagoTotalFromRow,
  larveStateToPopulationRow,
  larveTotal,
  larveTotalFromRow,
  populationRowToImagoState,
  populationRowToLarveState,
} from '../src/lib/prospection-extensive';

describe('emptyExtensiveImagoState / imagoTotal', () => {
  it('démarre à zéro pour les trois phénotypes', () => {
    const state = emptyExtensiveImagoState();
    expect(imagoTotal(state)).toBe(0);
    expect(state.active).toBe('trans');
    expect(state.essaim).toBe(false);
  });

  it('additionne sol + trans + greg', () => {
    const state = { ...emptyExtensiveImagoState(), sol: 3, trans: 14, greg: 2 };
    expect(imagoTotal(state)).toBe(19);
  });
});

describe('emptyExtensiveLarveState', () => {
  it('initialise les densités LMC sur L1-L5', () => {
    const state = emptyExtensiveLarveState('LMC');
    expect(Object.keys(state.densites)).toEqual(['L1', 'L2', 'L3', 'L4', 'L5']);
    expect(state.stade).toBe('L1');
  });

  it('initialise les densités NSE sur L1-L7', () => {
    const state = emptyExtensiveLarveState('NSE');
    expect(Object.keys(state.densites)).toEqual(['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7']);
  });
});

describe('larveTotal', () => {
  it('additionne toutes les densités renseignées', () => {
    const state = emptyExtensiveLarveState('NSE');
    state.densites.L3 = 31;
    state.densites.L5 = 4;
    expect(larveTotal(state)).toBe(35);
  });
});

describe('imagoStateToPopulationRow / populationRowToImagoState — round-trip', () => {
  it('conserve sol/trans/greg, phase, densités et essaim', () => {
    const state = { sol: 3, trans: 14, greg: 0, active: 'trans' as const, phase: 'A2', popDiff: '2.4', popGroup: '', essaim: false };
    const row = imagoStateToPopulationRow('LMC', state);
    expect(row.espece).toBe('LMC');
    expect(row.categorie).toBe('imago');
    expect(row.captures_sol).toBe(3);
    expect(row.captures_trans).toBe(14);
    expect(row.stade_imago).toBe('A2');
    expect(row.densite_diffuse).toBe(2.4);
    expect(row.densite_groupee).toBeNull();

    const restored = populationRowToImagoState(row);
    expect(restored.sol).toBe(3);
    expect(restored.trans).toBe(14);
    expect(restored.phase).toBe('A2');
    expect(restored.popDiff).toBe('2.4');
    expect(restored.essaim).toBe(false);
  });

  it('populationRowToImagoState renvoie un état vide si row est null', () => {
    expect(populationRowToImagoState(null)).toEqual(emptyExtensiveImagoState());
  });
});

describe('larveStateToPopulationRow / populationRowToLarveState — round-trip', () => {
  it('conserve les densités par stade, TL/BL, interdistance et déplacement', () => {
    const state = { ...emptyExtensiveLarveState('NSE'), tl: true, bl: false, interdist: '0.6', deplacement: 'repos' };
    state.densites.L3 = 31;
    const row = larveStateToPopulationRow('NSE', state);
    expect(row.categorie).toBe('larve');
    expect(JSON.parse(row.densites_larve as string).L3).toBe(31);
    expect(row.tache_larvaire).toBe(true);
    expect(row.bande_larvaire).toBe(false);
    expect(row.interdistance).toBe(0.6);

    const restored = populationRowToLarveState('NSE', row);
    expect(restored.densites.L3).toBe(31);
    expect(restored.tl).toBe(true);
    expect(restored.interdist).toBe('0.6');
    expect(restored.deplacement).toBe('repos');
  });

  it('populationRowToLarveState renvoie un état vide (par espèce) si row est null', () => {
    expect(populationRowToLarveState('LMC', null)).toEqual(emptyExtensiveLarveState('LMC'));
  });
});

describe('imagoTotalFromRow / larveTotalFromRow', () => {
  it('additionne sol/trans/greg directement depuis la ligne persistée', () => {
    const row = imagoStateToPopulationRow('LMC', { sol: 3, trans: 14, greg: 2, active: 'trans', phase: 'A2', popDiff: '', popGroup: '', essaim: false });
    expect(imagoTotalFromRow(row)).toBe(19);
  });

  it('renvoie 0 si la ligne imago est absente', () => {
    expect(imagoTotalFromRow(null)).toBe(0);
  });

  it('additionne les densités par stade directement depuis la ligne persistée', () => {
    const state = emptyExtensiveLarveState('NSE');
    state.densites.L3 = 31;
    state.densites.L5 = 4;
    const row = larveStateToPopulationRow('NSE', state);
    expect(larveTotalFromRow(row)).toBe(35);
  });

  it('renvoie 0 si la ligne larve est absente', () => {
    expect(larveTotalFromRow(null)).toBe(0);
  });
});
