/**
 * #pesticide-consomme-suggere-mode-traitement : "Pesticides consommés" se
 * pré-remplit automatiquement à partir de "Cumulée (ha)", selon le mode de
 * traitement (Barrière/Couverture totale/Irrégulier) et l'unité choisie
 * (#produits-unite-l-kg) — reste modifiable, jamais verrouillé, jamais
 * écrasé une fois que l'agent y a saisi une valeur.
 *
 * Un produit vide est déjà pré-créé automatiquement à l'ouverture de l'écran
 * (traitement.tsx) dès qu'aucun n'existe encore — ces tests n'ont donc jamais
 * besoin de presser « + Ajouter un produit ». Assertions ciblées via le
 * `testID` du champ (`produit-quantite-input-0`), pas via sa valeur affichée :
 * "Atomiseur à dos" affiche aussi "20" dans ces fixtures, une recherche par
 * valeur seule serait ambiguë.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import TraitementScreen from '@/app/(traitement)/traitement';
import { useTraitementCaptureStore } from '@/lib/traitement-capture-store';
import * as traitementRepository from '@/lib/traitement-repository';

let mockRouteParams: Record<string, string> = { traitementId: 'trait-1' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockRouteParams,
}));

jest.mock('@/lib/traitement-repository', () => ({
  getTraitement: jest.fn(),
  updateTraitementAerien: jest.fn().mockResolvedValue({}),
  updateTraitementTerrestre: jest.fn().mockResolvedValue({}),
  addProduitUtilise: jest.fn().mockResolvedValue({}),
  deleteAllProduitsForTraitementTerrestre: jest.fn().mockResolvedValue(undefined),
  listReprenableTraitements: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/referentiel-db', () => ({
  listUtilisateursByRole: jest.fn().mockResolvedValue([]),
  listPesticides: jest.fn().mockResolvedValue([]),
}));

function terrestreDraft(overrides: Record<string, unknown> = {}) {
  return {
    chef_equipe_id: 'chef-equipe-1',
    agent_encadreur: null,
    consultant_international: null,
    heure_debut: null,
    heure_fin: null,
    vitesse_vent_ms: null,
    direction_vent: null,
    temperature_c: null,
    taux_mortalite_pourcent: null,
    evaluation_efficacite_heures_apres: null,
    methode_evaluation_efficacite: null,
    reprise_traitement: false,
    traitement_origine_id: null,
    surface_atomiseur_ha: 20,
    surface_disque_rotatif_ha: 0,
    surface_atomiseur_autoporte_ha: null,
    surface_restante_abandonnee: null,
    motif_surface_restante_abandonnee: null,
    essence_litres: null,
    nb_piles: null,
    pesticide_unite: null,
    pesticide_recu_l: null,
    stock_initial_l: null,
    produits: [],
    ...overrides,
  };
}

function resetState(modeTraitement: 'TOTAL' | 'BARRIERE' | 'IRREGULIER' | null) {
  useTraitementCaptureStore.setState({
    screen: 'reference',
    isValidationView: false,
    typeTraitement: 'TERRESTRE',
    ref: { modeTraitement },
    aerien: { rotations: [] },
    terrestre: { produits: [] },
    env: {},
    imp: {},
    observations: null,
    signed: {},
    stamps: {},
  } as any);
}

beforeEach(() => {
  mockRouteParams = { traitementId: 'trait-1' };
  jest.mocked(traitementRepository.updateTraitementTerrestre).mockClear().mockResolvedValue({} as any);
});

describe('TerrestreForm — pré-remplissage "Pesticides consommés" selon le mode de traitement', () => {
  it('Barrière + L : pré-remplit Cumulée / 5 (20 ha -> 4)', async () => {
    resetState('BARRIERE');
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      id: 'trait-1',
      type_traitement: 'TERRESTRE',
      cible: { surface_infestee_ha: 0 },
      terrestre: terrestreDraft(),
    } as any);

    await render(<TraitementScreen />);
    await screen.findByText('Produits utilisés');

    await waitFor(() => expect(screen.getByTestId('produit-quantite-input-0').props.value).toBe('4'));
  });

  it('Couverture totale + L : pré-remplit une valeur égale à Cumulée (20 ha)', async () => {
    resetState('TOTAL');
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      id: 'trait-1',
      type_traitement: 'TERRESTRE',
      cible: { surface_infestee_ha: 0 },
      terrestre: terrestreDraft(),
    } as any);

    await render(<TraitementScreen />);
    await screen.findByText('Produits utilisés');

    await waitFor(() => expect(screen.getByTestId('produit-quantite-input-0').props.value).toBe('20'));
  });

  it('Couverture totale + kg : pré-remplit Cumulée / 20 (20 ha -> 1)', async () => {
    resetState('TOTAL');
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      id: 'trait-1',
      type_traitement: 'TERRESTRE',
      cible: { surface_infestee_ha: 0 },
      terrestre: terrestreDraft(),
    } as any);

    await render(<TraitementScreen />);
    await screen.findByText('Produits utilisés');
    fireEvent.press(screen.getByText('Kilos (kg)'));

    await waitFor(() => expect(screen.getByTestId('produit-quantite-input-0').props.value).toBe('1'));
  });

  it('Barrière + kg : aucune formule pour l’instant — passer en kg efface la suggestion Litre posée au montage', async () => {
    resetState('BARRIERE');
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      id: 'trait-1',
      type_traitement: 'TERRESTRE',
      cible: { surface_infestee_ha: 0 },
      terrestre: terrestreDraft(),
    } as any);

    await render(<TraitementScreen />);
    await screen.findByText('Produits utilisés');
    // Au montage, l'unité par défaut est L : la suggestion Barrière (4) est
    // posée avant même le changement d'unité ci-dessous.
    await waitFor(() => expect(screen.getByTestId('produit-quantite-input-0').props.value).toBe('4'));

    fireEvent.press(screen.getByText('Kilos (kg)'));

    await waitFor(() => expect(screen.getByText('Pesticides consommés (kg)')).toBeVisible());
    await waitFor(() => expect(screen.getByTestId('produit-quantite-input-0').props.value).toBe(''));
  });

  it('Irrégulier : aucune formule, le champ reste vide', async () => {
    resetState('IRREGULIER');
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      id: 'trait-1',
      type_traitement: 'TERRESTRE',
      cible: { surface_infestee_ha: 0 },
      terrestre: terrestreDraft(),
    } as any);

    await render(<TraitementScreen />);
    await screen.findByText('Produits utilisés');

    await waitFor(() => expect(screen.getByText('Pesticides consommés (L)')).toBeVisible());
    expect(screen.getByTestId('produit-quantite-input-0').props.value).toBe('');
  });

  it('ne remplace jamais une valeur déjà saisie par l’agent (modifiable)', async () => {
    resetState('BARRIERE');
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      id: 'trait-1',
      type_traitement: 'TERRESTRE',
      cible: { surface_infestee_ha: 0 },
      terrestre: terrestreDraft(),
    } as any);

    await render(<TraitementScreen />);
    await screen.findByText('Produits utilisés');
    await waitFor(() => expect(screen.getByTestId('produit-quantite-input-0').props.value).toBe('4'));

    fireEvent.changeText(screen.getByTestId('produit-quantite-input-0'), '99');
    await waitFor(() => expect(screen.getByTestId('produit-quantite-input-0').props.value).toBe('99'));

    // Un changement d'unité qui recalculerait normalement la suggestion ne
    // doit plus toucher ce champ : l'agent l'a explicitement corrigé.
    fireEvent.press(screen.getByText('Kilos (kg)'));
    await waitFor(() => expect(screen.getByText('Pesticides consommés (kg)')).toBeVisible());
    expect(screen.getByTestId('produit-quantite-input-0').props.value).toBe('99');
  });
});
