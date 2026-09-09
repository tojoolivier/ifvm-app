/**
 * Couvre #100 : la surface prospectée est obligatoire sur l'écran Référence,
 * y compris en mode intensif (auparavant seule la fiche extensive l'exigeait).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ReferenceScreen from '@/app/(prospection)/reference';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import * as prospectionRepository from '@/lib/prospection-repository';

// `reference.tsx` lit useSafeAreaInsets() (position du bouton "Continuer" au-dessus
// de la zone de geste) : il faut un SafeAreaProvider avec des métriques initiales.
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
}));

jest.mock('@/lib/location', () => ({
  getCurrentPosition: jest.fn().mockResolvedValue({ latitude: -18.9, longitude: 47.5, altitude: 1200 }),
  reverseGeocode: jest.fn().mockResolvedValue({ region: null, district: null, commune: null }),
  LocationPermissionDeniedError: class LocationPermissionDeniedError extends Error {},
}));

jest.mock('@/lib/referentiel-db', () => ({
  listPostesAcridiens: jest.fn().mockResolvedValue([]),
  listStationsByPoste: jest.fn().mockResolvedValue([]),
  findNearestStation: jest.fn().mockResolvedValue(null),
}));

describe('ReferenceScreen', () => {
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

  it('bloque sans surface prospectée puis autorise une fois le champ rempli (mode intensif)', async () => {
    await render(
      <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
        <ReferenceScreen />
      </SafeAreaProvider>
    );

    await waitFor(() => expect(screen.getByText('Continuer  ›')).toBeVisible());

    const surfaceInputs = screen.getAllByPlaceholderText('0');
    fireEvent.changeText(surfaceInputs[0], '10'); // surface station
    fireEvent.press(screen.getByText('Xérophyle'));

    // Cas bloquant : surface prospectée vide.
    fireEvent.press(screen.getByText('Continuer  ›'));
    expect(await screen.findByText('La surface prospectée est obligatoire')).toBeVisible();
    expect(prospectionRepository.updateProspectionReference).not.toHaveBeenCalled();

    // Cas nominal : surface prospectée renseignée.
    fireEvent.changeText(surfaceInputs[1], '5');
    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() => expect(prospectionRepository.updateProspectionReference).toHaveBeenCalled());
    expect(screen.queryByText('La surface prospectée est obligatoire')).toBeNull();
  });
});
