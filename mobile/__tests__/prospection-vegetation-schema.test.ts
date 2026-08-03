import { vegetationSchema } from '../src/lib/prospection-vegetation-schema';

const VALID_STRATE = { surfRel: 20, hMoy: 1.2, recouvrement: 70, verdissement: 30, repousse: 10, orpad: ['Fleur'], solNu: 5 };

describe('vegetationSchema', () => {
  it('valide un formulaire complet', async () => {
    await expect(
      vegetationSchema.validate({
        strate: VALID_STRATE,
        humidite: '5_12cm',
        texture: 'limoneuse',
        degatsCultures: 'moyens',
        ennemis: 'oiseaux',
        observation: 'RAS',
      })
    ).resolves.toBeTruthy();
  });

  it('rejette si une option requise est manquante', async () => {
    await expect(
      vegetationSchema.validate({ strate: VALID_STRATE, humidite: null, texture: 'limoneuse', degatsCultures: 'moyens' })
    ).rejects.toThrow();
  });

  it('rejette un recouvrement de strate hors bornes', async () => {
    await expect(
      vegetationSchema.validate({
        strate: { ...VALID_STRATE, recouvrement: 150 },
        humidite: '5_12cm',
        texture: 'limoneuse',
        degatsCultures: 'moyens',
      })
    ).rejects.toThrow();
  });

  it('accepte ennemis/observation absents (facultatifs)', async () => {
    await expect(
      vegetationSchema.validate({ strate: VALID_STRATE, humidite: '5_12cm', texture: 'limoneuse', degatsCultures: 'moyens' })
    ).resolves.toBeTruthy();
  });
});
