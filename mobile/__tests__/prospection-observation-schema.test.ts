import { basculerGrille, basculerPhase, basculerStade, choisirAucunCriquet, filtreVide } from '@/lib/prospection-observation';
import i18n from '@/lib/i18n';
import { creerObservationSchema } from '@/lib/prospection-observation-schema';

const t = (cle: string) => cle;
const messages = async (filtre: unknown) => {
  try {
    await creerObservationSchema(t).validate(filtre, { abortEarly: false });
    return [];
  } catch (e) {
    return (e as { errors: string[] }).errors;
  }
};

describe('schéma « Qu\'avez-vous observé ? »', () => {
  it('refuse un filtre où rien n\'est choisi', async () => {
    expect(await messages(filtreVide())).toEqual(['prospection.observation.erreurs.choix']);
  });

  it('refuse une grille cochée sans phase vue ni stade vu', async () => {
    const filtre = basculerGrille(filtreVide(), 'LMC', 'imago');

    expect(await messages(filtre)).toEqual([
      'prospection.observation.erreurs.phases',
      'prospection.observation.erreurs.stades',
    ]);
  });

  it('accepte une grille avec au moins une phase et un stade', async () => {
    let filtre = basculerGrille(filtreVide(), 'LMC', 'imago');
    filtre = basculerPhase(filtre, 'LMC', 'imago', 'solitaire');
    filtre = basculerStade(filtre, 'LMC', 'imago', 'F', 'A4');

    expect(await messages(filtre)).toEqual([]);
  });

  it('accepte une grille dont le seul stade vu est côté mâle', async () => {
    let filtre = basculerGrille(filtreVide(), 'LMC', 'imago');
    filtre = basculerPhase(filtre, 'LMC', 'imago', 'gregaire');
    filtre = basculerStade(filtre, 'LMC', 'imago', 'M', 'A234');

    expect(await messages(filtre)).toEqual([]);
  });

  it('accepte « Aucun criquet observé »', async () => {
    expect(await messages(choisirAucunCriquet(filtreVide()))).toEqual([]);
  });

  it('parle français : chaque message d\'erreur est une vraie traduction, pas une clé brute', async () => {
    const schema = creerObservationSchema((cle) => i18n.t(cle as never));
    const erreursDe = async (filtre: unknown) => {
      try {
        await schema.validate(filtre, { abortEarly: false });
        return [];
      } catch (e) {
        return (e as { errors: string[] }).errors;
      }
    };

    expect(await erreursDe(filtreVide())).toEqual(['Cochez au moins une grille, ou « Aucun criquet observé ».']);
    expect(await erreursDe(basculerGrille(filtreVide(), 'LMC', 'imago'))).toEqual([
      'Cochez au moins une phase vue par grille.',
      'Cochez au moins un stade vu par grille.',
    ]);
  });
});
