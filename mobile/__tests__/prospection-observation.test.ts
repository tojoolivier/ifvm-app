import {
  basculerGrille,
  basculerPhase,
  basculerStade,
  basculerTousLesStades,
  choisirAucunCriquet,
  filtreVide,
  grilleVue,
  nbGrilles,
  stadesAffiches,
} from '@/lib/prospection-observation';

describe('filtre « Qu\'avez-vous observé ? »', () => {
  it('compte une grille cochée', () => {
    const filtre = basculerGrille(filtreVide(), 'LMC', 'imago');

    expect(nbGrilles(filtre)).toBe(1);
  });

  it('décoche une grille déjà cochée', () => {
    const cochee = basculerGrille(filtreVide(), 'LMC', 'imago');

    expect(nbGrilles(basculerGrille(cochee, 'LMC', 'imago'))).toBe(0);
  });

  it('« Aucun criquet » décoche toutes les grilles', () => {
    const cochees = basculerGrille(basculerGrille(filtreVide(), 'LMC', 'imago'), 'NSE', 'larve');

    const filtre = choisirAucunCriquet(cochees);

    expect(filtre.aucunCriquet).toBe(true);
    expect(nbGrilles(filtre)).toBe(0);
  });

  it('coche puis décoche une phase et un stade d\'une grille cochée', () => {
    let filtre = basculerGrille(filtreVide(), 'NSE', 'larve');
    filtre = basculerPhase(filtre, 'NSE', 'larve', 'transiens');
    filtre = basculerPhase(filtre, 'NSE', 'larve', 'gregaire');
    filtre = basculerStade(filtre, 'NSE', 'larve', 'sans_sexe', 'L3');
    filtre = basculerPhase(filtre, 'NSE', 'larve', 'transiens');

    expect(grilleVue(filtre, 'NSE', 'larve')).toEqual({
      phases: ['gregaire'],
      stades: { F: [], M: [], sans_sexe: ['L3'] },
    });
  });

  it('garde les stades vus séparés par sexe : A4 chez les femelles n\'est pas A4 chez les mâles', () => {
    let filtre = basculerGrille(filtreVide(), 'LMC', 'imago');
    filtre = basculerStade(filtre, 'LMC', 'imago', 'F', 'A4');
    filtre = basculerStade(filtre, 'LMC', 'imago', 'M', 'A234');
    filtre = basculerStade(filtre, 'LMC', 'imago', 'F', 'A5');
    filtre = basculerStade(filtre, 'LMC', 'imago', 'F', 'A4');

    expect(grilleVue(filtre, 'LMC', 'imago')?.stades).toEqual({ F: ['A5'], M: ['A234'], sans_sexe: [] });
  });

  it('cocher une grille annule « Aucun criquet »', () => {
    const filtre = basculerGrille(choisirAucunCriquet(filtreVide()), 'LMC', 'larve');

    expect(filtre.aucunCriquet).toBe(false);
    expect(nbGrilles(filtre)).toBe(1);
  });

  describe('basculerTousLesStades', () => {
    const codes = ['A1', 'A2', 'A3', 'A4', 'A5'];
    const grille = () => basculerGrille(filtreVide(), 'LMC', 'imago');
    const femelles = (filtre: ReturnType<typeof filtreVide>) => grilleVue(filtre, 'LMC', 'imago')?.stades.F;

    it('coche tous les stades d\'un sexe, dans l\'ordre donné, sans toucher à l\'autre sexe', () => {
      let filtre = basculerStade(grille(), 'LMC', 'imago', 'M', 'A234');
      filtre = basculerStade(filtre, 'LMC', 'imago', 'F', 'A4');

      filtre = basculerTousLesStades(filtre, 'LMC', 'imago', 'F', codes);

      expect(femelles(filtre)).toEqual(['A1', 'A2', 'A3', 'A4', 'A5']);
      expect(grilleVue(filtre, 'LMC', 'imago')?.stades.M).toEqual(['A234']);
    });

    it('les décoche tous quand ils sont déjà tous cochés', () => {
      const tous = basculerTousLesStades(grille(), 'LMC', 'imago', 'F', codes);

      expect(femelles(basculerTousLesStades(tous, 'LMC', 'imago', 'F', codes))).toEqual([]);
    });
  });

  describe('stadesAffiches', () => {
    const referentiel = ['A1', 'A2', 'A3', 'A3-1/4', 'A3-1/2', 'A3-3/4', 'A3-4/4', 'A4', 'A5'].map((code) => ({ code, libelle: code }));

    it('intensif : tout le référentiel, quarts de A3 compris', () => {
      expect(stadesAffiches('intensive', referentiel).map((s) => s.code)).toEqual(referentiel.map((s) => s.code));
    });

    it.each(['extensive', 'validation'] as const)('%s : sans les quarts de A3, dans l\'ordre du référentiel', (type) => {
      expect(stadesAffiches(type, referentiel).map((s) => s.code)).toEqual(['A1', 'A2', 'A3', 'A4', 'A5']);
    });
  });
});
