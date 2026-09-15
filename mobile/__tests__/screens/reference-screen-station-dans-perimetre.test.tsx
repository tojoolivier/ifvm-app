/**
 * #station-intensive-hors-perimetre : pendant de reference-screen-station-hors-perimetre.test.tsx
 * — quand une station connue est à moins de 30 km, le comportement historique
 * (sélecteur du référentiel en mode Manuel) reste inchangé.
 *
 * Fichier séparé — cf. le commentaire d'extensive-observations-pesticides-signatures-screen.test.tsx
 * pour le pourquoi (contention observée sur plusieurs montages de cet écran
 * dans un même fichier).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ReferenceScreen from '@/app/(prospection)/reference';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import * as referentielDb from '@/lib/referentiel-db';

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
  reverseGeocode: jest.fn().mockResolvedValue({ region: 'Analamanga', district: 'Antananarivo', commune: 'Andasibe' }),
  LocationPermissionDeniedError: class LocationPermissionDeniedError extends Error {},
}));

const STATION_PROCHE = {
  id: 'st-1', code: 'ST-A1', nom: 'Station Proche', paId: 'pa-1',
  latitude: -18.95, longitude: 47.55, altitude: null, commune: 'Andasibe', district: 'Andasibe', region: 'Alaotra',
};

jest.mock('@/lib/referentiel-db', () => ({
  listPostesAcridiens: jest.fn().mockResolvedValue([]),
  listStationsByPoste: jest.fn().mockResolvedValue([]),
  findNearestStation: jest.fn(),
}));

const draftIntensif = {
  id: 'draft-123',
  type_prospection: 'intensive',
  campagne_id: 'campagne-1',
  prospecteur_id: 'prospecteur-1',
  station_id: null,
};

describe('ReferenceScreen — station intensive dans le périmètre (30 km)', () => {
  beforeEach(() => {
    useProspectionWizardStore.setState({ draft: draftIntensif as any, captures: [] });
  });

  it('garde le sélecteur référentiel (pas de saisie libre) quand une station est à moins de 30 km', async () => {
    jest.mocked(referentielDb.findNearestStation).mockResolvedValue({ station: STATION_PROCHE, distanceKm: 12 });

    await render(
      <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
        <ReferenceScreen />
      </SafeAreaProvider>
    );
    await waitFor(() => expect(screen.getByText('Continuer  ›')).toBeVisible());

    expect(screen.queryByText(/Aucune station intensive à moins de 30 km/)).toBeNull();

    fireEvent.press(screen.getAllByText('Manuel', { exact: true })[0]);
    await settle();

    expect(await screen.findByText('Sélectionner un poste acridien')).toBeVisible();
    expect(screen.queryByPlaceholderText('Saisir le nom du poste acridien')).toBeNull();
  });
});
