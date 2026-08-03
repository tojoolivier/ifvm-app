import { observationsSchema } from '../src/lib/prospection-observations-schema';

describe('observationsSchema', () => {
  it('valide un formulaire complet', async () => {
    await expect(
      observationsSchema.validate({
        degatsCultures: 'moyens',
        ennemisSelected: ['Oiseaux'],
        ennemisAutre: '',
        observation: 'RAS',
      })
    ).resolves.toBeTruthy();
  });

  it('rejette si dégâts sur culture est manquant', async () => {
    await expect(
      observationsSchema.validate({ degatsCultures: null, ennemisSelected: [], ennemisAutre: '', observation: '' })
    ).rejects.toThrow();
  });

  it('accepte ennemis/observation absents (facultatifs)', async () => {
    await expect(
      observationsSchema.validate({ degatsCultures: 'nuls', ennemisSelected: [], ennemisAutre: '', observation: '' })
    ).resolves.toBeTruthy();
  });
});
