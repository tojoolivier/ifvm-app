/**
 * #ordre-heures-rotation-aerien : sur l'écran Pesticides & rotations, chaque rotation doit
 * respecter début < ouverture de vanne < fermeture de vanne < fin — avertissement en direct,
 * « Continuer » refusé tant que l'ordre n'est pas rétabli.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import RotationsScreen from '@/app/(traitement)/rotations';
import { useTraitementCaptureStore } from '@/lib/traitement-capture-store';
import * as traitementRepository from '@/lib/traitement-repository';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({ traitementId: 'trait-1' }),
}));

jest.mock('@/lib/traitement-repository', () => ({
  getTraitement: jest.fn(),
  addRotation: jest.fn().mockResolvedValue({}),
  deleteAllRotationsForTraitementAerien: jest.fn().mockResolvedValue(undefined),
  updateTraitementAerienPesticideRecu: jest.fn().mockResolvedValue({}),
  updateTraitementAerienSurfaceRestante: jest.fn().mockResolvedValue(undefined),
  updateTraitementAerienEfficacite: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/lib/referentiel-db', () => ({
  listPesticides: jest.fn().mockResolvedValue([]),
}));

const rotation = (over: Record<string, unknown>) => ({
  localId: 'r1',
  produit_id: 'p1',
  quantite: 10,
  unite: 'L',
  surface_ha: 5,
  heure_debut: '06:00',
  heure_ouverture_vanne: '06:05',
  heure_fermeture_vanne: '06:20',
  heure_fin: '06:30',
  temperature_debut_c: 25,
  temperature_fin_c: 26,
  vent_debut_ms: 2,
  vent_fin_ms: 3,
  ...over,
});

/** Un vrai tick avant un geste : sur un runner CI chargé, un `press` juste après le montage
 * s'exécutait sur une fermeture React pas encore réconciliée (cf. traitement-rotations-screen). */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

const charger = async (over: Record<string, unknown>) => {
  useTraitementCaptureStore.setState({
    screen: 'reference',
    isValidationView: false,
    typeTraitement: 'AERIEN',
    ref: {},
    aerien: { rotations: [rotation(over)] },
    terrestre: { produits: [] },
    env: {},
    imp: {},
    observations: null,
    signed: {},
    stamps: {},
  } as any);
  await render(<RotationsScreen />);
  await screen.findByTestId('rotation-numero-cuve-0');
  await settle();
};

beforeEach(() => {
  mockPush.mockClear();
  jest.mocked(traitementRepository.getTraitement).mockReset().mockResolvedValue({
    id: 'trait-1',
    type_traitement: 'AERIEN',
    cible: { surface_infestee_ha: 100 },
    // Surface restante déjà tranchée : sinon « Continuer » exige la décision (abandonnée ou non).
    aerien: { surface_restante_abandonnee: false, pesticide_recu_l: null, rotations: [] },
  } as any);
  jest.mocked(traitementRepository.deleteAllRotationsForTraitementAerien).mockClear();
});

describe('RotationsScreen (Aérien) — ordre des heures', () => {
  it.each([
    [{ heure_ouverture_vanne: '05:50' }, /L'heure d'ouverture de vanne doit être postérieure à l'heure de début/],
    [{ heure_fermeture_vanne: '06:05' }, /L'heure de fermeture de vanne doit être postérieure à l'heure d'ouverture de vanne/],
    [{ heure_fin: '06:20' }, /L'heure de fin doit être postérieure à l'heure de fermeture de vanne/],
  ])('avertit et refuse de continuer quand l’ordre est rompu (%j)', async (over, message) => {
    await charger(over);

    expect(await screen.findByText(message)).toBeVisible();
    fireEvent.press(screen.getByText(/Continuer/));

    await waitFor(() => expect(screen.getAllByText(message).length).toBeGreaterThan(0), { timeout: 5000 });
    expect(traitementRepository.deleteAllRotationsForTraitementAerien).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('accepte l’ordre début < ouverture < fermeture < fin, sans avertissement, et enregistre', async () => {
    await charger({});

    expect(screen.queryByText(/doit être postérieure/)).toBeNull();
    fireEvent.press(screen.getByText(/Continuer/));
    await waitFor(() => expect(traitementRepository.deleteAllRotationsForTraitementAerien).toHaveBeenCalled(), {
      timeout: 5000,
    });
  });
});
