import { validerGrille } from '../src/lib/prospection-capture-rules';

describe('validerGrille — intensif : captures = phases = stades ♀ + ♂', () => {
  const base = { captures: 12, phases: { solitaire: 9, transiens: 3 } };

  it('accepte quand les stades ♀ + ♂ totalisent les captures', () => {
    const erreurs = validerGrille('intensive', 'imago', {
      ...base,
      stades: { F: { A4: 4, A5: 3 }, M: { A234: 5 } },
    });
    expect(erreurs).not.toContain('stades');
  });

  it('signale les stades quand ♀ + ♂ diffèrent des captures', () => {
    const erreurs = validerGrille('intensive', 'imago', {
      ...base,
      stades: { F: { A4: 4, A5: 3 }, M: { A234: 4 } },
    });
    expect(erreurs).toContain('stades');
  });

  it("n'exige pas les stades en extensif", () => {
    const erreurs = validerGrille('extensive', 'imago', base);
    expect(erreurs).not.toContain('stades');
  });
});

describe('validerGrille — captures = phases', () => {
  it('extensif : accepte quand la somme des phases égale les captures', () => {
    const erreurs = validerGrille('extensive', 'imago', {
      captures: 12,
      phases: { solitaire: 9, transiens: 3 },
    });
    expect(erreurs).not.toContain('phases');
  });

  it('extensif : signale les phases quand la somme diffère des captures', () => {
    const erreurs = validerGrille('extensive', 'imago', {
      captures: 12,
      phases: { solitaire: 9, transiens: 2 },
    });
    expect(erreurs).toContain('phases');
  });
});

describe('validerGrille — densité diffuse', () => {
  const base = { captures: 12, phases: { solitaire: 12 } };

  it('exige la densité diffuse quand il y a des captures', () => {
    expect(validerGrille('extensive', 'imago', base)).toContain('densiteDiffuse');
  });

  it('accepte la densité diffuse renseignée', () => {
    const erreurs = validerGrille('extensive', 'imago', { ...base, densiteDiffuse: 450 });
    expect(erreurs).not.toContain('densiteDiffuse');
  });

  it("n'exige rien sans capture", () => {
    const erreurs = validerGrille('extensive', 'imago', { captures: 0, phases: {} });
    expect(erreurs).not.toContain('densiteDiffuse');
  });
});

describe('validerGrille — interdistance', () => {
  const base = { captures: 12, phases: { solitaire: 12 }, densiteDiffuse: 450 };

  it('exige l’interdistance si l’accouplement est signalé', () => {
    const erreurs = validerGrille('extensive', 'imago', { ...base, accouplement: 'rare', ponte: 'neant' });
    expect(erreurs).toContain('interdistance');
  });

  it('exige l’interdistance si la ponte est signalée', () => {
    const erreurs = validerGrille('extensive', 'imago', { ...base, accouplement: 'neant', ponte: 'beaucoup' });
    expect(erreurs).toContain('interdistance');
  });

  it('ne l’exige pas quand accouplement et ponte sont Néant', () => {
    const erreurs = validerGrille('extensive', 'imago', { ...base, accouplement: 'neant', ponte: 'neant' });
    expect(erreurs).not.toContain('interdistance');
  });

  it('accepte l’interdistance renseignée', () => {
    const erreurs = validerGrille('extensive', 'imago', {
      ...base,
      accouplement: 'rare',
      ponte: 'neant',
      interdistance: 2.5,
    });
    expect(erreurs).not.toContain('interdistance');
  });
});

describe('validerGrille — champs obligatoires en intensif', () => {
  const base = {
    captures: 12,
    phases: { solitaire: 12 },
    stades: { F: { A4: 7 }, M: { A234: 5 } },
    densiteDiffuse: 300,
  };

  it('exige accouplement, ponte et état dès qu’il y a des captures', () => {
    const erreurs = validerGrille('intensive', 'imago', base);
    expect(erreurs).toEqual(expect.arrayContaining(['accouplement', 'ponte', 'etat']));
  });

  it('accepte quand ils sont renseignés', () => {
    const erreurs = validerGrille('intensive', 'imago', {
      ...base,
      accouplement: 'neant',
      ponte: 'neant',
      etat: 'repos',
    });
    expect(erreurs).toEqual([]);
  });

  it('ne les exige pas sans capture', () => {
    const erreurs = validerGrille('intensive', 'imago', { captures: 0, phases: {}, stades: { F: {}, M: {} } });
    expect(erreurs).toEqual([]);
  });

  it('les laisse facultatifs en extensif', () => {
    const erreurs = validerGrille('extensive', 'imago', { captures: 12, phases: { solitaire: 12 }, densiteDiffuse: 450 });
    expect(erreurs).not.toEqual(expect.arrayContaining(['accouplement']));
    expect(erreurs).not.toContain('etat');
  });
});
