/**
 * #terrestre-decimales-virgule : sur l'écran « Équipe » (Terrestre,
 * TerrestreForm.tsx), les champs numériques (vitesse du vent, température,
 * surfaces atomiseur/disque rotatif, pesticides consommés par produit,
 * approvisionnement, essence, nombre de piles) utilisaient `Number(v)`
 * directement sur `onChangeText`. Taper une virgule (séparateur décimal
 * français, ex "3,2") produisait `NaN`, aussitôt réaffiché tel quel — la
 * valeur saisie semblait disparaître ou rester bloquée à "NaN". Même
 * correctif que rotations.tsx (#pesticides-rotations-decimales) : conversion
 * virgule→point + état brouillon local par champ.
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

describe('TraitementScreen (Équipe, Terrestre) — saisie décimale francophone (virgule)', () => {
  beforeEach(() => {
    mockRouteParams = { traitementId: 'trait-1' };
    jest.mocked(traitementRepository.updateTraitementTerrestre).mockClear().mockResolvedValue({} as any);
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      id: 'trait-1',
      type_traitement: 'TERRESTRE',
      cible: { surface_infestee_ha: 0 },
      terrestre: TERRESTRE_DRAFT,
    } as any);
    useTraitementCaptureStore.setState({ ...RESET_STATE });
  });

  it('conserve la valeur saisie avec une virgule sur Vitesse du vent, sans jamais afficher NaN', async () => {
    await render(<TraitementScreen />);
    await waitFor(() => expect(useTraitementCaptureStore.getState().terrestre.chefEquipeId).toBe('chef-equipe-1'));

    // Ordre de rendu de TerrestreForm.tsx : vitesse_vent_ms est le premier champ
    // à partager le placeholder "0".
    fireEvent.changeText(screen.getAllByPlaceholderText('0')[0], '3,2');

    expect(await screen.findByDisplayValue('3,2')).toBeVisible();
    expect(screen.queryByDisplayValue('NaN')).toBeNull();

    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() =>
      expect(traitementRepository.updateTraitementTerrestre).toHaveBeenCalledWith(
        'trait-1',
        expect.objectContaining({ vitesse_vent_ms: 3.2 })
      )
    );
  });

  it('permet de renseigner Atomiseur à dos (ha) avec une virgule, sans rester bloqué à NaN', async () => {
    await render(<TraitementScreen />);
    await waitFor(() => expect(useTraitementCaptureStore.getState().terrestre.chefEquipeId).toBe('chef-equipe-1'));

    // vitesse_vent_ms (0), temperature_c (1), surface_atomiseur_ha (2)
    // (efficacité déplacée sur Moyens & protection, #efficacite-moyens-protection).
    fireEvent.changeText(screen.getAllByPlaceholderText('0')[2], '1,5');

    expect(await screen.findByDisplayValue('1,5')).toBeVisible();
    expect(screen.queryByDisplayValue('NaN')).toBeNull();
  });

  it('permet de renseigner Pesticides consommés (l) d’un produit avec une virgule, sans rester bloqué à NaN', async () => {
    await render(<TraitementScreen />);
    await waitFor(() => expect(useTraitementCaptureStore.getState().terrestre.chefEquipeId).toBe('chef-equipe-1'));

    // ... surface_disque_rotatif_ha (4), Pesticides consommés du 1er produit (5).
    fireEvent.changeText(screen.getAllByPlaceholderText('0')[5], '4,25');

    expect(await screen.findByDisplayValue('4,25')).toBeVisible();
    expect(screen.queryByDisplayValue('NaN')).toBeNull();
  });

  it('permet de renseigner Essence (l) avec une virgule, sans rester bloqué à NaN', async () => {
    await render(<TraitementScreen />);
    await waitFor(() => expect(useTraitementCaptureStore.getState().terrestre.chefEquipeId).toBe('chef-equipe-1'));

    // ... Pesticides consommés (5), Approvisionnement (6), Essence (7).
    fireEvent.changeText(screen.getAllByPlaceholderText('0')[7], '10,75');

    expect(await screen.findByDisplayValue('10,75')).toBeVisible();
    expect(screen.queryByDisplayValue('NaN')).toBeNull();
  });
});
