import { ETAPES, NB_ETAPES, estTypeWizard, etapeDeReprise, typeDeFiche } from '@/lib/prospection-wizard';

describe('prospection-wizard', () => {
  it('déclare 5 étapes dans l’ordre de la maquette', () => {
    expect(NB_ETAPES).toBe(5);
    expect(ETAPES).toEqual(['reference', 'vegetation', 'sol', 'observations', 'recapitulatif']);
  });

  it('reconnaît les 4 types d’entrée et refuse le reste', () => {
    for (const t of ['intensive', 'extensive', 'validation', 'revalidation']) expect(estTypeWizard(t)).toBe(true);
    expect(estTypeWizard('aerien')).toBe(false);
    expect(estTypeWizard(undefined)).toBe(false);
  });

  it('affiche « revalidation » pour une fiche chaînée, sinon son type', () => {
    expect(typeDeFiche({ type_prospection: 'extensive', revalide_de_id: 'x' })).toBe('revalidation');
    expect(typeDeFiche({ type_prospection: 'intensive', revalide_de_id: null })).toBe('intensive');
  });

  it('reprend sur la première étape non renseignée', () => {
    const ref = { station_id: 's', date_prospection: '2026-09-25' };
    expect(etapeDeReprise({})).toBe(0);
    expect(etapeDeReprise(ref)).toBe(1);
    expect(etapeDeReprise({ ...ref, vegetation: { verdissement: 3 } as never })).toBe(2);
    expect(
      etapeDeReprise({ ...ref, vegetation: { a: 1 } as never, sol: { b: 1 } as never, observations: 'RAS' }),
    ).toBe(4);
  });
});
