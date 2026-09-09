/**
 * #manuel-referentiel-pa-station — non-régression : la Prospection Extensive
 * garde la saisie libre historique pour PA/Station en mode Manuel, seule
 * l'Intensive bascule sur un sélecteur du référentiel (voir
 * reference-screen-pa-station-manuel-intensif.test.tsx). Fichier séparé
 * (plutôt qu'un describe supplémentaire dans ce dernier) : chaque fichier de
 * test a son propre registre de modules Jest, ce qui évite toute pollution
 * inter-tests entre les deux scénarios.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ReferenceScreen from '@/app/(prospection)/reference';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';

const TEST_SAFE_AREA_METRICS = {
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
  frame: { x: 0, y: 0, width: 0, height: 0 },
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  updateProspectionReference: jest.fn().mockResolvedValue({ id: 'draft-123' }),
  getProspection: jest.fn(),
  listAllProspectionCaptures: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/location', () => ({
  getCurrentPosition: jest.fn().mockResolvedValue({ latitude: -18.9, longitude: 47.5, altitude: 1200 }),
  reverseGeocode: jest.fn().mockResolvedValue({ region: null, district: null, commune: null }),
  LocationPermissionDeniedError: class LocationPermissionDeniedError extends Error {},
}));

jest.mock('@/lib/referentiel-db', () => ({
  listPostesAcridiens: jest.fn().mockResolvedValue([{ id: 'pa-1', code: 'PA-MJA', nom: 'PA Mahajanga', zaId: 'za-1' }]),
  listStationsByPoste: jest.fn().mockResolvedValue([]),
  findNearestStation: jest.fn().mockResolvedValue(null),
}));

describe('ReferenceScreen — Prospection Extensive garde la saisie libre en Manuel (non-régression)', () => {
  beforeEach(() => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'extensive',
        campagne_id: 'campagne-1',
        prospecteur_id: 'prospecteur-1',
        station_id: null,
      } as any,
      captures: [],
    });
  });

  it('affiche toujours un champ texte libre pour PA en mode Manuel (extensif)', async () => {
    await render(
      <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
        <ReferenceScreen />
      </SafeAreaProvider>
    );
    await waitFor(() => expect(screen.getByText('Continuer  ›')).toBeVisible());

    fireEvent.press(screen.getAllByText('Manuel', { exact: true })[0]);
    await settle();

    expect(await screen.findByPlaceholderText('Saisir le nom du poste acridien')).toBeVisible();
    expect(screen.queryByText('Sélectionner un poste acridien')).toBeNull();
  });
});
