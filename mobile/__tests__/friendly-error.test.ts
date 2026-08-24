/**
 * `toFriendlyError` — ADR-012 décision 5, issue #172.
 *
 * Deux décisions sont protégées ici, et non « simplifiables » :
 *
 * 1. **Aucune regex sur `error.message`.** L'ancienne version testait
 *    `/network request failed|fetch/i` sur un message anglais produit par le
 *    moteur : elle se cassait au premier changement de version de RN, et
 *    laissait passer une `NetworkError` typée dont le message était français.
 *    La décision est `instanceof`, comme partout ailleurs dans ADR-012.
 * 2. **Aucun message JS brut n'atteint l'agent.** L'ancien
 *    `return { message: raw }` affichait « undefined is not an object » à un
 *    agent en brousse. Le brut reste dans `detail`, pour le support.
 */
import {
  AuthError,
  LocalReadError,
  LocalWriteError,
  NetworkError,
  PermissionError,
  PreconditionError,
  ReferentialError,
} from '@/lib/errors';
import { toFriendlyError } from '@/lib/friendly-error';

describe('toFriendlyError — un message et une action par classe', () => {
  it.each([
    [new NetworkError('boom'), 'NetworkError', 'reessayer'],
    [new LocalWriteError('boom'), 'LocalWriteError', 'reessayer-enregistrer'],
    [new AuthError('boom'), 'AuthError', 'se-reconnecter'],
    [new PermissionError('boom'), 'PermissionError', 'ouvrir-reglages'],
    [new ReferentialError('boom'), 'ReferentialError', 'synchroniser-referentiels'],
    [new LocalReadError('boom'), 'LocalReadError', 'signaler-support'],
  ])('%p porte sa propre action', (error, classe, action) => {
    const affichable = toFriendlyError(error);
    expect(affichable.classe).toBe(classe);
    expect(affichable.action).toBe(action);
  });

  it('une erreur non typée est un bug : action « signaler au support »', () => {
    expect(toFriendlyError(new TypeError('undefined is not an object'))).toMatchObject({
      classe: '(bug)',
      action: 'signaler-support',
    });
  });

  it('PreconditionError n’a aucune action — son message dit déjà quoi faire', () => {
    expect(toFriendlyError(new PreconditionError('Brouillon introuvable.')).action).toBeNull();
  });
});

describe('toFriendlyError — le message montré à l’agent', () => {
  it('affiche verbatim le message de PreconditionError, écrit par le développeur', () => {
    const message = 'Brouillon introuvable — reprenez la fiche.';
    expect(toFriendlyError(new PreconditionError(message)).message).toBe(message);
  });

  it.each([
    new NetworkError('Network request failed'),
    new LocalReadError('no such column: phase'),
    new TypeError('undefined is not an object (evaluating \'x.y\')'),
  ])('ne laisse jamais fuir le message brut dans le message affiché (%p)', (error) => {
    const { message, detail } = toFriendlyError(error);
    expect(message).not.toContain((error as Error).message);
    expect(detail).toBe((error as Error).message);
  });

  it('ne décide pas par regex : un message anglais « network » n’est pas une NetworkError', () => {
    // Un bug dont le message contient « fetch » était traduit en « Connexion au
    // serveur impossible » par l'ancienne version — un diagnostic faux.
    expect(toFriendlyError(new Error('failed to fetch config')).classe).toBe('(bug)');
    expect(toFriendlyError(new Error('failed to fetch config')).action).toBe('signaler-support');
  });

  it('accepte une valeur qui n’est pas une Error sans planter', () => {
    const { message, detail, classe } = toFriendlyError('chaîne nue');
    expect(classe).toBe('(bug)');
    expect(message).toBeTruthy();
    expect(detail).toBe('chaîne nue');
  });

  it('un message vide ne produit pas un detail vide affiché comme message', () => {
    expect(toFriendlyError(new Error('')).message).toBeTruthy();
  });
});
