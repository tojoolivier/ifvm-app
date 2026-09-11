import {
  LMC_LARVE_STADES,
  NSE_LARVE_STADES,
  PHENOTYPES,
  PHENOTYPES_3,
  ACCOUPLEMENT_OPTIONS_LMC,
  ACCOUPLEMENT_OPTIONS_NSE,
  capturesMaxFor,
  phasesFor,
  phenotypesFor,
  grilleKeyFromString,
  grilleKeyToString,
  stadesLarvairesFor,
} from '../src/lib/prospection-especes-stades';

describe('grilleKeyToString / grilleKeyFromString', () => {
  it('sérialise et désérialise une clé de grille', () => {
    const key = { espece: 'LMC' as const, categorie: 'imago' as const };
    const serialized = grilleKeyToString(key);
    expect(serialized).toBe('LMC:imago');
    expect(grilleKeyFromString(serialized)).toEqual(key);
  });
});

describe('stadesLarvairesFor', () => {
  it('renvoie les stades larve LMC (L1-L5)', () => {
    expect(stadesLarvairesFor('LMC')).toEqual(LMC_LARVE_STADES);
  });

  it('renvoie les stades larve NSE (L1-L7, ADR-006)', () => {
    expect(stadesLarvairesFor('NSE')).toEqual(NSE_LARVE_STADES);
  });
});

describe('capturesMaxFor', () => {
  it('LMC imago 50, LMC larve 65, NSE imago 30, NSE larve 75', () => {
    expect(capturesMaxFor('LMC', 'imago')).toBe(50);
    expect(capturesMaxFor('LMC', 'larve')).toBe(65);
    expect(capturesMaxFor('NSE', 'imago')).toBe(30);
    expect(capturesMaxFor('NSE', 'larve')).toBe(75);
  });
});

// #phase-ordre-affichage : Solitaire → Solitaro-trans → Transiens → Grégaire,
// l'ordre demandé pour le champ Phase — cf. `phenotypesFor` ci-dessous
// (`PHENOTYPES`) et frontend/src/lib/prospection-reference-data.ts (`PHASES`),
// déjà dans cet ordre ; c'était `phasesFor` (écran captures.tsx, Prospection
// Intensive et Validation/Signalisation) qui divergeait.
describe('phasesFor', () => {
  it('ordonne Solitaire, Solitaro-trans, Transiens, Grégaire (LMC, et NSE imago)', () => {
    expect(phasesFor('LMC', 'imago')).toEqual(['solitaire', 'solitaro_trans', 'transiens', 'gregaire']);
    expect(phasesFor('LMC', 'larve')).toEqual(['solitaire', 'solitaro_trans', 'transiens', 'gregaire']);
    expect(phasesFor('NSE', 'imago')).toEqual(['solitaire', 'solitaro_trans', 'transiens', 'gregaire']);
  });

  it('NSE larve reste sans Solitaro-trans (PDF), ordre Solitaire, Transiens, Grégaire', () => {
    expect(phasesFor('NSE', 'larve')).toEqual(['solitaire', 'transiens', 'gregaire']);
  });
});

describe('phenotypesFor', () => {
  it('renvoie les 4 phénotypes pour tous les groupes sauf NSE larve', () => {
    expect(phenotypesFor('LMC', 'imago')).toEqual(PHENOTYPES);
    expect(phenotypesFor('LMC', 'larve')).toEqual(PHENOTYPES);
    expect(phenotypesFor('NSE', 'imago')).toEqual(PHENOTYPES);
  });

  it('renvoie les 3 phénotypes (sans Solitaro-trans) pour NSE larve', () => {
    expect(phenotypesFor('NSE', 'larve')).toEqual(PHENOTYPES_3);
  });
});

describe('options accouplement/ponte', () => {
  it('LMC inclut Dominant, NSE non (PDF 11 vs PDF 16)', () => {
    expect(ACCOUPLEMENT_OPTIONS_LMC).toEqual(['Néant', 'Rare', 'Peu', 'Beaucoup', 'Dominant']);
    expect(ACCOUPLEMENT_OPTIONS_NSE).toEqual(['Néant', 'Rare', 'Peu', 'Beaucoup']);
  });
});

