import { storage } from '../src/lib/storage';
import { LocalReadError, LocalWriteError } from '../src/lib/errors';

const getItemAsync = jest.fn();
const setItemAsync = jest.fn();
const deleteItemAsync = jest.fn();

// `storage` importe `Platform` : sans ce mock, la suite `logic` (environnement
// node) chargerait tout react-native.
jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: (...args: unknown[]) => getItemAsync(...args),
  setItemAsync: (...args: unknown[]) => setItemAsync(...args),
  deleteItemAsync: (...args: unknown[]) => deleteItemAsync(...args),
}));

beforeEach(() => {
  getItemAsync.mockReset();
  setItemAsync.mockReset();
  deleteItemAsync.mockReset();
});

/*
 * `storage` est l'adaptateur du stockage sécurisé. Il ne décide rien : il
 * traduit une panne du magasin en classe du jeu fermé, et laisse l'appelant
 * choisir entre subir, taire ou remonter (ADR-012 décision 2, issue #173).
 */
describe('storage', () => {
  it('rend la valeur lue', async () => {
    getItemAsync.mockResolvedValueOnce('valeur');

    await expect(storage.getItem('cle')).resolves.toBe('valeur');
  });

  it('rend null quand la clé est absente — une absence n’est pas une panne', async () => {
    getItemAsync.mockResolvedValueOnce(null);

    await expect(storage.getItem('cle')).resolves.toBeNull();
  });

  /*
   * Le `catch { return null }` d'origine rendait « magasin en panne »
   * indiscernable de « clé absente » : au démarrage, l'agent était déconnecté
   * sans que rien ne dise pourquoi (ADR-012 décision 1).
   */
  it('lève LocalReadError quand la lecture échoue, au lieu de rendre null', async () => {
    getItemAsync.mockRejectedValueOnce(new Error('keystore unavailable'));

    await expect(storage.getItem('cle')).rejects.toBeInstanceOf(LocalReadError);
  });

  it('lève LocalWriteError quand l’écriture échoue', async () => {
    setItemAsync.mockRejectedValueOnce(new Error('keystore unavailable'));

    await expect(storage.setItem('cle', 'valeur')).rejects.toBeInstanceOf(
      LocalWriteError
    );
  });

  it('lève LocalWriteError quand la suppression échoue, au lieu de la taire', async () => {
    deleteItemAsync.mockRejectedValueOnce(new Error('keystore unavailable'));

    await expect(storage.deleteItem('cle')).rejects.toBeInstanceOf(
      LocalWriteError
    );
  });
});
