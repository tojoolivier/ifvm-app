import {
  validateInfestationFormation,
  validateGpsPosition,
  validateComportementDirection,
  classifyLarvalPopulation,
} from '../src/lib/prospection-validation';

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

describe('validateGpsPosition — emprise Madagascar', () => {
  it('ne bloque pas une position au centre de Madagascar', () => {
    const { blocages } = validateGpsPosition({ latitude: -18.9, longitude: 47.5, accuracy: 10 });
    expect(blocages).toEqual([]);
  });

  it('bloque une position hors de Madagascar (ex. Paris)', () => {
    const { blocages } = validateGpsPosition({ latitude: 48.85, longitude: 2.35, accuracy: 10 });
    expect(blocages).toEqual([expect.stringContaining('hors de Madagascar')]);
  });

  it('bloque une position juste hors des bornes de la bounding box', () => {
    const { blocages } = validateGpsPosition({ latitude: -11.7, longitude: 47.5, accuracy: 10 });
    expect(blocages).toEqual([expect.stringContaining('hors de Madagascar')]);
  });
});

describe('validateGpsPosition — précision GPS', () => {
  it('ne bloque pas une précision exactement au seuil (50 m)', () => {
    const { blocages } = validateGpsPosition({ latitude: -18.9, longitude: 47.5, accuracy: 50 });
    expect(blocages).toEqual([]);
  });

  it('bloque une précision au-delà du seuil de 50 m', () => {
    const { blocages } = validateGpsPosition({ latitude: -18.9, longitude: 47.5, accuracy: 51 });
    expect(blocages).toEqual([expect.stringContaining('Précision GPS insuffisante')]);
  });

  it('ne bloque pas quand la précision est indisponible', () => {
    const { blocages } = validateGpsPosition({ latitude: -18.9, longitude: 47.5, accuracy: null });
    expect(blocages).toEqual([]);
  });

  it('cumule le blocage hors-Madagascar et le blocage de précision', () => {
    const { blocages } = validateGpsPosition({ latitude: 48.85, longitude: 2.35, accuracy: 100 });
    expect(blocages.length).toBe(2);
  });
});

describe('validateComportementDirection — direction obligatoire', () => {
  it.each(['bande_larvaire', 'vol_clair', 'essaim'])(
    'bloque quand la direction est absente pour %s',
    (typeCible) => {
      const { blocages } = validateComportementDirection({
        typeCible,
        comportement: null,
        directionRenseignee: false,
      });
      expect(blocages.length).toBe(1);
    }
  );

  it.each(['bande_larvaire', 'vol_clair', 'essaim'])(
    'ne bloque pas quand la direction est renseignée pour %s',
    (typeCible) => {
      const { blocages } = validateComportementDirection({
        typeCible,
        comportement: null,
        directionRenseignee: true,
      });
      expect(blocages).toEqual([]);
    }
  );

  it('n’exige pas de direction pour une tache larvaire isolée', () => {
    const { blocages } = validateComportementDirection({
      typeCible: 'tache_larvaire',
      comportement: null,
      directionRenseignee: false,
    });
    expect(blocages).toEqual([]);
  });
});

describe('validateComportementDirection — cohérence repos/déplacement', () => {
  it('avertit si la population est au repos et une direction est renseignée', () => {
    const { avertissements } = validateComportementDirection({
      typeCible: 'tache_larvaire',
      comportement: 'repos',
      directionRenseignee: true,
    });
    expect(avertissements.length).toBe(1);
  });

  it('n’avertit pas si la population est au repos sans direction', () => {
    const { avertissements } = validateComportementDirection({
      typeCible: 'tache_larvaire',
      comportement: 'repos',
      directionRenseignee: false,
    });
    expect(avertissements).toEqual([]);
  });

  it('n’avertit pas si la population est en déplacement avec direction', () => {
    const { avertissements } = validateComportementDirection({
      typeCible: 'bande_larvaire',
      comportement: 'deplacement',
      directionRenseignee: true,
    });
    expect(avertissements).toEqual([]);
  });
});

describe('classifyLarvalPopulation — tache vs bande (#103)', () => {
  it('classe en tache quand la direction n’est pas renseignée et la taille < 1000 m²', () => {
    expect(
      classifyLarvalPopulation({ tailleGroupeM2: 500, directionRenseignee: false, nbTaches: null })
    ).toBe('tache_larvaire');
  });

  it('classe en bande quand la direction est renseignée et la taille ≥ 1000 m²', () => {
    expect(
      classifyLarvalPopulation({ tailleGroupeM2: 1500, directionRenseignee: true, nbTaches: null })
    ).toBe('bande_larvaire');
  });

  it('classe en bande quand la direction est renseignée et au moins 2 taches, même sous 1000 m²', () => {
    expect(
      classifyLarvalPopulation({ tailleGroupeM2: 200, directionRenseignee: true, nbTaches: 3 })
    ).toBe('bande_larvaire');
  });

  it('classe en tache quand la direction est renseignée mais taille < 1000 m² et moins de 2 taches', () => {
    expect(
      classifyLarvalPopulation({ tailleGroupeM2: 200, directionRenseignee: true, nbTaches: 1 })
    ).toBe('tache_larvaire');
  });

  it('cas limite : taille exactement 1000 m² avec direction renseignée classe en bande', () => {
    expect(
      classifyLarvalPopulation({ tailleGroupeM2: 1000, directionRenseignee: true, nbTaches: null })
    ).toBe('bande_larvaire');
  });

  it('cas limite : taille juste sous 1000 m² avec direction renseignée classe en tache', () => {
    expect(
      classifyLarvalPopulation({ tailleGroupeM2: 999, directionRenseignee: true, nbTaches: null })
    ).toBe('tache_larvaire');
  });

  it('classe en tache sans direction même si la taille est très grande', () => {
    expect(
      classifyLarvalPopulation({ tailleGroupeM2: 5000, directionRenseignee: false, nbTaches: null })
    ).toBe('tache_larvaire');
  });
});
