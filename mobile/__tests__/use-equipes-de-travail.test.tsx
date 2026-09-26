import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useEquipesDeTravail } from '../src/hooks/use-equipes-de-travail';
import { useAuthStore } from '../src/lib/auth-store';
import { useEquipeTravailStore } from '../src/lib/equipe-travail-store';
import { listEquipesDeUtilisateur, listToutesEquipes } from '../src/lib/referentiel-db';

jest.mock('../src/lib/storage', () => ({
  storage: { getItem: jest.fn(), setItem: jest.fn(), deleteItem: jest.fn() },
}));
jest.mock('../src/lib/referentiel-db', () => ({ listEquipesDeUtilisateur: jest.fn(), listToutesEquipes: jest.fn() }));
jest.mock('../src/hooks/use-signaler-chargement', () => ({ useSignalerChargement: () => jest.fn() }));

const mockListEquipes = jest.mocked(listEquipesDeUtilisateur);
const mockListToutes = jest.mocked(listToutesEquipes);

const SUD = { id: 'eq-sud', nom: 'Équipe Sud', type: 'aerien' as const, nb_membres: 4 };
const TOLIARA = { id: 'eq-tol', nom: 'EMT Toliara', type: 'terrestre' as const, nb_membres: 5 };

beforeEach(() => {
  jest.resetAllMocks();
  useAuthStore.setState({ user: { id: 'u-1' } } as any);
  useEquipeTravailStore.setState({ equipeId: null, isInitialized: true });
});

describe('useEquipesDeTravail', () => {
  it('liste les équipes de l’utilisateur connecté et expose l’équipe de travail courante', async () => {
    mockListEquipes.mockResolvedValue([SUD, TOLIARA]);
    useEquipeTravailStore.setState({ equipeId: 'eq-tol' });

    const { result } = await renderHook(() => useEquipesDeTravail());

    await waitFor(() => expect(result.current.equipes).toHaveLength(2));
    expect(mockListEquipes).toHaveBeenCalledWith('u-1');
    expect(result.current.courante).toEqual(TOLIARA);
  });

  it('choisit automatiquement l’unique équipe d’un agent qui n’en a pas encore choisi', async () => {
    mockListEquipes.mockResolvedValue([SUD]);

    await renderHook(() => useEquipesDeTravail());

    await waitFor(() => expect(useEquipeTravailStore.getState().equipeId).toBe('eq-sud'));
  });

  it('ne choisit rien tant que l’agent a plusieurs équipes', async () => {
    mockListEquipes.mockResolvedValue([SUD, TOLIARA]);

    const { result } = await renderHook(() => useEquipesDeTravail());

    await waitFor(() => expect(result.current.equipes).toHaveLength(2));
    expect(useEquipeTravailStore.getState().equipeId).toBeNull();
    expect(result.current.courante).toBeNull();
  });

  it('oublie une équipe de travail dont l’agent n’est plus membre', async () => {
    mockListEquipes.mockResolvedValue([SUD, TOLIARA]);
    useEquipeTravailStore.setState({ equipeId: 'eq-disparue' });

    await renderHook(() => useEquipesDeTravail());

    await waitFor(() => expect(useEquipeTravailStore.getState().equipeId).toBeNull());
  });

  it('choisir persiste l’équipe pour cet utilisateur', async () => {
    mockListEquipes.mockResolvedValue([SUD, TOLIARA]);
    const { result } = await renderHook(() => useEquipesDeTravail());
    await waitFor(() => expect(result.current.equipes).toHaveLength(2));

    await act(async () => {
      await result.current.choisir('eq-sud');
    });

    expect(useEquipeTravailStore.getState().equipeId).toBe('eq-sud');
    expect(result.current.courante).toEqual(SUD);
  });

  it('un administrateur choisit parmi toutes les équipes, même celles dont il n’est pas membre', async () => {
    useAuthStore.setState({ user: { id: 'u-1', role: 'admin' } } as any);
    mockListToutes.mockResolvedValue([SUD, TOLIARA]);
    mockListEquipes.mockResolvedValue([]);

    const { result } = await renderHook(() => useEquipesDeTravail());

    await waitFor(() => expect(result.current.equipes).toHaveLength(2));
    expect(mockListEquipes).not.toHaveBeenCalled();
  });
});
