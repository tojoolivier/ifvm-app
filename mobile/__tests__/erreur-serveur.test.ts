// api-client tire expo-secure-store (RN) : on n'a besoin que de la lecture du statut.
jest.mock('../src/lib/api-client', () => ({
  statutHttpDe: (e: { status?: number } | null) => (typeof e?.status === 'number' ? e.status : null),
}));

import { messageRefusServeur } from '../src/lib/erreur-serveur';
import { AuthError, NetworkError } from '../src/lib/errors';

function http(status: number, message: string) {
  const erreur = new NetworkError(message);
  (erreur as unknown as { status: number }).status = status;
  return erreur;
}

describe('messageRefusServeur', () => {
  it('rend le message du serveur pour un refus métier (409, 422…)', () => {
    expect(messageRefusServeur(http(409, 'immatriculation déjà utilisée'))).toBe('immatriculation déjà utilisée');
    expect(messageRefusServeur(http(422, 'l’affectation chevauche une autre'))).toBe('l’affectation chevauche une autre');
  });

  it('remplace le message générique d’un corps sans detail par une phrase française', () => {
    expect(messageRefusServeur(http(409, 'HTTP error! status: 409'))).toMatch(/existe déjà|conflit/i);
    expect(messageRefusServeur(http(403, 'HTTP error! status: 403'))).toMatch(/refusée/i);
  });

  it('laisse passer les vraies pannes : pas de statut, 5xx, timeout, session expirée', () => {
    expect(messageRefusServeur(new NetworkError('Network request failed'))).toBeNull();
    expect(messageRefusServeur(http(500, 'boom'))).toBeNull();
    expect(messageRefusServeur(http(429, 'trop de requêtes'))).toBeNull();
    expect(messageRefusServeur(new AuthError('expirée'))).toBeNull();
    expect(messageRefusServeur(new Error('bug'))).toBeNull();
  });
});
