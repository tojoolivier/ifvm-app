import { useEquipeTravailStore } from '../src/lib/equipe-travail-store';
import { storage } from '../src/lib/storage';

jest.mock('../src/lib/storage', () => ({
  storage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    deleteItem: jest.fn(),
  },
}));

const mockStorage = jest.mocked(storage);

beforeEach(() => {
  jest.resetAllMocks();
  useEquipeTravailStore.setState({ equipeId: null, isInitialized: false });
});

describe('useEquipeTravailStore', () => {
  it('démarre sans équipe de travail quand rien n’est persisté pour cet utilisateur', async () => {
    mockStorage.getItem.mockResolvedValueOnce(null);

    await useEquipeTravailStore.getState().init('user-1');

    expect(mockStorage.getItem).toHaveBeenCalledWith('equipe_travail_user-1');
    expect(useEquipeTravailStore.getState().equipeId).toBeNull();
    expect(useEquipeTravailStore.getState().isInitialized).toBe(true);
  });

  it('relit l’équipe persistée pour cet utilisateur', async () => {
    mockStorage.getItem.mockResolvedValueOnce('eq-1');

    await useEquipeTravailStore.getState().init('user-1');

    expect(useEquipeTravailStore.getState().equipeId).toBe('eq-1');
  });

  it('persiste le choix sous une clé propre à l’utilisateur', async () => {
    await useEquipeTravailStore.getState().setEquipe('user-42', 'eq-2');

    expect(mockStorage.setItem).toHaveBeenCalledWith('equipe_travail_user-42', 'eq-2');
    expect(useEquipeTravailStore.getState().equipeId).toBe('eq-2');
  });

  it('efface le choix persisté quand on retire l’équipe', async () => {
    useEquipeTravailStore.setState({ equipeId: 'eq-2' });

    await useEquipeTravailStore.getState().setEquipe('user-42', null);

    expect(mockStorage.deleteItem).toHaveBeenCalledWith('equipe_travail_user-42');
    expect(useEquipeTravailStore.getState().equipeId).toBeNull();
  });
});
