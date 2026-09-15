/**
 * #sigle-utilisateur-numero-fiche : pendant de reference-screen-sigle-present.test.tsx
 * (utilisateur sans sigle — pas de tiret orphelin dans le numéro de fiche).
 *
 * Fichier séparé — cf. le commentaire de reference-screen-sigle-present.test.tsx
 * pour le pourquoi (contention sur les montages multiples de cet écran).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ReferenceScreen from '@/app/(prospection)/reference';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { useAuthStore } from '@/lib/auth-store';
import * as prospectionRepository from '@/lib/prospection-repository';

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

describe('ReferenceScreen — sigle utilisateur absent du numéro de fiche', () => {
  beforeEach(() => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'intensive',
        campagne_id: 'campagne-1',
        prospecteur_id: 'prospecteur-1',
        station_id: null,
        date_prospection: '2026-09-15',
      } as any,
      captures: [],
    });
    useAuthStore.setState({
      user: {
        id: 'user-1',
        nom: 'Rabe',
        prenom: 'Ando',
        email: 'ando@test.mg',
        role: 'prospecteur',
        actif: true,
        created_at: '2026-01-01T00:00:00Z',
      } as any,
      token: 'token-test',
    });
  });

  it('n’insère aucun sigle (ni tiret orphelin) quand l’utilisateur connecté n’en a pas', async () => {
    await render(
      <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
        <ReferenceScreen />
      </SafeAreaProvider>
    );
    await waitFor(() => expect(screen.getByText('Continuer  ›')).toBeVisible());

    const surfaceInputs = screen.getAllByPlaceholderText('0');
    fireEvent.changeText(surfaceInputs[0], '10');
    fireEvent.changeText(surfaceInputs[1], '5');
    fireEvent.press(screen.getByText('Xérophyle'));

    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() => expect(prospectionRepository.updateProspectionReference).toHaveBeenCalled());
    const [, input] = jest.mocked(prospectionRepository.updateProspectionReference).mock.calls[0];
    expect(input.nFiche).toBe('FI-20260915-DRAFT1');
  });
});
