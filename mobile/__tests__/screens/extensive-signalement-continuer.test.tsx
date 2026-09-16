/**
 * « Vérifier un signalement » — pendant de extensive-signalement-screen.test.tsx
 * pour le scénario « Continuer » complet (isolé dans son propre fichier — cf. le
 * commentaire d'extensive-observations-pesticides-signatures-screen.test.tsx pour
 * le pourquoi : contention observée sur plusieurs montages de cet écran dans un
 * même fichier).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ExtensiveSignalementScreen from '@/app/(prospection)/extensive-signalement';
import { useAuthStore } from '@/lib/auth-store';
import { startNewProspection } from '@/lib/prospection-accueil';
import * as prospectionRepository from '@/lib/prospection-repository';

const mockReplace = jest.fn();

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
  updateProspectionSignalement: jest.fn().mockResolvedValue({ id: 'draft-signalement-1' }),
}));

describe('ExtensiveSignalementScreen — Continuer', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    jest.mocked(startNewProspection).mockClear().mockResolvedValue({ id: 'draft-signalement-1' } as any);
    jest.mocked(prospectionRepository.updateProspectionSignalement).mockClear();
    useAuthStore.setState({ token: 'tok-1', user: { id: 'u1' } as any, isAuthenticated: true });
  });

  it('enregistre les valeurs finales puis route vers le choix du type de prospection, avec le draftId', async () => {
    await render(<ExtensiveSignalementScreen />);
    await waitFor(() => expect(startNewProspection).toHaveBeenCalled());

    fireEvent.changeText(screen.getByPlaceholderText('Ex. Rasoanaivo (habitant)'), 'Rasoanaivo');
    await settle();
    fireEvent.changeText(screen.getByPlaceholderText('Ce qui a été signalé'), 'Essaim visible près du village');
    await settle();
    fireEvent.press(screen.getByText('Continuer : Type de prospection ›'));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionSignalement).toHaveBeenCalledWith(
        'draft-signalement-1',
        expect.objectContaining({
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
