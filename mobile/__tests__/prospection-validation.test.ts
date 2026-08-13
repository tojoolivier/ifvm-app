import { validateInfestationFormation } from '../src/lib/prospection-validation';

describe('validateInfestationFormation — densité min < max', () => {
  it('bloque quand la densité minimale est supérieure à la maximale', () => {
    const { blocages } = validateInfestationFormation({ densMin: 50, densMax: 10, ventVitesse: null });
    expect(blocages).toEqual([expect.stringContaining('inférieure à la densité maximale')]);
  });

  it('bloque quand min et max sont égales', () => {
    const { blocages } = validateInfestationFormation({ densMin: 20, densMax: 20, ventVitesse: null });
    expect(blocages.length).toBe(1);
  });

  it('ne bloque pas quand min < max', () => {
    const { blocages } = validateInfestationFormation({ densMin: 5, densMax: 10, ventVitesse: null });
    expect(blocages).toEqual([]);
  });

  it('ne bloque pas quand un des deux champs est vide', () => {
    expect(validateInfestationFormation({ densMin: 5, densMax: null, ventVitesse: null }).blocages).toEqual([]);
    expect(validateInfestationFormation({ densMin: null, densMax: 10, ventVitesse: null }).blocages).toEqual([]);
  });
});

describe('validateInfestationFormation — vitesse du vent', () => {
  it('bloque une vitesse négative', () => {
    const { blocages } = validateInfestationFormation({ densMin: null, densMax: null, ventVitesse: -5 });
    expect(blocages).toEqual([expect.stringContaining('négative')]);
  });

  it('bloque une vitesse au-delà du seuil physiquement plausible', () => {
    const { blocages } = validateInfestationFormation({ densMin: null, densMax: null, ventVitesse: 300 });
    expect(blocages).toEqual([expect.stringContaining('250 km/h')]);
  });

  it('avertit sans bloquer pour une vitesse extrême mais plausible', () => {
    const { blocages, avertissements } = validateInfestationFormation({
      densMin: null,
      densMax: null,
      ventVitesse: 100,
    });
    expect(blocages).toEqual([]);
    expect(avertissements).toEqual([expect.stringContaining('extrême')]);
  });

  it('ne déclenche rien pour une vitesse plausible normale', () => {
    const result = validateInfestationFormation({ densMin: null, densMax: null, ventVitesse: 15 });
    expect(result).toEqual({ blocages: [], avertissements: [] });
  });

  it('ne déclenche rien quand la vitesse est absente', () => {
    const result = validateInfestationFormation({ densMin: null, densMax: null, ventVitesse: null });
    expect(result).toEqual({ blocages: [], avertissements: [] });
  });
});

describe('validateInfestationFormation — combinaison', () => {
  it('cumule les blocages de plusieurs règles', () => {
    const { blocages } = validateInfestationFormation({ densMin: 30, densMax: 10, ventVitesse: -1 });
    expect(blocages.length).toBe(2);
  });
});
