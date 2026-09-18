/**
 * Bug : sur l'écran « Type & références » du wizard traitement, la capture GPS
 * n'était déclenchée que manuellement (bouton « Localiser »), contrairement aux
 * écrans Référence de la prospection (reference.tsx, extensive-reference.tsx) qui
 * la déclenchent automatiquement au montage — leur laissant beaucoup plus de temps
 * réel pour converger avant que l'agent n'abandonne. Même fonction partagée
 * (`getCurrentPosition`) des deux côtés : ce test verrouille le déclenchement
 * automatique, pour aérien comme pour terrestre (même écran, un seul correctif).
 */
import { render, waitFor } from '@testing-library/react-native';
import ReferencesScreen from '@/app/(traitement)/references';
import { useTraitementCaptureStore } from '@/lib/traitement-capture-store';
import * as location from '@/lib/location';
import * as traitementRepository from '@/lib/traitement-repository';

let mockRouteParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockRouteParams,
}));

jest.mock('@/lib/traitement-repository', () => ({
  getTraitement: jest.fn(),
  createDraftTraitementAerien: jest.fn(),
  createDraftTraitementTerrestre: jest.fn(),
  updateTraitementReference: jest.fn(),
  saveCible: jest.fn(),
}));

jest.mock('@/lib/prospection-repository', () => ({
  getProspection: jest.fn().mockResolvedValue(null),
  listAllProspectionPopulations: jest.fn().mockResolvedValue([]),
  listAllProspectionInfestations: jest.fn().mockResolvedValue([]),
  listAllProspectionCaptures: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/location', () => ({
  getCurrentPosition: jest.fn().mockResolvedValue({
    latitude: -18.9,
    longitude: 47.5,
    altitude: 1200,
    accuracy: 5,
    timestamp: Date.now(),
  }),
  reverseGeocode: jest.fn().mockResolvedValue({ region: 'Analamanga', district: 'Antananarivo', commune: 'Antananarivo' }),
}));

const RESET_STATE = {
  screen: 'reference' as const,
  isValidationView: false,
  typeTraitement: null,
  ref: {},
  aerien: { rotations: [] },
  terrestre: { produits: [] },
  env: {},
  imp: {},
  observations: null,
  signed: {},
  stamps: {},
};

describe('ReferencesScreen (traitement) — capture GPS automatique', () => {
  beforeEach(() => {
    mockRouteParams = {};
    jest.mocked(location.getCurrentPosition).mockClear();
    jest.mocked(location.reverseGeocode).mockClear();
    jest.mocked(traitementRepository.getTraitement).mockReset();
    useTraitementCaptureStore.setState(RESET_STATE);
  });

  it('déclenche la capture GPS au montage pour une nouvelle fiche, sans attendre le bouton « Localiser »', async () => {
    render(<ReferencesScreen />);

    await waitFor(() => expect(location.getCurrentPosition).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(useTraitementCaptureStore.getState().ref.latitude).toBe(-18.9));
    expect(useTraitementCaptureStore.getState().ref.longitude).toBe(47.5);
    expect(useTraitementCaptureStore.getState().ref.altitude).toBe(1200);
  });

  it('le géocodage inverse continue de tourner en best-effort après la capture automatique', async () => {
    render(<ReferencesScreen />);

    await waitFor(() => expect(location.reverseGeocode).toHaveBeenCalledWith(-18.9, 47.5));
    await waitFor(() => expect(useTraitementCaptureStore.getState().ref.region).toBe('Analamanga'));
  });

  it.each(['AERIEN', 'TERRESTRE'] as const)(
    "reprise d'un brouillon %s déjà localisé : ne relance pas d'acquisition GPS, la position enregistrée est conservée",
    async (typeTraitement) => {
      mockRouteParams = { traitementId: 'trait-1' };
      jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
        id: 'trait-1',
        prospection_id: 'prosp-1',
        numero_fiche: null,
        type_traitement: typeTraitement,
        mode_traitement: null,
        date_traitement: '2026-08-11',
        date_validation: '2026-08-10',
        localite: 'Andasibe',
        region: 'Alaotra',
        district: 'Ambatondrazaka',
        commune: 'Ambatondrazaka',
        latitude: -17.8,
        longitude: 48.4,
        altitude: 900,
      } as any);

      render(<ReferencesScreen />);

      await waitFor(() => expect(traitementRepository.getTraitement).toHaveBeenCalledWith('trait-1'));
      await waitFor(() => expect(useTraitementCaptureStore.getState().ref.latitude).toBe(-17.8));
      expect(location.getCurrentPosition).not.toHaveBeenCalled();
    }
  );
});
