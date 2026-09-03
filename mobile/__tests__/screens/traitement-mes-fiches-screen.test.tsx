/**
 * (traitement)/mes-fiches.tsx (#mes-fiches-chef-equipe) : l'écran doit
 * recharger la liste à chaque retour dessus (useFocusEffect), pas seulement au
 * premier montage (useEffect simple) — sinon une fiche enregistrée depuis un
 * autre écran de la pile de navigation reste invisible tant que l'écran n'est
 * pas totalement remonté depuis zéro.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react-native';
import TraitementMesFichesScreen from '@/app/(traitement)/mes-fiches';
import { useAuthStore } from '@/lib/auth-store';
import * as traitementRepository from '@/lib/traitement-repository';

let mockFocusListeners: (() => void)[] = [];

jest.mock('expo-router', () => {
  const react = require('react');
  return {
    useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
    useFocusEffect: (callback: () => void) => {
      react.useEffect(() => {
        mockFocusListeners.push(callback);
        callback();
        return () => {
          mockFocusListeners = mockFocusListeners.filter((c) => c !== callback);
        };
      }, [callback]);
    },
  };
});

jest.mock('@/lib/traitement-repository', () => ({
  listMesTraitements: jest.fn().mockResolvedValue([]),
}));

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('TraitementMesFichesScreen', () => {
  afterEach(cleanup);
  beforeEach(() => {
    jest.clearAllMocks();
    mockFocusListeners = [];
    jest.mocked(traitementRepository.listMesTraitements).mockResolvedValue([]);
    useAuthStore.setState({ user: { id: 'user-1' } as any, token: 'token-1' } as any);
  });

  it('recharge la liste à chaque retour sur l’écran (useFocusEffect), pas seulement au montage', async () => {
    await render(<TraitementMesFichesScreen />);
    await settle();
    expect(traitementRepository.listMesTraitements).toHaveBeenCalledTimes(1);

    // Simule un retour sur l'écran (le même mécanisme qu'après avoir enregistré
    // une fiche depuis (traitement)/recap.tsx puis navigué en arrière).
    mockFocusListeners.forEach((cb) => cb());
    await settle();

    expect(traitementRepository.listMesTraitements).toHaveBeenCalledTimes(2);
    expect(traitementRepository.listMesTraitements).toHaveBeenCalledWith('user-1');
  });

  it('affiche les fiches renvoyées après rechargement', async () => {
    jest.mocked(traitementRepository.listMesTraitements).mockResolvedValue([
      { id: 'trait-1', numero_fiche: 'TR-001', type_traitement: 'TERRESTRE', localite: 'Ambanja' },
    ] as any);

    await render(<TraitementMesFichesScreen />);
    await waitFor(() => expect(screen.getByText('TR-001')).toBeVisible());
  });
});
