/**
 * traitement.tsx (#mes-fiches-chef-equipe) : « Mes fiches » ne retrouve une
 * fiche que si chef_equipe_id (Terrestre) / chef_de_base_id (Aérien) correspond
 * exactement à l'utilisateur connecté (listMesTraitements). Le chef de base est
 * déjà pré-rempli automatiquement côté Aérien — ces tests couvrent la même
 * présélection ajoutée côté Terrestre, et la purge avant réinsertion des
 * produits utilisés (anti-doublon local).
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import TraitementScreen from '@/app/(traitement)/traitement';
import { useTraitementCaptureStore } from '@/lib/traitement-capture-store';
import { useAuthStore } from '@/lib/auth-store';
import * as traitementRepository from '@/lib/traitement-repository';
import * as referentielDb from '@/lib/referentiel-db';

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { traitementId: 'trait-123' } })
);

jest.mock('@/lib/traitement-repository', () => ({
  getTraitement: jest.fn().mockResolvedValue(null),
  updateTraitementAerien: jest.fn().mockResolvedValue(undefined),
  updateTraitementTerrestre: jest.fn().mockResolvedValue(undefined),
  addRotation: jest.fn().mockResolvedValue(undefined),
  addProduitUtilise: jest.fn().mockResolvedValue(undefined),
  deleteAllRotations: jest.fn().mockResolvedValue(undefined),
  deleteAllProduitsUtilises: jest.fn().mockResolvedValue(undefined),
  listReprenableTraitements: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/referentiel-db', () => ({
  listUtilisateursByRole: jest.fn().mockResolvedValue([]),
  listPesticides: jest.fn().mockResolvedValue([]),
}));

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

const UTILISATEUR_CONNECTE = { id: 'user-1', prenom: 'Jean', nom: 'Rakoto', role: 'chef_equipe' } as any;
const CHEF_EQUIPE_CONNECTE = { id: 'user-1', prenom: 'Jean', nom: 'Rakoto' };
const AUTRE_CHEF_EQUIPE = { id: 'user-2', prenom: 'Marc', nom: 'Ravelo' };

function draftTerrestre(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'trait-123',
    type_traitement: 'TERRESTRE',
    cible: null,
    terrestre: {
      traitement_id: 'trait-123',
      chef_equipe_id: null,
      produits: [],
      ...overrides,
    },
  } as any;
}

describe('TraitementScreen — Terrestre', () => {
  afterEach(cleanup);
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(referentielDb.listUtilisateursByRole).mockImplementation(async (role: string) =>
      role === 'chef_equipe' ? [CHEF_EQUIPE_CONNECTE, AUTRE_CHEF_EQUIPE] : []
    );
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue(draftTerrestre());
    jest.mocked(traitementRepository.listReprenableTraitements).mockResolvedValue([]);
    useAuthStore.setState({ user: UTILISATEUR_CONNECTE, token: 'token-1' } as any);
    useTraitementCaptureStore.setState({
      ...useTraitementCaptureStore.getState(),
      typeTraitement: 'TERRESTRE',
      terrestre: { produits: [] },
      aerien: { rotations: [] },
    });
  });

  it('pré-remplit automatiquement le chef d’équipe avec l’utilisateur connecté sur une fiche neuve', async () => {
    await render(<TraitementScreen />);
    await settle();

    await waitFor(() =>
      expect(useTraitementCaptureStore.getState().terrestre.chefEquipeId).toBe('user-1')
    );
  });

  it('n’écrase jamais un chef d’équipe déjà choisi (brouillon repris)', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue(
      draftTerrestre({ chef_equipe_id: 'user-2' })
    );

    await render(<TraitementScreen />);
    await settle();

    await waitFor(() =>
      expect(useTraitementCaptureStore.getState().terrestre.chefEquipeId).toBe('user-2')
    );
  });

  it('purge les produits utilisés existants avant de réinsérer la liste courante (anti-doublon)', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue(
      draftTerrestre({
        chef_equipe_id: 'user-1',
        produits: [
          { id: 'pu-1', produit_id: 'prod-1', quantite_l: 10, nom_commercial: 'Fenitrothion' },
          { id: 'pu-2', produit_id: 'prod-2', quantite_l: 5, nom_commercial: 'Malathion' },
        ],
      })
    );

    await render(<TraitementScreen />);
    await screen.findByText('Continuer  ›');
    await settle();

    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() => expect(traitementRepository.addProduitUtilise).toHaveBeenCalledTimes(2));
    expect(traitementRepository.deleteAllProduitsUtilises).toHaveBeenCalledWith('trait-123');

    // La purge doit précéder la réinsertion, jamais l'inverse.
    const purgeOrder = jest.mocked(traitementRepository.deleteAllProduitsUtilises).mock.invocationCallOrder[0];
    const premierAjoutOrder = jest.mocked(traitementRepository.addProduitUtilise).mock.invocationCallOrder[0];
    expect(purgeOrder).toBeLessThan(premierAjoutOrder);
  });
});
