/**
 * Saisie décimale francophone (virgule) sur l'écran « Pesticides & rotations »
 * (rotations.tsx) — vent fin de rotation.
 *
 * L'efficacité (taux de mortalité, délai d'évaluation, méthode) vivait ici
 * jusqu'à son déplacement sur « Moyens & protection » (moyens.tsx,
 * #efficacite-moyens-protection) — cf. traitement-moyens-efficacite.test.tsx.
 * « Approvisionnement » (pesticide_recu_l) y vivait aussi jusqu'à sa suppression
 * par #609 (stock aérien désormais dans `mouvement_pesticide`, #606).
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
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
  updateTraitementAerienSurfaceRestante: jest.fn().mockResolvedValue(undefined),
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
      surface_restante_abandonnee: false,
      taux_mortalite_pourcent: null,
      evaluation_efficacite_heures_apres: null,
      methode_evaluation_efficacite: null,
      rotations: [],
    },
  } as any);
  jest.mocked(traitementRepository.addRotation).mockClear().mockResolvedValue({} as any);
  jest.mocked(traitementRepository.deleteAllRotationsForTraitementAerien).mockClear().mockResolvedValue(undefined);
  useTraitementCaptureStore.setState(RESET_STATE);
});

describe('RotationsScreen — saisie décimale francophone (virgule)', () => {
  it("permet de renseigner la Vitesse du vent fin (m/s) avec une virgule, sans rester bloqué à NaN", async () => {
    await render(<RotationsScreen />);
    await screen.findByTestId('rotation-numero-cuve-0');

    fireEvent.changeText(screen.getByTestId('rotation-vent-fin-input-0'), '3,2');
    await settle();

    expect(screen.getByTestId('rotation-vent-fin-input-0').props.value).toBe('3,2');
    expect(screen.queryByDisplayValue('NaN')).toBeNull();
  });
});
