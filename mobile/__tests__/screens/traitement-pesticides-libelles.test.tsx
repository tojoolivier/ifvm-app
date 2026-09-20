/**
 * Libellés « Pesticides » alignés sur le vocabulaire de la fiche CRT papier
 * (section 5, Pesticides) : « Pesticide reçu » devient « Approvisionnement »,
 * « Quantité » (par produit/rotation) devient « Pesticides consommés » — sur
 * Terrestre (TerrestreForm.tsx, écran Équipe) comme sur Aérien (rotations.tsx).
 * Aucun champ ni type ne change, seul le texte affiché.
 */
import { render, screen, waitFor } from '@testing-library/react-native';
import TraitementScreen from '@/app/(traitement)/traitement';
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
  updateTraitementAerien: jest.fn().mockResolvedValue({}),
  updateTraitementTerrestre: jest.fn().mockResolvedValue({}),
  addProduitUtilise: jest.fn().mockResolvedValue({}),
  deleteAllProduitsForTraitementTerrestre: jest.fn().mockResolvedValue(undefined),
  addRotation: jest.fn().mockResolvedValue({}),
  deleteAllRotationsForTraitementAerien: jest.fn().mockResolvedValue(undefined),
  updateTraitementAerienPesticideRecu: jest.fn().mockResolvedValue({}),
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

describe('TraitementScreen (Équipe, Terrestre) — libellés Pesticides', () => {
  beforeEach(() => {
    mockRouteParams = { traitementId: 'trait-1' };
    useTraitementCaptureStore.setState({ ...RESET_STATE, typeTraitement: 'TERRESTRE' });
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      id: 'trait-1',
      type_traitement: 'TERRESTRE',
      cible: { surface_infestee_ha: 0 },
      terrestre: {
        chef_equipe_id: 'chef-equipe-1',
        agent_encadreur: null,
        consultant_international: null,
        heure_debut: null,
        heure_fin: null,
        vitesse_vent_ms: null,
        direction_vent: null,
        temperature_c: null,
        reprise_traitement: false,
        traitement_origine_id: null,
        surface_atomiseur_ha: null,
        surface_disque_rotatif_ha: null,
        surface_atomiseur_autoporte_ha: null,
        surface_restante_abandonnee: null,
        motif_surface_restante_abandonnee: null,
        essence_litres: null,
        nb_piles: null,
        pesticide_recu_l: null,
        produits: [{ produit_id: 'prod-1', quantite_l: 5, nom_commercial: 'Fyfanon' }],
      },
    } as any);
  });

  it('affiche « Approvisionnement (L) » et « Pesticides consommés (L) », plus « Pesticide reçu »/« Quantité (l) »', async () => {
    await render(<TraitementScreen />);

    // (L) majuscule : #produits-unite-l-kg, la même casse que le contrat backend
    // UniteQuantite ("L"/"kg"), plutôt que le litre littéral figé d'avant.
    await waitFor(() => expect(screen.getByText('Approvisionnement (L)')).toBeVisible());
    expect(screen.getByText('Pesticides consommés (L)')).toBeVisible();
    expect(screen.queryByText('Pesticide reçu (l)')).toBeNull();
    expect(screen.queryByText('Quantité (l)')).toBeNull();
  });
});

describe('RotationsScreen (Aérien) — libellés Pesticides', () => {
  beforeEach(() => {
    mockRouteParams = { traitementId: 'trait-1' };
    useTraitementCaptureStore.setState({ ...RESET_STATE, typeTraitement: 'AERIEN' });
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      id: 'trait-1',
      type_traitement: 'AERIEN',
      cible: { surface_infestee_ha: 100 },
      aerien: { pesticide_recu_l: null, rotations: [] },
    } as any);
  });

  it('affiche « Approvisionnement (l) » et « Pesticides consommés (l) », plus « Pesticide reçu »/« Quantité »', async () => {
    await render(<RotationsScreen />);

    await waitFor(() => expect(screen.getByText('Approvisionnement (l)')).toBeVisible());
    expect(screen.getByText('Pesticides consommés (l) *')).toBeVisible();
    expect(screen.queryByText('Pesticide reçu (l)')).toBeNull();
    expect(screen.queryByText('Quantité (l) *')).toBeNull();
  });
});
