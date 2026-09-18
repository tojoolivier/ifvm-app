/**
 * Saisie décimale francophone (virgule) sur l'écran « Pesticides & rotations »
 * (rotations.tsx) — Approvisionnement et vent fin de rotation.
 *
 * L'efficacité (taux de mortalité, délai d'évaluation, méthode) vivait ici
 * jusqu'à son déplacement sur « Moyens & protection » (moyens.tsx,
 * #efficacite-moyens-protection) — cf. traitement-moyens-efficacite.test.tsx.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import RotationsScreen from '@/app/(traitement)/rotations';
import { useTraitementCaptureStore } from '@/lib/traitement-capture-store';
import * as traitementRepository from '@/lib/traitement-repository';

let mockRouteParams: Record<string, string> = { traitementId: 'trait-1' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockRouteParams,
}));

jest.mock('@/lib/traitement-repository', () => ({
  getTraitement: jest.fn(),
  addRotation: jest.fn().mockResolvedValue({}),
  deleteAllRotationsForTraitementAerien: jest.fn().mockResolvedValue(undefined),
  updateTraitementAerienPesticideRecu: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/lib/referentiel-db', () => ({
  listPesticides: jest.fn().mockResolvedValue([]),
}));

const RESET_STATE = {
  screen: 'reference' as const,
  isValidationView: false,
  typeTraitement: 'AERIEN' as const,
  ref: {},
  aerien: { rotations: [] },
  terrestre: { produits: [] },
  env: {},
  imp: {},
  observations: null,
  signed: {},
  stamps: {},
};

/** Laisse un vrai tick s'écouler entre une saisie et un `fireEvent.press` — même
 * prudence que traitement-rotations-screen.test.tsx. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

beforeEach(() => {
  mockRouteParams = { traitementId: 'trait-1' };
  jest.mocked(traitementRepository.getTraitement).mockReset().mockResolvedValue({
    id: 'trait-1',
    type_traitement: 'AERIEN',
    cible: { surface_infestee_ha: 100 },
    aerien: {
      pesticide_recu_l: null,
      taux_mortalite_pourcent: null,
      evaluation_efficacite_heures_apres: null,
      methode_evaluation_efficacite: null,
      rotations: [],
    },
  } as any);
  jest.mocked(traitementRepository.addRotation).mockClear().mockResolvedValue({} as any);
  jest.mocked(traitementRepository.deleteAllRotationsForTraitementAerien).mockClear().mockResolvedValue(undefined);
  jest.mocked(traitementRepository.updateTraitementAerienPesticideRecu).mockClear().mockResolvedValue({} as any);
  useTraitementCaptureStore.setState(RESET_STATE);
});

describe('RotationsScreen — saisie décimale francophone (virgule)', () => {
  it("conserve la valeur saisie avec une virgule sur Approvisionnement, sans jamais afficher NaN", async () => {
    await render(<RotationsScreen />);
    await screen.findByTestId('rotation-numero-cuve-0');

    fireEvent.changeText(screen.getByTestId('pesticide-recu-input'), '12,5');
    await settle();

    expect(screen.getByDisplayValue('12,5')).toBeVisible();
    expect(screen.queryByDisplayValue('NaN')).toBeNull();

    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() =>
      expect(traitementRepository.updateTraitementAerienPesticideRecu).toHaveBeenCalledWith('trait-1', 12.5)
    );
  });

  it("permet de renseigner la Vitesse du vent fin (m/s) avec une virgule, sans rester bloqué à NaN", async () => {
    await render(<RotationsScreen />);
    await screen.findByTestId('rotation-numero-cuve-0');

    fireEvent.changeText(screen.getByTestId('rotation-vent-fin-input-0'), '3,2');
    await settle();

    expect(screen.getByTestId('rotation-vent-fin-input-0').props.value).toBe('3,2');
    expect(screen.queryByDisplayValue('NaN')).toBeNull();
  });
});
