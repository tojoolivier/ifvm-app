import {
  basculerGrille,
  basculerPhase,
  basculerStade,
  choisirAucunCriquet,
  filtreVide,
  grilleVue,
  nbGrilles,
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
    filtre = basculerStade(filtre, 'NSE', 'larve', 'L3');
    filtre = basculerPhase(filtre, 'NSE', 'larve', 'transiens');

    expect(grilleVue(filtre, 'NSE', 'larve')).toEqual({ phases: ['gregaire'], stades: ['L3'] });
  });

  it('cocher une grille annule « Aucun criquet »', () => {
    const filtre = basculerGrille(choisirAucunCriquet(filtreVide()), 'LMC', 'larve');

    expect(filtre.aucunCriquet).toBe(false);
    expect(nbGrilles(filtre)).toBe(1);
  });
});
