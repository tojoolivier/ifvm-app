/**
 * Menu « Nouvelle fiche » (NewFicheFab) — l'équipe de travail est le contexte (#678) : une action
 * dont le type ne convient pas à l'équipe courante est grisée avec son motif, et l'appui ouvre le
 * choix d'équipe au lieu de lever une erreur.
 */
import { configure, fireEvent, render, screen } from '@testing-library/react-native';
import { NewFicheFab } from '@/components/fiches/NewFicheFab';
import { useAuthStore } from '@/lib/auth-store';
import { useEquipeSheetStore } from '@/lib/equipe-sheet-store';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  ...require('../test-utils/mock-expo-router').expoRouterMock(),
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));

let mockCourante: { id: string; nom: string; type: 'terrestre' | 'aerien' } | null = null;
jest.mock('@/hooks/use-equipes-de-travail', () => ({
  useEquipesDeTravail: () => ({ equipes: [], courante: mockCourante, choisir: jest.fn(), recharger: jest.fn(), isLoaded: true }),
}));

// Le contenu d'une `Modal` est exclu des requêtes par défaut : les écrans le testent ouvert.
configure({ defaultIncludeHiddenElements: true });

const ouvrirMenu = async () => {
  await render(<NewFicheFab />);
  await fireEvent.press(screen.getByTestId('fab-nouvelle-fiche'));
};

describe('NewFicheFab — menu contextuel selon l’équipe de travail', () => {
  beforeEach(() => {
    mockPush.mockClear();
    useEquipeSheetStore.setState({ visible: false });
    useAuthStore.setState({ user: { id: 'u1', role: 'admin' } as any, token: 'tok' });
    mockCourante = { id: 'eq-nord', nom: 'Équipe Nord', type: 'aerien' };
  });

  it('la prospection mène au choix du type, quelle que soit l’équipe', async () => {
    await ouvrirMenu();

    await fireEvent.press(screen.getByTestId('fab-prospection'));

    expect(mockPush).toHaveBeenCalledWith('/(prospection)/type-chooser');
    expect(useEquipeSheetStore.getState().visible).toBe(false);
  });

  it('équipe aérienne : le vol est permis', async () => {
    await ouvrirMenu();

    await fireEvent.press(screen.getByTestId('fab-nouveau-vol'));

    expect(mockPush).toHaveBeenCalledWith('/(app)/vol-nouveau');
    expect(useEquipeSheetStore.getState().visible).toBe(false);
  });

  it('équipe terrestre : le vol est grisé et un appui ouvre le choix d’équipe', async () => {
    mockCourante = { id: 'eq-sol', nom: 'EMT Toliara', type: 'terrestre' };
    await ouvrirMenu();

    expect(screen.getByText(/Demande une équipe aérienne — « EMT Toliara » est terrestre/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('fab-nouveau-vol'));

    expect(useEquipeSheetStore.getState().visible).toBe(true);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('le traitement n’est jamais bloqué par le type de l’équipe', async () => {
    await ouvrirMenu();

    await fireEvent.press(screen.getByTestId('fab-traitement'));

    expect(mockPush).toHaveBeenCalledWith('/(traitement)/select');
  });

  it('sans équipe choisie : rien n’est grisé', async () => {
    mockCourante = null;
    await ouvrirMenu();

    expect(screen.queryByText(/Demande une équipe/)).toBeNull();
  });
});
