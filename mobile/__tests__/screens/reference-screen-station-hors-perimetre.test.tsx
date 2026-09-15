/**
 * #station-intensive-hors-perimetre : demande explicite du 2026-09-15 — au-delà
 * de 30 km de la station intensive la plus proche, le référentiel n'a plus de
 * sens (aucune station connue n'est réellement à proximité) : l'agent saisit
 * sa propre localité pour le Poste Acridien et la Station, plutôt que de se
 * voir imposer une station lointaine. Peu importe que les deux noms saisis
 * soient identiques.
 *
 * Complète reference-screen-pa-station-manuel-intensif.test.tsx (qui verrouille
 * le sélecteur référentiel quand `findNearestStation` renvoie `null` — resté
 * inchangé, cf. son propre fichier) avec le cas d'une station connue mais trop
 * lointaine.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ReferenceScreen from '@/app/(prospection)/reference';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import * as prospectionRepository from '@/lib/prospection-repository';
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

const STATION_LOINTAINE = {
  id: 'st-1', code: 'ST-A1', nom: 'Station Lointaine', paId: 'pa-1',
  latitude: -20, longitude: 47.5, altitude: null, commune: 'Ailleurs', district: 'Ailleurs', region: 'Ailleurs',
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

function renderEcran() {
  return render(
    <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
      <ReferenceScreen />
    </SafeAreaProvider>
  );
}

beforeEach(() => {
  jest.mocked(prospectionRepository.updateProspectionReference).mockClear();
  useProspectionWizardStore.setState({ draft: draftIntensif as any, captures: [] });
});

describe('ReferenceScreen — station intensive hors périmètre (30 km)', () => {
  it('bascule automatiquement PA/Station sur la saisie libre, préremplie avec la localité géocodée', async () => {
    jest.mocked(referentielDb.findNearestStation).mockResolvedValue({ station: STATION_LOINTAINE, distanceKm: 45 });

    await renderEcran();
    await waitFor(() => expect(screen.getByText('Continuer  ›')).toBeVisible());

    expect(await screen.findByText(/Aucune station intensive à moins de 30 km/)).toBeVisible();
    // Les deux champs (Poste Acridien et Station) sont préremplis avec la même
    // localité géocodée.
    await waitFor(() => expect(screen.getAllByDisplayValue('Andasibe')).toHaveLength(2));
    expect(screen.queryByText('Sélectionner un poste acridien')).toBeNull();
    expect(screen.queryByText('Sélectionner une station')).toBeNull();
  });

  it('enregistre le même nom de localité pour pa_nom et station_nom, sans pa_code ni stationId', async () => {
    jest.mocked(referentielDb.findNearestStation).mockResolvedValue({ station: STATION_LOINTAINE, distanceKm: 45 });

    await renderEcran();
    await waitFor(() => expect(screen.getByText('Continuer  ›')).toBeVisible());
    await waitFor(() => expect(screen.getAllByDisplayValue('Andasibe')).toHaveLength(2));

    const surfaceInputs = screen.getAllByPlaceholderText('0');
    fireEvent.changeText(surfaceInputs[0], '10');
    fireEvent.changeText(surfaceInputs[1], '5');
    fireEvent.press(screen.getByText('Xérophyle'));
    await settle();
    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() => expect(prospectionRepository.updateProspectionReference).toHaveBeenCalled());
    const payload = jest.mocked(prospectionRepository.updateProspectionReference).mock.calls[0][1];
    expect(payload.pa_code).toBeNull();
    expect(payload.pa_nom).toBe('Andasibe');
    expect(payload.stationId).toBeNull();
    expect(payload.station_nom).toBe('Andasibe');
  });
});
