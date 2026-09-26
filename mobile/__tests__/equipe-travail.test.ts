import { useEquipeTravailStore } from '../src/lib/equipe-travail-store';
import { PreconditionError } from '../src/lib/errors';
import { getEquipeLocale } from '../src/lib/referentiel-db';
import { equipeDeTravailPour } from '../src/lib/equipe-travail';

jest.mock('../src/lib/storage', () => ({
  storage: { getItem: jest.fn(), setItem: jest.fn(), deleteItem: jest.fn() },
}));
jest.mock('../src/lib/referentiel-db', () => ({ getEquipeLocale: jest.fn() }));

const mockGetEquipeLocale = jest.mocked(getEquipeLocale);

const AERIENNE = { id: 'eq-air', nom: 'Équipe Sud', type: 'aerien' as const, nb_membres: 4 };
const TERRESTRE = { id: 'eq-ter', nom: 'EMT Toliara', type: 'terrestre' as const, nb_membres: 5 };

beforeEach(() => {
  jest.resetAllMocks();
  useEquipeTravailStore.setState({ equipeId: null });
});

describe('equipeDeTravailPour', () => {
  it('rend null sans équipe de travail : la saisie hors-ligne reste possible', async () => {
    expect(await equipeDeTravailPour('terrestre')).toBeNull();
    expect(mockGetEquipeLocale).not.toHaveBeenCalled();
  });

  it('rend l’id de l’équipe de travail quand son type convient', async () => {
    useEquipeTravailStore.setState({ equipeId: 'eq-ter' });
    mockGetEquipeLocale.mockResolvedValue(TERRESTRE);

    expect(await equipeDeTravailPour('terrestre')).toBe('eq-ter');
  });

  it('bloque une équipe aérienne pour une saisie terrestre, en renvoyant vers Paramètres', async () => {
    useEquipeTravailStore.setState({ equipeId: 'eq-air' });
    mockGetEquipeLocale.mockResolvedValue(AERIENNE);

    await expect(equipeDeTravailPour('terrestre')).rejects.toThrow(PreconditionError);
    await expect(equipeDeTravailPour('terrestre')).rejects.toThrow(/Paramètres/);
  });

  it('bloque une équipe terrestre pour une saisie aérienne', async () => {
    useEquipeTravailStore.setState({ equipeId: 'eq-ter' });
    mockGetEquipeLocale.mockResolvedValue(TERRESTRE);

    await expect(equipeDeTravailPour('aerien')).rejects.toThrow(/aérienne/);
  });

  it('ne bloque pas quand l’équipe n’est plus dans le référentiel local', async () => {
    useEquipeTravailStore.setState({ equipeId: 'eq-inconnue' });
    mockGetEquipeLocale.mockResolvedValue(null);

    expect(await equipeDeTravailPour('terrestre')).toBe('eq-inconnue');
  });
});
