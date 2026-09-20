/**
 * #produits-unite-l-kg : la section "Produits utilisés" de l'écran Équipe
 * (Terrestre, TerrestreForm.tsx) propose un choix d'unité (Litres/Kilos) qui
 * gouverne le libellé des 5 champs "Pesticides consommés", "Total pesticide",
 * "Stock initial", "Approvisionnement", "Stock Final" — un seul choix pour
 * toute la fiche (contrairement à Rotation.unite côté Aérien, propre à chaque
 * rotation avec deux totaux distincts jamais additionnés).
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

const RESET_STATE = {
  screen: 'reference' as const,
  isValidationView: false,
  typeTraitement: 'TERRESTRE' as const,
  ref: {},
  aerien: { rotations: [] },
  terrestre: { produits: [] },
  env: {},
  imp: {},
  observations: null,
  signed: {},
  stamps: {},
};

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
    surface_atomiseur_ha: null,
    surface_disque_rotatif_ha: null,
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

describe('TerrestreForm — unité Produits utilisés (Litres/Kilos)', () => {
  beforeEach(() => {
    mockRouteParams = { traitementId: 'trait-1' };
    jest.mocked(traitementRepository.updateTraitementTerrestre).mockClear().mockResolvedValue({} as any);
    useTraitementCaptureStore.setState({ ...RESET_STATE });
  });

  it('affiche les 5 champs en (L) par défaut, quand aucune unité n’a encore été choisie', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      id: 'trait-1',
      type_traitement: 'TERRESTRE',
      cible: { surface_infestee_ha: 0 },
      terrestre: terrestreDraft(),
    } as any);

    await render(<TraitementScreen />);
    await screen.findByText('Produits utilisés');

    expect(screen.getByText('Total pesticide (L)')).toBeVisible();
    expect(screen.getByText('Stock initial (L)')).toBeVisible();
    expect(screen.getByText('Approvisionnement (L)')).toBeVisible();
  });

  it('bascule tous les libellés en (kg) après avoir choisi "Kilos (kg)", et l’enregistre', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      id: 'trait-1',
      type_traitement: 'TERRESTRE',
      cible: { surface_infestee_ha: 0 },
      terrestre: terrestreDraft(),
    } as any);

    await render(<TraitementScreen />);
    await screen.findByText('Produits utilisés');

    fireEvent.press(screen.getByText('Kilos (kg)'));

    expect(await screen.findByText('Total pesticide (kg)')).toBeVisible();
    expect(screen.getByText('Stock initial (kg)')).toBeVisible();
    expect(screen.getByText('Approvisionnement (kg)')).toBeVisible();
    expect(screen.queryByText('Total pesticide (L)')).toBeNull();

    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() =>
      expect(traitementRepository.updateTraitementTerrestre).toHaveBeenCalledWith(
        'trait-1',
        expect.objectContaining({ pesticideUnite: 'kg' })
      )
    );
  });

  it('restaure une fiche déjà enregistrée en kilos, avec les libellés correspondants', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      id: 'trait-1',
      type_traitement: 'TERRESTRE',
      cible: { surface_infestee_ha: 0 },
      terrestre: terrestreDraft({ pesticide_unite: 'kg', stock_initial_l: 40, pesticide_recu_l: 150 }),
    } as any);

    await render(<TraitementScreen />);

    expect(await screen.findByText('Total pesticide (kg)')).toBeVisible();
    expect(screen.getByText('Stock initial (kg)')).toBeVisible();
    expect(screen.getByText('Approvisionnement (kg)')).toBeVisible();
  });
});
