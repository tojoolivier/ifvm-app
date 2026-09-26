/**
 * #alerte-meteo-vent-temperature (Aérien) : même règle que le Terrestre, appliquée
 * à chaque rotation (vent/température début et fin) sur l'écran Pesticides &
 * rotations — avertissement en direct, « Continuer » refusé tant que non corrigé.
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
  heure_fin: '06:30',
  heure_ouverture_vanne: '06:05',
  heure_fermeture_vanne: '06:15',
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
  jest.mocked(traitementRepository.addRotation).mockClear();
});

describe('RotationsScreen (Aérien) — alerte vent / température', () => {
  it('avertit et refuse de continuer quand le vent d’une rotation dépasse 6 m/s', async () => {
    await charger({ vent_fin_ms: 7 });

    expect(await screen.findByText(/Vitesse du vent supérieure à 6 m\/s/)).toBeVisible();
    fireEvent.press(screen.getByText(/Continuer/));

    expect(await screen.findByText(/Rotation 1 \(vent fin\)/)).toBeVisible();
    expect(traitementRepository.deleteAllRotationsForTraitementAerien).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('avertit et refuse de continuer quand la température d’une rotation dépasse 35 °C', async () => {
    await charger({ temperature_debut_c: 36 });

    expect(await screen.findByText(/Température supérieure à 35 °C/)).toBeVisible();
    fireEvent.press(screen.getByText(/Continuer/));

    expect(await screen.findByText(/Rotation 1 \(température début\)/)).toBeVisible();
    expect(traitementRepository.deleteAllRotationsForTraitementAerien).not.toHaveBeenCalled();
  });

  it('autorise 6 m/s et 35 °C pile, sans avertissement, et enregistre', async () => {
    await charger({ vent_debut_ms: 6, temperature_fin_c: 35 });

    expect(screen.queryByText(/Vitesse du vent supérieure/)).toBeNull();
    expect(screen.queryByText(/Température supérieure/)).toBeNull();
    fireEvent.press(screen.getByText(/Continuer/));
    await waitFor(() => expect(traitementRepository.deleteAllRotationsForTraitementAerien).toHaveBeenCalled(), {
      timeout: 5000,
    });
  });
});
