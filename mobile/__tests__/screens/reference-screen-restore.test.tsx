/**
 * Non-régression #201 : en réouvrant une fiche intensive déjà enregistrée (brouillon
 * en attente de synchro ou déjà synchronisée), le PA, la station fixe et la position
 * GPS déjà saisis ne doivent pas être écrasés par une nouvelle détection automatique.
 *
 * Isolé de reference-screen.test.tsx : monter l'écran deux fois dans le même fichier
 * fait fuiter la chaîne de promesses GPS d'un test vers l'autre (act() qui se
 * chevauchent) — un fichier de test dédié évite cette pollution inter-tests.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ReferenceScreen from '@/app/(prospection)/reference';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import * as prospectionRepository from '@/lib/prospection-repository';
import * as location from '@/lib/location';
import * as referentielDb from '@/lib/referentiel-db';

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
  getCurrentPosition: jest.fn().mockResolvedValue({ latitude: -18.9, longitude: 47.5, altitude: 1200 }),
  reverseGeocode: jest.fn().mockResolvedValue({ region: null, district: null, commune: null }),
  LocationPermissionDeniedError: class LocationPermissionDeniedError extends Error {},
}));

jest.mock('@/lib/referentiel-db', () => ({
  listPostesAcridiens: jest.fn().mockResolvedValue([]),
  listStationsByPoste: jest.fn().mockResolvedValue([]),
  findNearestStation: jest.fn().mockResolvedValue(null),
}));

describe('ReferenceScreen — réouverture d’une fiche déjà enregistrée', () => {
  beforeEach(() => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'intensive',
        campagne_id: 'campagne-1',
        prospecteur_id: 'prospecteur-1',
        station_id: 'station-1',
        pa_code: 'PA01',
        pa_nom: 'Poste Test',
        station_nom: 'Station Test',
        latitude: -19.5,
        longitude: 47.2,
        altitude: 900,
        region: 'Region X',
        district: 'District Y',
        commune: 'Commune Z',
        surface_station: 10,
        surface_prospectee: 5,
        surface_infestee: 0,
        biotope: 'xerophyle',
      } as any,
      captures: [],
    });

    jest.mocked(referentielDb.listPostesAcridiens).mockResolvedValue([
      { id: 'pa-1', code: 'PA01', nom: 'Poste Test' } as any,
    ]);
    jest.mocked(referentielDb.listStationsByPoste).mockResolvedValue([
      { id: 'station-1', nom: 'Station Test', paId: 'pa-1' } as any,
    ]);
  });

  it('restaure le PA, la station et la position GPS déjà enregistrés au lieu de les écraser (#201)', async () => {
    await render(<ReferenceScreen />);

    await waitFor(() => expect(screen.getByText('Continuer  ›')).toBeVisible());
    await waitFor(() => expect(screen.getByText('Poste Test')).toBeVisible());

    // La fiche a déjà une position enregistrée : pas de nouvelle capture GPS live.
    expect(location.getCurrentPosition).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionReference).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({
          latitude: -19.5,
          longitude: 47.2,
          pa_code: 'PA01',
          pa_nom: 'Poste Test',
          stationId: 'station-1',
          station_nom: 'Station Test',
        })
      )
    );
  });
});
