/**
 * L'entrée froide du signalement, dans le Profil — ADR-012 décision 7 (#176).
 *
 * **Le test central du ticket est le premier.** Le lien vers l'export vivait
 * derrière `debugEnabled` : l'agent devait avoir activé l'interrupteur *avant*
 * le bug, une dépendance temporelle impossible à satisfaire — celui qui subit
 * un problème arrive toujours trop tard. Si quelqu'un remet un jour une
 * condition devant ce bouton, c'est ce test-là qui doit tomber.
 */
import { render, screen, fireEvent } from '@testing-library/react-native';

import ProfileScreen from '@/app/(app)/profile';
import { useAuthStore } from '@/lib/auth-store';
import { useDebugStore } from '@/lib/debug-store';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({}),
}));

jest.mock('@/lib/storage', () => ({
  storage: { getItem: jest.fn().mockResolvedValue(null), setItem: jest.fn(), deleteItem: jest.fn() },
}));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('expo-file-system', () => ({ File: class {}, Paths: { cache: '' } }));
jest.mock('@/lib/api-client', () => ({ apiClient: { changePassword: jest.fn() } }));
jest.mock('@/lib/referentiel-sync', () => ({
  pullReferentiel: jest.fn(),
  resetReferentielSyncCursors: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({
    user: {
      id: '7',
      nom: 'Rakoto',
      prenom: 'Jean',
      email: 'jean@example.org',
      role: 'prospecteur',
      actif: true,
      created_at: '2026-01-01T00:00:00Z',
    },
    isAuthenticated: true,
  });
});

describe('« Signaler un problème » — l’entrée froide', () => {
  it('est visible mode débogage ÉTEINT — c’est tout le ticket', async () => {
    useDebugStore.setState({ enabled: false });

    await render(<ProfileScreen />);

    expect(screen.getByText('Signaler un problème')).toBeTruthy();
  });

  it('mène au parcours de signalement, pas au journal brut', async () => {
    useDebugStore.setState({ enabled: false });

    await render(<ProfileScreen />);
    await fireEvent.press(screen.getByText('Signaler un problème'));

    expect(mockPush).toHaveBeenCalledWith('/(app)/signalement');
  });
});

describe('le flag debug n’est plus un gate', () => {
  it('se présente comme un réglage de verbosité, à la demande du support', async () => {
    useDebugStore.setState({ enabled: false });

    await render(<ProfileScreen />);

    // L'ancien libellé « Mode débogage » laissait croire que rien n'était
    // enregistré sans lui. Tout part au journal ; le flag n'allonge que la
    // durée de vie des lignes `detail` (`journal-db.purgerJournal`).
    expect(screen.queryByText('Mode débogage')).toBeNull();
    expect(screen.getByText('Enregistrer les détails techniques')).toBeTruthy();
    expect(screen.getByText(/si le support vous le demande/i)).toBeTruthy();
  });

  it('laisse le journal accessible sans l’activer', async () => {
    useDebugStore.setState({ enabled: false });

    await render(<ProfileScreen />);

    expect(screen.getByText('Journal des requêtes')).toBeTruthy();
  });
});
