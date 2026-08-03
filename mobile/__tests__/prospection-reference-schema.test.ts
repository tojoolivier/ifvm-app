import { referenceSchema } from '../src/lib/prospection-reference-schema';

describe('referenceSchema', () => {
  it('valide des surfaces cohérentes (infestée <= prospectée <= station)', async () => {
    await expect(
      referenceSchema.validate({ surfStation: '12', surfProspectee: '8.5', surfInfestee: '1' })
    ).resolves.toBeTruthy();
  });

  it('rejette une surface prospectée supérieure à la surface station', async () => {
    await expect(
      referenceSchema.validate({ surfStation: '5', surfProspectee: '8', surfInfestee: '1' })
    ).rejects.toThrow();
  });

  it('rejette une surface infestée supérieure à la surface prospectée', async () => {
    await expect(
      referenceSchema.validate({ surfStation: '12', surfProspectee: '5', surfInfestee: '8' })
    ).rejects.toThrow();
  });

  it('rejette une surface station manquante', async () => {
    await expect(
      referenceSchema.validate({ surfStation: '', surfProspectee: '5', surfInfestee: '1' })
    ).rejects.toThrow();
  });
});
