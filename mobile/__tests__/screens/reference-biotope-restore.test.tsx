/**
 * #biotope-multi : réouverture d'un brouillon existant — les biotopes déjà
 * enregistrés doivent être pré-cochés et rester modifiables (ajout/retrait). Fichier
 * séparé de reference-biotope-multiselect.test.tsx (un seul montage d'écran par
 * fichier, cf. commentaire de ce dernier).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ReferenceScreen from '@/app/(prospection)/reference';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import * as prospectionRepository from '@/lib/prospection-repository';

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

describe('ReferenceScreen — restauration des biotopes déjà enregistrés (#biotope-multi)', () => {
  beforeEach(() => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'intensive',
        campagne_id: 'campagne-1',
        prospecteur_id: 'prospecteur-1',
        station_id: null,
        surface_station: 10,
        surface_prospectee: 5,
        biotope: JSON.stringify(['xerophyle', 'hydrophyle']),
      } as any,
      captures: [],
    });
  });

  it('les biotopes déjà enregistrés sont pré-cochés, et la sélection reste modifiable', async () => {
    await render(
      <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
        <ReferenceScreen />
      </SafeAreaProvider>
    );
    await waitFor(() => expect(screen.getByText('Continuer  ›')).toBeVisible());

    // Pré-cochés : Xérophyle et Hygrophyle actifs, pas Mésophyle.
    expect(screen.getByText(/^Xérophyle/).props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#fff' })])
    );
    expect(screen.getByText(/^Hygrophyle/).props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#fff' })])
    );
    expect(screen.getByText('Mésophyle')).toBeVisible();

    // Complète la sélection sans perdre les deux déjà cochés.
    fireEvent.press(screen.getByText('Mésophyle'));
    await settle();
    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionReference).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({ biotope: JSON.stringify(['xerophyle', 'hydrophyle', 'mesophyle']) })
      )
    );
  });
});
