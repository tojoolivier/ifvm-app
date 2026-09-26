import {
  champsDeVegetation,
  creerVegetationSchema,
  defaultStrateDetail,
  repartition,
  STRATE_KEYS,
  stratesAffichees,
  valeursDeVegetation,
} from '@/lib/prospection-vegetation-schema';

/** Strates du JSON `vegetation` : toutes les clés, seul le recouvrement change. */
function strates(recouvrement: Partial<Record<(typeof STRATE_KEYS)[number], number>>) {
  return Object.fromEntries(STRATE_KEYS.map((k) => [k, { ...defaultStrateDetail(), recouvrement: recouvrement[k] ?? 0 }])) as Record<
    (typeof STRATE_KEYS)[number],
    ReturnType<typeof defaultStrateDetail>
  >;
}

describe('STRATE_KEYS', () => {
  it('garde les 6 clés du JSON vegetation, sol nu n’en fait pas partie', () => {
    expect(STRATE_KEYS).toEqual(['arboree', 'arbustive', 'buissonneuse', 'herbeuse', 'cultures_seches', 'cultures_hygro']);
  });
});

describe('repartition', () => {
  it('maquette 02b : sol nu 15 + herbeuse 55 + arbustive 15 = 85, il reste 15', () => {
    const r = repartition({ solNu: 15, strates: strates({ herbeuse: 55, arbustive: 15 }) });
    expect(r.total).toBe(85);
    expect(r.reste).toBe(15);
    expect(r.complete).toBe(false);
  });

  it('100 % exactement : complète, rien à répartir', () => {
    const r = repartition({ solNu: 20, strates: strates({ herbeuse: 80 }) });
    expect(r).toMatchObject({ total: 100, reste: 0, complete: true });
  });

  it('au-delà de 100 % : reste négatif, non complète', () => {
    const r = repartition({ solNu: 30, strates: strates({ herbeuse: 80 }) });
    expect(r).toMatchObject({ total: 110, reste: -10, complete: false });
  });

  it('sol nu non saisi (null) compte pour 0', () => {
    expect(repartition({ solNu: null, strates: strates({ herbeuse: 40 }) }).total).toBe(40);
  });
});

describe('stratesAffichees', () => {
  it('fiche vierge : seule la strate herbeuse (principale) est affichée', () => {
    expect(stratesAffichees(strates({}))).toEqual(['herbeuse']);
  });

  it('réouverture d’une fiche : la herbeuse d’abord (maquette), puis les strates renseignées dans l’ordre des clés', () => {
    expect(stratesAffichees(strates({ cultures_seches: 10, herbeuse: 55, arbustive: 15 }))).toEqual(['herbeuse', 'arbustive', 'cultures_seches']);
  });

  it('une strate ajoutée mais encore à 0 % reste affichée', () => {
    expect(stratesAffichees(strates({ herbeuse: 50 }), ['arboree'])).toEqual(['herbeuse', 'arboree']);
  });
});

describe('valeursDeVegetation (reprise d’un brouillon)', () => {
  it('relit recouvrement, H. moyenne (virgule française) et verdissement ; sol nu vient du JSON sol', () => {
    const v = valeursDeVegetation({
      vegetation: { strates: { arbustive: { ...defaultStrateDetail(), recouvrement: 15, hMoy: 1.8, verdissement: 40 } } },
      sol: { humidite: 'surface', solNu: 15 },
    });
    expect(v.solNu).toBe(15);
    expect(v.strates.arbustive).toEqual({ recouvrement: 15, hMoy: '1,8', verdissement: '40' });
    expect(v.strates.herbeuse).toEqual({ recouvrement: 0, hMoy: '', verdissement: '' });
  });

  it('brouillon sans végétation : tout à 0, sol nu à 0', () => {
    const v = valeursDeVegetation({ vegetation: null, sol: null });
    expect(v.solNu).toBe(0);
    expect(STRATE_KEYS.every((k) => v.strates[k].recouvrement === 0)).toBe(true);
  });
});

describe('champsDeVegetation (enregistrement)', () => {
  const brouillon = {
    vegetation: { strates: { herbeuse: { ...defaultStrateDetail(), recouvrement: 40, orpad: ['Rare'], repousse: true } } },
    sol: { humidite: 'surface', texture: ['limoneuse'], solNu: 5 },
  };

  it('garde les 6 clés du JSON, convertit les textes en nombres et une strate non ajoutée reste par défaut', () => {
    const v = valeursDeVegetation(brouillon);
    v.strates.arbustive = { recouvrement: 15, hMoy: '1,8', verdissement: '' };
    const { vegetation } = champsDeVegetation(brouillon, v);
    const strates = (vegetation as { strates: Record<string, unknown> }).strates;
    expect(Object.keys(strates)).toEqual([...STRATE_KEYS]);
    expect(strates.arbustive).toEqual({ ...defaultStrateDetail(), recouvrement: 15, hMoy: 1.8 });
    expect(strates.arboree).toEqual(defaultStrateDetail());
  });

  it('conserve les champs que l’écran ne gère pas (ORPAD, repousse) et le reste du JSON sol', () => {
    const v = valeursDeVegetation(brouillon);
    v.solNu = 20;
    const { vegetation, sol } = champsDeVegetation(brouillon, v);
    expect((vegetation as { strates: { herbeuse: unknown } }).strates.herbeuse).toMatchObject({ orpad: ['Rare'], repousse: true, recouvrement: 40 });
    expect(sol).toEqual({ humidite: 'surface', texture: ['limoneuse'], solNu: 20 });
  });
});

describe('champsDeVegetation — strate retirée', () => {
  it('une strate à 0 %, sans hauteur ni verdissement, repasse à ses valeurs par défaut (plus d’ORPAD hérité)', () => {
    const brouillon = { vegetation: { strates: { arbustive: { ...defaultStrateDetail(), recouvrement: 15, orpad: ['Rare'], surfRel: 30 } } }, sol: null };
    const v = valeursDeVegetation(brouillon);
    v.strates.arbustive = { recouvrement: 0, hMoy: '', verdissement: '' };
    const strates = (champsDeVegetation(brouillon, v).vegetation as { strates: Record<string, unknown> }).strates;
    expect(strates.arbustive).toEqual(defaultStrateDetail());
  });
});

describe('creerVegetationSchema', () => {
  const schema = creerVegetationSchema((cle) => cle);
  const valeurs = (arbustive: Partial<{ hMoy: string; verdissement: string }>) => {
    const v = valeursDeVegetation({});
    v.strates.arbustive = { recouvrement: 15, hMoy: '', verdissement: '', ...arbustive };
    return v;
  };

  it('accepte des champs vides (facultatifs) et des nombres à virgule française', () => {
    expect(schema.isValidSync(valeurs({}))).toBe(true);
    expect(schema.isValidSync(valeurs({ hMoy: '1,8', verdissement: '60' }))).toBe(true);
  });

  it('refuse une H. moyenne non numérique ou négative', () => {
    expect(schema.isValidSync(valeurs({ hMoy: 'abc' }))).toBe(false);
    expect(schema.isValidSync(valeurs({ hMoy: '-1' }))).toBe(false);
  });

  it('refuse un verdissement hors 0–100 %', () => {
    expect(schema.isValidSync(valeurs({ verdissement: '120' }))).toBe(false);
    expect(schema.isValidSync(valeurs({ verdissement: '100' }))).toBe(true);
  });
});
