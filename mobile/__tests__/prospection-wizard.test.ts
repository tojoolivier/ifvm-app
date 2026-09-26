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
    const faite = { ...ref, vegetation: { a: 1 } as never, sol: { b: 1 } as never };
    expect(etapeDeReprise(faite)).toBe(3);
    expect(etapeDeReprise(faite, { aucunCriquet: true, grilles: {} })).toBe(4);
  });

  describe('reprise d’un brouillon (#689, #688)', () => {
    const ref = { station_id: 's', date_prospection: '2026-09-25' };

    it('intensif : sol ne contenant que solNu (écrit par la Végétation) n’est pas « fait » — la reprise s’arrête sur l’étape Sol', () => {
      const fiche = { ...ref, type_prospection: 'intensive' as const, vegetation: { strates: { herbeuse: { recouvrement: 80 } } } as never, sol: { solNu: 20 } as never };
      expect(etapeDeReprise(fiche)).toBe(2);
    });

    it('intensif : humidité seule ne suffit pas, humidité et texture oui', () => {
      const base = { ...ref, type_prospection: 'intensive' as const, vegetation: { strates: { herbeuse: { recouvrement: 80 } } } as never };
      const filtre = { aucunCriquet: false, grilles: { 'LMC:imago': { phases: ['solitaire'], stades: { F: ['A4'], M: [], sans_sexe: [] } } } };
      expect(etapeDeReprise({ ...base, sol: { solNu: 20, humidite: ['surface'] } as never }, filtre)).toBe(2);
      expect(etapeDeReprise({ ...base, sol: { solNu: 20, humidite: ['surface'], texture: ['bloc'] } as never }, filtre)).toBe(4);
    });

    it('extensif : la Végétation est « faite » dès qu’une de ses colonnes est saisie (pas de JSON vegetation)', () => {
      const base = { ...ref, type_prospection: 'extensive' as const };
      expect(etapeDeReprise(base)).toBe(1);
      expect(etapeDeReprise({ ...base, hauteur_herbe_cm: 40 })).toBe(2);
      expect(etapeDeReprise({ ...base, verdissement_pourcent: 0 })).toBe(2);
      expect(etapeDeReprise({ ...base, degats_cultures: 'nuls' })).toBe(2);
    });
  });
});
