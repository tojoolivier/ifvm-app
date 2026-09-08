/**
 * #evaluation-risque-population — écran « Impact et risque » (Aérien ET
 * Terrestre, écran commun impacts.tsx) : section « Évaluation du risque pour
 * la population », juste au-dessus d'Observations. Liste dynamique ("+"),
 * habitat (texte libre) + distance (km, décimal) + sensibilisation (OUI/NON).
 *
 * Ordre des tests délibéré (même contrainte documentée dans
 * extensive-observations-futs-signatures-screen.test.tsx) : un test qui
 * enchaîne ≥ 2 `fireEvent.changeText` sur des champs contrôlés distincts
 * laisse l'environnement de test dans un état qui fait échouer le rendu du
 * test suivant — les deux tests concernés sont donc placés en dernier.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import ImpactsScreen from '@/app/(traitement)/impacts';
import { useTraitementCaptureStore } from '@/lib/traitement-capture-store';
import * as traitementRepository from '@/lib/traitement-repository';

let mockRouteParams: Record<string, string> = { traitementId: 'trait-1' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockRouteParams,
}));

jest.mock('@/lib/traitement-repository', () => ({
  getTraitement: jest.fn(),
  updateTraitementImpacts: jest.fn().mockResolvedValue({}),
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

const DRAFT_MINIMAL = {
  id: 'trait-1',
  type_traitement: 'AERIEN' as const,
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
  evaluations_risque_population: [],
};

beforeEach(() => {
  mockRouteParams = { traitementId: 'trait-1' };
  jest.mocked(traitementRepository.getTraitement).mockReset().mockResolvedValue(DRAFT_MINIMAL as any);
  jest.mocked(traitementRepository.updateTraitementImpacts).mockClear().mockResolvedValue({} as any);
  useTraitementCaptureStore.setState(RESET_STATE);
});

describe('ImpactsScreen — Évaluation du risque pour la population', () => {
  it('« + Ajouter une évaluation » fait apparaître Évaluation 1, avant Observations', async () => {
    await render(<ImpactsScreen />);
    await screen.findByText('Impacts & risque');

    expect(screen.queryByText('Évaluation 1')).toBeNull();
    fireEvent.press(screen.getByText('+ Ajouter une évaluation'));

    expect(await screen.findByText('Évaluation 1')).toBeVisible();
  });

  it('accepte OUI et NON pour la sensibilisation (Cas 3)', async () => {
    await render(<ImpactsScreen />);
    await screen.findByText('Impacts & risque');
    fireEvent.press(screen.getByText('+ Ajouter une évaluation'));
    const carte = within(await screen.findByTestId('evaluation-risque-population-0'));

    // « Oui »/« Non » existe aussi pour Empoisonnement, plus haut sur l'écran —
    // toujours scopé à la carte de cette évaluation (testID), jamais un
    // getByText global ambigu.
    fireEvent.press(carte.getByText('Oui'));
    await waitFor(() =>
      expect(useTraitementCaptureStore.getState().imp.evaluationsRisquePopulation?.[0].sensibilisation).toBe(true)
    );

    fireEvent.press(carte.getByText('Non'));
    await waitFor(() =>
      expect(useTraitementCaptureStore.getState().imp.evaluationsRisquePopulation?.[0].sensibilisation).toBe(false)
    );
  });

  it('fonctionnement identique en Terrestre (Cas 8)', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      ...DRAFT_MINIMAL,
      type_traitement: 'TERRESTRE',
    } as any);
    useTraitementCaptureStore.setState({ ...RESET_STATE, typeTraitement: 'TERRESTRE' });

    await render(<ImpactsScreen />);
    await screen.findByText('Impacts & risque');
    fireEvent.press(screen.getByText('+ Ajouter une évaluation'));

    expect(await screen.findByText('Évaluation 1')).toBeVisible();
  });

  it('section facultative : « Continuer » fonctionne sans aucune évaluation ajoutée', async () => {
    await render(<ImpactsScreen />);
    await screen.findByText('Impacts & risque');

    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() =>
      expect(traitementRepository.updateTraitementImpacts).toHaveBeenCalledWith(
        'trait-1',
        expect.objectContaining({ evaluationsRisquePopulation: [] })
      )
    );
  });

  it('accepte une distance décimale, jamais transformée (Cas 4)', async () => {
    await render(<ImpactsScreen />);
    await screen.findByText('Impacts & risque');
    fireEvent.press(screen.getByText('+ Ajouter une évaluation'));
    const distance = await screen.findByPlaceholderText('0.0');

    fireEvent.changeText(distance, '1,5');

    await waitFor(() =>
      expect(useTraitementCaptureStore.getState().imp.evaluationsRisquePopulation?.[0].distanceKm).toBe(1.5)
    );
  });

  it('restaure les évaluations déjà enregistrées à la réouverture, dans leur ordre (Cas 5)', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      ...DRAFT_MINIMAL,
      evaluations_risque_population: [
        { id: 'eval-1', traitement_id: 'trait-1', ordre: 0, habitat_proche: 'Rizière', distance_km: 1.5, sensibilisation: 1 },
        { id: 'eval-2', traitement_id: 'trait-1', ordre: 1, habitat_proche: 'Forêt classée', distance_km: 3, sensibilisation: 0 },
      ],
    } as any);

    await render(<ImpactsScreen />);
    await screen.findByText('Évaluation 1');
    expect(screen.getByText('Évaluation 2')).toBeVisible();
    expect(screen.getByDisplayValue('Rizière')).toBeVisible();
    expect(screen.getByDisplayValue('Forêt classée')).toBeVisible();
  });

  it('modifier une évaluation déjà enregistrée conserve la modification (Cas 7)', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      ...DRAFT_MINIMAL,
      evaluations_risque_population: [
        { id: 'eval-1', traitement_id: 'trait-1', ordre: 0, habitat_proche: 'Rizière', distance_km: 1.5, sensibilisation: 1 },
      ],
    } as any);

    await render(<ImpactsScreen />);
    await screen.findByDisplayValue('Rizière');

    fireEvent.changeText(screen.getByDisplayValue('Rizière'), 'Rizière modifiée');
    await screen.findByDisplayValue('Rizière modifiée');
    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() =>
      expect(traitementRepository.updateTraitementImpacts).toHaveBeenCalledWith(
        'trait-1',
        expect.objectContaining({
          evaluationsRisquePopulation: [
            expect.objectContaining({ id: 'eval-1', habitat_proche: 'Rizière modifiée' }),
          ],
        })
      )
    );
  });

  // Dernier test du fichier : seul à enchaîner ≥ 2 `changeText` sur des
  // champs contrôlés distincts (cf. commentaire d'en-tête) — fusionne
  // indépendance des évaluations (Cas 2) et persistance complète à
  // « Continuer » plutôt que deux tests séparés, pour ne jamais laisser un
  // test de ce genre suivi d'un autre dans ce fichier.
  it('permet plusieurs évaluations indépendantes et persiste chacune à « Continuer » (Cas 2)', async () => {
    await render(<ImpactsScreen />);
    await screen.findByText('Impacts & risque');

    fireEvent.press(screen.getByText('+ Ajouter une évaluation'));
    await screen.findByText('Évaluation 1');
    fireEvent.press(screen.getByText('+ Ajouter une évaluation'));
    await screen.findByText('Évaluation 2');

    // Re-récupère les champs après chaque saisie (jamais une référence figée
    // avant coup) et attend la propagation avant d'enchaîner sur le suivant —
    // même prudence que documentée pour les écrans à plusieurs champs
    // contrôlés de ce projet (cf. commentaire d'en-tête).
    fireEvent.changeText(screen.getAllByPlaceholderText('Ex. Rizière, zone humide…')[0], 'Rizière communale');
    await screen.findByDisplayValue('Rizière communale');
    fireEvent.changeText(screen.getAllByPlaceholderText('Ex. Rizière, zone humide…')[1], 'Zone humide protégée');
    await screen.findByDisplayValue('Zone humide protégée');

    fireEvent.press(within(screen.getByTestId('evaluation-risque-population-0')).getByText('Oui'));
    await waitFor(() =>
      expect(useTraitementCaptureStore.getState().imp.evaluationsRisquePopulation?.[0].sensibilisation).toBe(true)
    );
    fireEvent.press(within(screen.getByTestId('evaluation-risque-population-1')).getByText('Non'));
    await waitFor(() =>
      expect(useTraitementCaptureStore.getState().imp.evaluationsRisquePopulation?.[1].sensibilisation).toBe(false)
    );

    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() =>
      expect(traitementRepository.updateTraitementImpacts).toHaveBeenCalledWith(
        'trait-1',
        expect.objectContaining({
          evaluationsRisquePopulation: [
            expect.objectContaining({ habitat_proche: 'Rizière communale', sensibilisation: true }),
            expect.objectContaining({ habitat_proche: 'Zone humide protégée', sensibilisation: false }),
          ],
        })
      )
    );
  });
});
