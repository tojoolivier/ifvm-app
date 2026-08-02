import { vegetationSchema } from '../src/lib/prospection-vegetation-schema';

describe('vegetationSchema', () => {
  it('valide un formulaire complet', async () => {
    await expect(
      vegetationSchema.validate({ recouvrement: 70, humidite: '5_12cm', texture: 'limoneuse', degatsCultures: 'moyens' })
    ).resolves.toBeTruthy();
  });

  it('rejette si une option requise est manquante', async () => {
    await expect(
      vegetationSchema.validate({ recouvrement: 70, humidite: null, texture: 'limoneuse', degatsCultures: 'moyens' })
    ).rejects.toThrow();
  });

  it('rejette un recouvrement hors bornes', async () => {
    await expect(
      vegetationSchema.validate({ recouvrement: 150, humidite: '5_12cm', texture: 'limoneuse', degatsCultures: 'moyens' })
    ).rejects.toThrow();
  });
});
