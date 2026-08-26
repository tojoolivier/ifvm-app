/**
 * Le badge de précision doit vivre pendant la convergence du GPS : l'agent voit
 * le « ± N m » descendre et sait quand la position est exploitable, au lieu
 * d'attendre un chiffre unique tombé du premier fix (souvent un fix réseau).
 */
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ReferenceScreen from '@/app/(prospection)/reference';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { getCurrentPosition } from '@/lib/location';

/** Ambre : « utilisable, mais attends encore un peu » — ni neutre, ni bloquant. */
const PRECISION_BADGE_COULEUR_ALERTE = '#f59e0b';

const TEST_SAFE_AREA_METRICS = {
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
  frame: { x: 0, y: 0, width: 0, height: 0 },
};

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  updateProspectionReference: jest.fn().mockResolvedValue({ id: 'draft-123' }),
  getProspection: jest.fn(),
  listAllProspectionCaptures: jest.fn().mockResolvedValue([]),
  listProspectionsRecentesAutresProspecteurs: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/location', () => ({
  getCurrentPosition: jest.fn(),
  reverseGeocode: jest.fn().mockResolvedValue({ region: null, district: null, commune: null }),
}));

jest.mock('@/lib/referentiel-db', () => ({
  listPostesAcridiens: jest.fn().mockResolvedValue([]),
  listStationsByPoste: jest.fn().mockResolvedValue([]),
  findNearestStation: jest.fn().mockResolvedValue(null),
}));

const fixe = (accuracy: number) => ({
  latitude: -18.9,
  longitude: 47.5,
  altitude: 1280,
  accuracy,
  timestamp: 1_756_123_456_000,
});

beforeEach(() => {
  useProspectionWizardStore.setState({
    draft: {
      id: 'draft-123',
      type_prospection: 'intensive',
      campagne_id: 'campagne-1',
      prospecteur_id: 'prospecteur-1',
      station_id: null,
    } as any,
    captures: [],
  });
});

describe('ReferenceScreen — précision GPS', () => {
  it('affiche la précision qui descend pendant la convergence, puis le fix retenu', async () => {
    let progresser: ((position: ReturnType<typeof fixe>) => void) | null = null;
    let resoudre: ((position: ReturnType<typeof fixe>) => void) | null = null;

    (getCurrentPosition as jest.Mock).mockImplementation(
      (options?: { onProgress?: (p: ReturnType<typeof fixe>) => void }) => {
        progresser = (p) => options?.onProgress?.(p);
        return new Promise((resolve) => {
          resoudre = resolve;
        });
      }
    );

    render(
      <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
        <ReferenceScreen />
      </SafeAreaProvider>
    );

    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalled());

    await act(async () => progresser?.(fixe(480)));
    expect(await screen.findByText('± 480 m')).toBeVisible();

    await act(async () => progresser?.(fixe(37)));
    expect(await screen.findByText('± 37 m')).toBeVisible();

    await act(async () => resoudre?.(fixe(9)));
    expect(await screen.findByText('± 9 m')).toBeVisible();
  });

  it('signale visuellement une précision entre la cible et le seuil bloquant', async () => {
    (getCurrentPosition as jest.Mock).mockResolvedValue(fixe(37));

    await render(
      <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
        <ReferenceScreen />
      </SafeAreaProvider>
    );

    const badge = await screen.findByTestId('gps-accuracy-badge');
    expect(badge).toHaveStyle({ backgroundColor: PRECISION_BADGE_COULEUR_ALERTE });
  });

  it('n\'alerte pas quand la précision atteint la cible', async () => {
    (getCurrentPosition as jest.Mock).mockResolvedValue(fixe(9));

    await render(
      <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
        <ReferenceScreen />
      </SafeAreaProvider>
    );

    const badge = await screen.findByTestId('gps-accuracy-badge');
    expect(badge).not.toHaveStyle({ backgroundColor: PRECISION_BADGE_COULEUR_ALERTE });
  });
});
