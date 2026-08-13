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
import { render, screen } from '@testing-library/react-native';
import InfestationScreen from '@/app/(prospection)/infestation';

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  listAllProspectionInfestations: jest.fn().mockResolvedValue([]),
  saveProspectionInfestation: jest.fn().mockResolvedValue(undefined),
}));

describe('InfestationScreen', () => {
  it('monte sans crash avec expo-router mocké', async () => {
    await render(<InfestationScreen />);

    expect(await screen.findByText('Infestation')).toBeVisible();
  });
});
