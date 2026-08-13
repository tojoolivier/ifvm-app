/**
 * Prouve que `expo-router` est mockable/simulable dans un test d'écran
 * (voir #108) : monte un écran réel qui utilise `useRouter` et
 * `useLocalSearchParams`, sans crash au montage.
 *
 * NB: `expo-router/testing-library` (`renderRouter`) n'est pas utilisé ici —
 * son helper interne appelle `render` de manière synchrone alors que
 * `@testing-library/react-native@14` (requis par React 19 / `test-renderer`)
 * est asynchrone, ce qui casse le montage (voir expo-router@56.2.18). Mocker
 * directement les hooks `expo-router` évite l'incompatibilité et suffit pour
 * un test d'écran isolé.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import InfestationScreen from '@/app/(prospection)/infestation';
import { ErrorBanner } from '@/components/error-banner';
import { useErrorStore } from '@/lib/error-store';
import * as prospectionRepository from '@/lib/prospection-repository';

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  listAllProspectionInfestations: jest.fn().mockResolvedValue([]),
  saveProspectionInfestation: jest.fn().mockResolvedValue(undefined),
}));

describe('InfestationScreen', () => {
  beforeEach(() => {
    useErrorStore.setState({ current: null });
  });

  it('monte sans crash avec expo-router mocké', async () => {
    await render(<InfestationScreen />);

    expect(await screen.findByText('Infestation')).toBeVisible();
  });

  it('affiche une bannière d’erreur, sans navigation, quand la sauvegarde échoue', async () => {
    jest.mocked(prospectionRepository.listAllProspectionInfestations).mockResolvedValueOnce([
      { type_cible: 'tache_larvaire', surface_tot: 12 } as any,
    ]);
    jest.mocked(prospectionRepository.saveProspectionInfestation).mockRejectedValueOnce(new Error('boom'));

    await render(
      <>
        <ErrorBanner />
        <InfestationScreen />
      </>
    );

    // La ligne mockée pré-remplit "Tache larvaire" comme cible déjà sélectionnée.
    fireEvent.press(await screen.findByText('Comportement  ›'));
    fireEvent.press(await screen.findByText('Continuer  ›'));

    expect(await screen.findByText('Réessayer')).toBeVisible();
  });

  it('bascule automatiquement "Tache larvaire" vers "Bande larvaire" dès que la taille du groupe atteint 1000 m² (#103)', async () => {
    jest.mocked(prospectionRepository.listAllProspectionInfestations).mockResolvedValueOnce([
      { type_cible: 'tache_larvaire', surface_tot: 12, taille_groupe_m2: 1500 } as any,
    ]);

    await render(<InfestationScreen />);

    fireEvent.press(await screen.findByText('Comportement  ›'));

    expect(await screen.findByText('Comportement · Bande larvaire')).toBeVisible();
  });
});
