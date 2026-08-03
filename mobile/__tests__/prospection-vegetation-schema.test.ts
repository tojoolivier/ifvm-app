import { vegetationSchema } from '../src/lib/prospection-vegetation-schema';

describe('vegetationSchema', () => {
  it('valide un formulaire complet', async () => {
    await expect(vegetationSchema.validate({ humidite: '5_12cm', texture: 'limoneuse' })).resolves.toBeTruthy();
  });

  it('rejette si humidité est manquante', async () => {
    await expect(vegetationSchema.validate({ humidite: null, texture: 'limoneuse' })).rejects.toThrow();
  });

  it('rejette si texture est manquante', async () => {
    await expect(vegetationSchema.validate({ humidite: '5_12cm', texture: null })).rejects.toThrow();
  });
});
