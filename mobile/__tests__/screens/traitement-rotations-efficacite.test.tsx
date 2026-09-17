/**
 * Efficacité (migration backend 0058, fiche CRT papier section "Traitement") :
 * taux de mortalité, délai d'évaluation et méthode — côté Aérien, saisi sur le
 * même écran que « Pesticide reçu » (rotations.tsx), une seule évaluation par
 * fiche (après l'ensemble des rotations), pas par rotation individuelle.
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
  updateTraitementAerienEfficacite: jest.fn().mockResolvedValue({}),
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
  jest.mocked(traitementRepository.updateTraitementAerienEfficacite).mockClear().mockResolvedValue({} as any);
  useTraitementCaptureStore.setState(RESET_STATE);
});

describe('RotationsScreen — efficacité (taux de mortalité)', () => {
  it('saisit et enregistre le taux de mortalité, le délai et la méthode', async () => {
    await render(<RotationsScreen />);
    await screen.findByTestId('rotation-numero-cuve-0');

    fireEvent.changeText(screen.getByTestId('taux-mortalite-input'), '92');
    await settle();
    fireEvent.changeText(screen.getByTestId('evaluation-efficacite-heures-input'), '24');
    await settle();
    fireEvent.press(screen.getByText('Estimation visuelle'));
    await settle();
    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() =>
      expect(traitementRepository.updateTraitementAerienEfficacite).toHaveBeenCalledWith('trait-1', {
        tauxMortalitePourcent: 92,
        evaluationEfficaciteHeuresApres: 24,
        methodeEvaluationEfficacite: 'ESTIMATION_VISUELLE',
      })
    );
  });

  it('restaure une évaluation déjà enregistrée', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      id: 'trait-1',
      type_traitement: 'AERIEN',
      cible: { surface_infestee_ha: 100 },
      aerien: {
        pesticide_recu_l: null,
        taux_mortalite_pourcent: 87.5,
        evaluation_efficacite_heures_apres: 6,
        methode_evaluation_efficacite: 'COMPTAGES_PRE_POST',
        rotations: [],
      },
    } as any);

    await render(<RotationsScreen />);

    expect(await screen.findByDisplayValue('87,5')).toBeVisible();
    expect(screen.getByDisplayValue('6')).toBeVisible();
    expect(screen.getByText('Comptages pré/post-traitement').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#fff' })])
    );
  });
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
