import {
  LMC_FEMALE_STADES,
  LMC_MALE_STADES,
  NSE_LARVE_STADES,
  NSE_STADES,
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

  it('ignore le sexe pour NSE imago', () => {
    expect(stadesFor('NSE', 'imago', null)).toEqual(NSE_STADES);
  });

  it('renvoie les stades larve NSE (L1-L7)', () => {
    expect(stadesFor('NSE', 'larve', null)).toEqual(NSE_LARVE_STADES);
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
