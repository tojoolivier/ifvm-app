import { FONT_SCALE_FACTORS, scaleTypeSizes } from '../src/lib/typography';

describe('scaleTypeSizes', () => {
  it('multiplies every value by the scale, rounded to a tenth of a pixel', () => {
    const base = { label: 12, corps: 11.5, titreEcran: 15 };

    const result = scaleTypeSizes(base, FONT_SCALE_FACTORS.grande);

    expect(result).toEqual({ label: 13.8, corps: 13.2, titreEcran: 17.3 });
  });

  it('leaves values unchanged at "normale" (scale = 1)', () => {
    const base = { label: 12, corps: 11.5 };

    expect(scaleTypeSizes(base, FONT_SCALE_FACTORS.normale)).toEqual(base);
  });

  it('shrinks every value at "petite"', () => {
    const base = { label: 12, corps: 11.5 };

    expect(scaleTypeSizes(base, FONT_SCALE_FACTORS.petite)).toEqual({ label: 10.8, corps: 10.4 });
  });
});
