/**
 * « Vérifier un signalement » — le slide Source/Date/Description crée le brouillon
 * (type_prospection = 'validation') puis doit désormais enchaîner sur le choix
 * Terrestre/Aérien (`extensive-mode-chooser.tsx`), et non plus directement sur
 * `extensive-reference.tsx` : cf. demande « Type de prospection » entre le
 * signalement et le déroulement extensif habituel.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ExtensiveSignalementScreen from '@/app/(prospection)/extensive-signalement';
import { useAuthStore } from '@/lib/auth-store';
import { startNewProspection } from '@/lib/prospection-accueil';

const mockReplace = jest.fn();

/** Laisse chaque re-rendu se poser avant l'interaction suivante — cf. convention
 * `extensive-imagos-screen.test.tsx` (sinon « Continuer » retrouve le bouton encore
 * désactivé sur l'arbre précédent, la saisie n'ayant pas fini de se propager). */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: mockReplace, canGoBack: () => true }),
  useLocalSearchParams: () => ({}),
}));

jest.mock('@/lib/prospection-accueil', () => ({
  startNewProspection: jest.fn(),
}));

jest.mock('@/lib/prospection-repository', () => ({
  getProspection: jest.fn().mockResolvedValue({ id: 'draft-signalement-1' }),
  listAllProspectionCaptures: jest.fn().mockResolvedValue([]),
}));

describe('ExtensiveSignalementScreen', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    jest.mocked(startNewProspection).mockClear();
    useAuthStore.setState({ token: 'tok-1', user: { id: 'u1' } as any, isAuthenticated: true });
  });

  it('crée le brouillon de vérification puis route vers le choix du type de prospection, avec le draftId', async () => {
    jest.mocked(startNewProspection).mockResolvedValue({ id: 'draft-signalement-1' } as any);

    await render(<ExtensiveSignalementScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('Ex. Rasoanaivo (habitant)'), 'Rasoanaivo');
    await settle();
    fireEvent.changeText(screen.getByPlaceholderText('Ce qui a été signalé'), 'Essaim visible près du village');
    await settle();
    fireEvent.press(screen.getByText('Continuer : Type de prospection ›'));

    await waitFor(() =>
      expect(startNewProspection).toHaveBeenCalledWith(
        expect.objectContaining({
          typeProspection: 'validation',
          signalementSource: 'Rasoanaivo',
          signalementDescription: 'Essaim visible près du village',
        })
      )
    );

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/(prospection)/extensive-mode-chooser',
        params: { draftId: 'draft-signalement-1' },
      })
    );
  });
});
