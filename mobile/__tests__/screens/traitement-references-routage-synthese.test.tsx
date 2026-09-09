/**
 * #326 — Réordonnancement du flux Aérien : depuis « Type & références », le bouton
 * « Continuer » route vers « Synthèse » pour un traitement Aérien (remplace
 * « Cibles »), et continue de router vers « Cibles » pour le Terrestre, inchangé.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
import ReferencesScreen from '@/app/(traitement)/references';
import { useTraitementCaptureStore } from '@/lib/traitement-capture-store';
import * as traitementRepository from '@/lib/traitement-repository';

const mockPush = jest.fn();
let mockRouteParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockRouteParams,
}));

jest.mock('@/lib/traitement-repository', () => ({
  getTraitement: jest.fn(),
  createDraftTraitementAerien: jest.fn(),
  createDraftTraitementTerrestre: jest.fn(),
  updateTraitementReference: jest.fn().mockResolvedValue({}),
  genererNumeroFicheDisponible: jest.fn(),
  saveCible: jest.fn(),
}));

jest.mock('@/lib/prospection-repository', () => ({
  getProspection: jest.fn().mockResolvedValue(null),
  listAllProspectionPopulations: jest.fn().mockResolvedValue([]),
  listAllProspectionInfestations: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/location', () => ({
  getCurrentPosition: jest.fn().mockResolvedValue({
    latitude: -18.9,
    longitude: 47.5,
    altitude: 1200,
    accuracy: 5,
    timestamp: Date.now(),
  }),
  reverseGeocode: jest.fn().mockResolvedValue({ region: null, district: null, commune: null }),
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

function draftDejaLocalise(typeTraitement: 'AERIEN' | 'TERRESTRE') {
  return {
    id: 'trait-1',
    prospection_id: 'prosp-1',
    numero_fiche: 'TR-0001',
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
  } as any;
}

beforeEach(() => {
  mockPush.mockClear();
  mockRouteParams = { traitementId: 'trait-1' };
  jest.mocked(traitementRepository.getTraitement).mockReset();
  jest.mocked(traitementRepository.updateTraitementReference).mockClear().mockResolvedValue({} as any);
  useTraitementCaptureStore.setState(RESET_STATE);
});

describe('ReferencesScreen — routage post-Continuer selon le type (#326)', () => {
  it('route vers Synthèse pour un traitement Aérien', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue(draftDejaLocalise('AERIEN'));

    await render(<ReferencesScreen />);
    await waitFor(() => expect(useTraitementCaptureStore.getState().ref.localite).toBe('Andasibe'));

    expect(await screen.findByText('Continuer — Synthèse ›')).toBeVisible();
    fireEvent.press(screen.getByText('Continuer — Synthèse ›'));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: '/(traitement)/synthese' })
      )
    );
  });

  it('continue de router vers Cibles pour un traitement Terrestre, inchangé', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue(draftDejaLocalise('TERRESTRE'));

    await render(<ReferencesScreen />);
    await waitFor(() => expect(useTraitementCaptureStore.getState().ref.localite).toBe('Andasibe'));

    expect(await screen.findByText('Continuer — Cibles ›')).toBeVisible();
    fireEvent.press(screen.getByText('Continuer — Cibles ›'));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: '/(traitement)/cibles' })
      )
    );
  });
});

describe('ReferencesScreen — persistance du Mode de traitement (#persistance-fiches-traitement)', () => {
  it("persiste un changement de « Mode de traitement » sur une fiche déjà créée, non lecture seule — auparavant jamais transmis à updateTraitementReference, la modification disparaissait au prochain enregistrement", async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue(draftDejaLocalise('AERIEN'));

    await render(<ReferencesScreen />);
    await waitFor(() => expect(useTraitementCaptureStore.getState().ref.localite).toBe('Andasibe'));

    fireEvent.press(screen.getByText('Barrières'));
    await settle();
    fireEvent.press(screen.getByText('Continuer — Synthèse ›'));

    await waitFor(() =>
      expect(traitementRepository.updateTraitementReference).toHaveBeenCalledWith(
        'trait-1',
        expect.objectContaining({ modeTraitement: 'BARRIERE' })
      )
    );
  });
});
