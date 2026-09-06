/**
 * #326 — Réordonnancement du flux Aérien : depuis « Impacts & risque », le bouton
 * « Continuer » route vers la nouvelle étape « Surface traitée » pour un
 * traitement Aérien, et continue de router directement vers « Signatures » pour
 * le Terrestre, inchangé.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ImpactsScreen from '@/app/(traitement)/impacts';
import { useTraitementCaptureStore } from '@/lib/traitement-capture-store';
import * as traitementRepository from '@/lib/traitement-repository';

const mockPush = jest.fn();
let mockRouteParams: Record<string, string> = { traitementId: 'trait-1' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockRouteParams,
}));

jest.mock('@/lib/traitement-repository', () => ({
  getTraitement: jest.fn(),
  updateTraitementImpacts: jest.fn().mockResolvedValue({}),
}));

function RESET_STATE(typeTraitement: 'AERIEN' | 'TERRESTRE') {
  return {
    screen: 'reference' as const,
    isValidationView: false,
    typeTraitement,
    ref: {},
    aerien: { rotations: [] },
    terrestre: { produits: [] },
    env: {},
    imp: {},
    observations: null,
    signed: {},
    stamps: {},
  };
}

beforeEach(() => {
  mockPush.mockClear();
  mockRouteParams = { traitementId: 'trait-1' };
  jest.mocked(traitementRepository.getTraitement).mockReset().mockResolvedValue({
    id: 'trait-1',
    type_traitement: 'AERIEN',
    evaluation_risque: null,
    comportement_non_cibles: null,
    mortalite_familles: null,
    empoisonnement: false,
    empoisonnement_type: null,
    empoisonnement_mode: null,
    empoisonnement_autre: null,
    comportement_anormal: false,
    mortalite: false,
    observations: null,
  } as any);
});

describe('ImpactsScreen — routage post-Continuer selon le type (#326)', () => {
  it('route vers Surface traitée pour un traitement Aérien', async () => {
    useTraitementCaptureStore.setState(RESET_STATE('AERIEN'));

    await render(<ImpactsScreen />);
    await screen.findByText('Impacts & risque');

    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: '/(traitement)/surface-traitee' })
      )
    );
  });

  it('continue de router directement vers Signatures pour un traitement Terrestre, inchangé', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      id: 'trait-1',
      type_traitement: 'TERRESTRE',
      evaluation_risque: null,
      comportement_non_cibles: null,
      mortalite_familles: null,
      empoisonnement: false,
      empoisonnement_type: null,
      empoisonnement_mode: null,
      empoisonnement_autre: null,
      comportement_anormal: false,
      mortalite: false,
      observations: null,
    } as any);
    useTraitementCaptureStore.setState(RESET_STATE('TERRESTRE'));

    await render(<ImpactsScreen />);
    await screen.findByText('Impacts & risque');

    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: '/(traitement)/signatures' })
      )
    );
  });
});
