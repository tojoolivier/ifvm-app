import { referenceSchema } from '../src/lib/prospection-reference-schema';

describe('referenceSchema', () => {
  it('valide des surfaces cohérentes (infestée <= prospectée <= station)', async () => {
    await expect(
      referenceSchema.validate({ surfaceStation: '12', surfaceProspectee: '8.5', surfaceInfestee: '1' })
    ).resolves.toBeTruthy();
  });

  it('rejette une surface prospectée supérieure à la surface station', async () => {
    await expect(
      referenceSchema.validate({ surfaceStation: '5', surfaceProspectee: '8', surfaceInfestee: '1' })
    ).rejects.toThrow();
  });

  it('rejette une surface infestée supérieure à la surface prospectée', async () => {
    await expect(
      referenceSchema.validate({ surfaceStation: '12', surfaceProspectee: '5', surfaceInfestee: '8' })
    ).rejects.toThrow();
  });

  it('rejette une surface station manquante', async () => {
    await expect(
      referenceSchema.validate({ surfaceStation: '', surfaceProspectee: '5', surfaceInfestee: '1' })
    ).rejects.toThrow();
  });

  it("accepte une surface infestée absente (facultative, 0 par défaut)", async () => {
    await expect(
      referenceSchema.validate({ surfaceStation: '12', surfaceProspectee: '8.5', surfaceInfestee: '' })
    ).resolves.toBeTruthy();
  });

  it('rejette une surface infestée négative', async () => {
    await expect(
      referenceSchema.validate({ surfaceStation: '12', surfaceProspectee: '8.5', surfaceInfestee: '-1' })
    ).rejects.toThrow();
  });
});
