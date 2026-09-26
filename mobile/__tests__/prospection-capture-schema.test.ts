import { erreursDuSchema } from '../src/lib/form-errors';
import { creerCaptureSchema, type CaptureValeurs } from '../src/lib/prospection-capture-schema';

const t = (cle: string) => cle;

const valides: CaptureValeurs = {
  captures: '12',
  phases: { solitaire: 9, transiens: 3 },
  stades: { F: { A4: 4, A5: 3 }, M: { A234: 5 } },
  densiteDiffuse: '300',
  densiteGroupee: '',
  accouplement: 'neant',
  ponte: 'neant',
  interdistance: '',
  etat: 'repos',
};

describe('creerCaptureSchema', () => {
  it('accepte une grille intensive complète', () => {
    expect(erreursDuSchema(creerCaptureSchema('intensive', 'imago', t), valides)).toEqual({});
  });

  it('rapporte toutes les erreurs de règle, chacune sur son champ', () => {
    const erreurs = erreursDuSchema(creerCaptureSchema('intensive', 'imago', t), {
      ...valides,
      phases: { solitaire: 9 },
      densiteDiffuse: '',
      etat: null,
    });
    expect(erreurs).toEqual({
      phases: 'prospection.capture.erreurs.phases',
      densiteDiffuse: 'prospection.capture.erreurs.densiteDiffuse',
      etat: 'prospection.capture.erreurs.etat',
    });
  });

  it('lit la virgule française', () => {
    const v = { ...valides, densiteDiffuse: '1 200,5' };
    expect(erreursDuSchema(creerCaptureSchema('intensive', 'imago', t), v)).toEqual({});
  });
});
