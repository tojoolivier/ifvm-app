/**
 * Efficacité (migration backend 0058, fiche CRT papier section "Traitement",
 * juste après Condition de traitement) : taux de mortalité observé quelques
 * heures après le traitement, délai de l'évaluation et méthode. Côté Terrestre,
 * saisi sur le même écran « Équipe » (traitement.tsx) que le reste des
 * conditions de traitement (heure/vent/température).
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

const TERRESTRE_DRAFT = {
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
  pesticide_recu_l: null,
  produits: [],
};

describe('TraitementScreen (Équipe, Terrestre) — efficacité (taux de mortalité)', () => {
  beforeEach(() => {
    mockRouteParams = { traitementId: 'trait-1' };
    jest.mocked(traitementRepository.updateTraitementTerrestre).mockClear().mockResolvedValue({} as any);
    useTraitementCaptureStore.setState({ ...RESET_STATE });
  });

  it('saisit et enregistre le taux de mortalité, le délai et la méthode', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      id: 'trait-1',
      type_traitement: 'TERRESTRE',
      cible: { surface_infestee_ha: 0 },
      terrestre: TERRESTRE_DRAFT,
    } as any);

    await render(<TraitementScreen />);
    await waitFor(() => expect(useTraitementCaptureStore.getState().terrestre.chefEquipeId).toBe('chef-equipe-1'));

    // Plusieurs champs partagent le placeholder "0" (vitesse du vent, température,
    // taux de mortalité, délai d'évaluation, …) : ordre de rendu de TerrestreForm.tsx
    // — vitesse_vent_ms (0), temperature_c (1), taux_mortalite_pourcent (2).
    fireEvent.changeText(screen.getAllByPlaceholderText('0')[2], '87.5');
    // Laisse React réconcilier avant l'interaction suivante — sinon son
    // gestionnaire reste lié à la fermeture du rendu précédent (valeur encore
    // vide), même prudence que les autres écrans de ce module.
    expect(await screen.findByDisplayValue('87.5')).toBeVisible();

    fireEvent.press(screen.getByText('Comptages pré/post-traitement'));
    await waitFor(() =>
      expect(screen.getByText('Comptages pré/post-traitement').props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ color: '#fff' })])
      )
    );

    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() =>
      expect(traitementRepository.updateTraitementTerrestre).toHaveBeenCalledWith(
        'trait-1',
        expect.objectContaining({
          taux_mortalite_pourcent: 87.5,
          methode_evaluation_efficacite: 'COMPTAGES_PRE_POST',
        })
      )
    );
  });

  it('restaure une évaluation déjà enregistrée', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      id: 'trait-1',
      type_traitement: 'TERRESTRE',
      cible: { surface_infestee_ha: 0 },
      terrestre: {
        ...TERRESTRE_DRAFT,
        taux_mortalite_pourcent: 92,
        evaluation_efficacite_heures_apres: 6,
        methode_evaluation_efficacite: 'ESTIMATION_VISUELLE',
      },
    } as any);

    await render(<TraitementScreen />);

    await waitFor(() =>
      expect(useTraitementCaptureStore.getState().terrestre.taux_mortalite_pourcent).toBe(92)
    );
    expect(useTraitementCaptureStore.getState().terrestre.evaluation_efficacite_heures_apres).toBe(6);
    expect(useTraitementCaptureStore.getState().terrestre.methode_evaluation_efficacite).toBe(
      'ESTIMATION_VISUELLE'
    );
    expect(screen.getByDisplayValue('92')).toBeVisible();
    expect(screen.getByDisplayValue('6')).toBeVisible();
  });
});
