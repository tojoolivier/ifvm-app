/** Dérivation des erreurs de formulaire depuis un schéma Yup (#721). */
import * as yup from 'yup';
import { deriverErreurs, erreursDuSchema, messageErreur, premierMessage } from '@/lib/form-errors';

const schema = yup.object({
  recouvrement: yup.number().required('Recouvrement requis'),
  largeur: yup.number().typeError('Largeur invalide').required('Largeur requise').min(1, 'Au moins 1 m'),
});
const libelles = { recouvrement: 'Recouvrement', largeur: 'Largeur' };

describe('messageErreur / premierMessage', () => {
  it('lit une chaîne ou une issue Standard Schema', () => {
    expect(messageErreur('Requis')).toBe('Requis');
    expect(messageErreur({ message: 'Requis' })).toBe('Requis');
    expect(messageErreur(42)).toBeUndefined();
    expect(premierMessage([undefined, { message: 'A' }, 'B'])).toBe('A');
    expect(premierMessage(undefined)).toBeUndefined();
  });
});

describe('erreursDuSchema', () => {
  it('renvoie {} pour des valeurs valides', () => {
    expect(erreursDuSchema(schema, { recouvrement: 10, largeur: 2 })).toEqual({});
  });

  it('garde la première erreur de chaque champ', () => {
    expect(erreursDuSchema(schema, { recouvrement: undefined, largeur: 0 })).toEqual({
      recouvrement: 'Recouvrement requis',
      largeur: 'Au moins 1 m',
    });
  });
});

describe('deriverErreurs', () => {
  it('liste les champs manquants dans l’ordre des libellés, avec le résumé', () => {
    const r = deriverErreurs(schema, { recouvrement: undefined, largeur: undefined }, libelles);
    expect(r.manques).toEqual(['Recouvrement', 'Largeur']);
    expect(r.resume).toEqual(['Recouvrement requis', 'Largeur requise']);
  });

  it('ne liste rien quand tout est valide', () => {
    const r = deriverErreurs(schema, { recouvrement: 5, largeur: 3 }, libelles);
    expect(r).toEqual({ parChamp: {}, manques: [], resume: [] });
  });
});
