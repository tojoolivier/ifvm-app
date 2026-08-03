import {
  LMC_FEMALE_STADES,
  LMC_MALE_STADES,
  NSE_LARVE_STADES,
  PHENOTYPES,
  PHENOTYPES_3,
  ACCOUPLEMENT_OPTIONS_LMC,
  ACCOUPLEMENT_OPTIONS_NSE,
  capturesMaxFor,
  phenotypesFor,
  grilleKeyFromString,
  grilleKeyToString,
  remapStadeForSexeChange,
  stadesFor,
} from '../src/lib/prospection-especes-stades';

describe('grilleKeyToString / grilleKeyFromString', () => {
  it('sérialise et désérialise une clé de grille', () => {
    const key = { espece: 'LMC' as const, categorie: 'imago' as const };
    const serialized = grilleKeyToString(key);
    expect(serialized).toBe('LMC:imago');
    expect(grilleKeyFromString(serialized)).toEqual(key);
  });
});

describe('stadesFor', () => {
  it('renvoie les 9 stades femelle pour LMC imago', () => {
    expect(stadesFor('LMC', 'imago', 'F')).toEqual(LMC_FEMALE_STADES);
  });

  it('renvoie les 3 stades simplifiés mâle pour LMC imago', () => {
    expect(stadesFor('LMC', 'imago', 'M')).toEqual(LMC_MALE_STADES);
  });

  it('renvoie les 9 stades femelle pour NSE imago (même bascule sexe que LMC, PDF officiel)', () => {
    expect(stadesFor('NSE', 'imago', 'F')).toEqual(LMC_FEMALE_STADES);
  });

  it('renvoie les 3 stades simplifiés mâle pour NSE imago', () => {
    expect(stadesFor('NSE', 'imago', 'M')).toEqual(LMC_MALE_STADES);
  });

  it('renvoie les stades larve NSE (L1-L7)', () => {
    expect(stadesFor('NSE', 'larve', null)).toEqual(NSE_LARVE_STADES);
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

describe('remapStadeForSexeChange', () => {
  it('conserve le stade courant si présent dans le nouveau jeu', () => {
    expect(remapStadeForSexeChange('A1', 'M')).toBe('A1');
  });

  it("bascule vers le premier stade du nouveau jeu si le stade courant n'existe pas (ex: sous-stade A3¼ vers mâle)", () => {
    expect(remapStadeForSexeChange('A3¼', 'M')).toBe(LMC_MALE_STADES[0]);
  });

  it('gère un stade courant nul', () => {
    expect(remapStadeForSexeChange(null, 'F')).toBe(LMC_FEMALE_STADES[0]);
  });
});
