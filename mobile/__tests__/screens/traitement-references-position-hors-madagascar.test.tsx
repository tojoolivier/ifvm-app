/**
 * #position-hors-madagascar : « Continuer » refuse d'enregistrer une fiche de
 * traitement dont la position (auto-capturée ou reprise d'un brouillon) est
 * hors de Madagascar, y compris en pleine mer — même garde-fou que les écrans
 * Référence de la prospection (reference.tsx, extensive-reference.tsx).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ReferencesScreen from '@/app/(traitement)/references';
import { useTraitementCaptureStore } from '@/lib/traitement-capture-store';
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
  updateTraitementReference: jest.fn().mockResolvedValue({}),
  genererNumeroFicheDisponible: jest.fn(),
  saveCible: jest.fn(),
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

function draftPositionHorsMadagascar() {
  return {
    id: 'trait-1',
    prospection_id: 'prosp-1',
    numero_fiche: 'TR-0001',
    type_traitement: 'AERIEN' as const,
    mode_traitement: null,
    date_traitement: '2026-08-11',
    date_validation: '2026-08-10',
    localite: 'Andasibe',
    region: null,
    district: null,
    commune: null,
    // En pleine mer à ~90 km au large de la côte est — hors de l'ancien
    // rectangle englobant tout autant que du contour réel de l'île.
    latitude: -18,
    longitude: 50.2,
    altitude: 10,
  } as any;
}

beforeEach(() => {
  mockRouteParams = { traitementId: 'trait-1' };
  jest.mocked(traitementRepository.getTraitement).mockReset().mockResolvedValue(draftPositionHorsMadagascar());
  jest.mocked(traitementRepository.updateTraitementReference).mockClear().mockResolvedValue({} as any);
  useTraitementCaptureStore.setState(RESET_STATE);
});

describe('ReferencesScreen (traitement) — position hors de Madagascar', () => {
  it('refuse « Continuer » et affiche le motif, sans jamais enregistrer', async () => {
    await render(<ReferencesScreen />);
    await waitFor(() => expect(useTraitementCaptureStore.getState().ref.localite).toBe('Andasibe'));

    fireEvent.press(screen.getByText('Continuer — Synthèse ›'));

    expect(await screen.findByText(/hors de Madagascar/)).toBeVisible();
    expect(traitementRepository.updateTraitementReference).not.toHaveBeenCalled();
  });
});
