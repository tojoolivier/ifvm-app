/**
 * Section « Moyens & surfaces » du Terrestre (écran Équipe, TerrestreForm.tsx) :
 * « Atomiseur » devient « Atomiseur à dos » (colonne surface_atomiseur_ha
 * inchangée, pur renommage) ; « Disque rotatif » est inchangé.
 *
 * « Atomiseur autoporté » (surface_atomiseur_autoporte_ha) a été retiré de
 * l'écran (demande explicite, Terrestre uniquement) — la colonne backend/
 * SQLite reste en place et continue d'être transmise telle quelle à chaque
 * enregistrement (jamais réinitialisée), pour ne pas effacer silencieusement
 * une valeur déjà saisie sur une fiche existante avant ce retrait.
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
  heure_debut: '06:00',
  heure_fin: '09:00',
  vitesse_vent_ms: 2.5,
  direction_vent: null,
  temperature_c: 26,
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
  produits: [
    { id: 'prod-1', traitement_terrestre_id: 'trait-1', numero: 1, produit_id: 'p1', quantite_l: 10, nom_commercial: 'Fyfanon' },
  ],
};

describe('TraitementScreen (Équipe, Terrestre) — Atomiseur à dos / Disque rotatif (autoporté retiré)', () => {
  beforeEach(() => {
    mockRouteParams = { traitementId: 'trait-1' };
    jest.mocked(traitementRepository.updateTraitementTerrestre).mockClear().mockResolvedValue({} as any);
    useTraitementCaptureStore.setState({ ...RESET_STATE });
  });

  it('affiche Atomiseur à dos et Disque rotatif, jamais ULVAmast, « Atomiseur » seul, ni Atomiseur autoporté', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      id: 'trait-1',
      type_traitement: 'TERRESTRE',
      cible: { surface_infestee_ha: 0 },
      terrestre: TERRESTRE_DRAFT,
    } as any);

    await render(<TraitementScreen />);
    await waitFor(() => expect(screen.getByText('Atomiseur à dos')).toBeVisible());

    expect(screen.getByText('Disque rotatif')).toBeVisible();
    expect(screen.queryByText('ULVAmast')).toBeNull();
    expect(screen.queryByText('Atomiseur')).toBeNull();
    expect(screen.queryByText('Atomiseur autoporté')).toBeNull();
  });

  it('saisit les 2 surfaces restantes et les enregistre sous les bons champs', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      id: 'trait-1',
      type_traitement: 'TERRESTRE',
      cible: { surface_infestee_ha: 0 },
      terrestre: TERRESTRE_DRAFT,
    } as any);

    await render(<TraitementScreen />);
    await waitFor(() => expect(useTraitementCaptureStore.getState().terrestre.chefEquipeId).toBe('chef-equipe-1'));

    // Ordre de rendu (efficacité déplacée sur Moyens & protection, #efficacite-moyens-
    // protection ; Atomiseur autoporté retiré) : vitesse du vent (0), température (1),
    // atomiseur à dos (2), disque rotatif (3).
    fireEvent.changeText(screen.getAllByPlaceholderText('0')[2], '10');
    expect(await screen.findByDisplayValue('10')).toBeVisible();
    fireEvent.changeText(screen.getAllByPlaceholderText('0')[3], '5');
    expect(await screen.findByDisplayValue('5')).toBeVisible();

    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() =>
      expect(traitementRepository.updateTraitementTerrestre).toHaveBeenCalledWith(
        'trait-1',
        expect.objectContaining({
          surface_atomiseur_ha: 10,
          surface_disque_rotatif_ha: 5,
        })
      )
    );
  });

  it("préserve une surface autoportée déjà enregistrée (round-trip silencieux), sans jamais l'afficher ni la réinitialiser", async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      id: 'trait-1',
      type_traitement: 'TERRESTRE',
      cible: { surface_infestee_ha: 0 },
      terrestre: { ...TERRESTRE_DRAFT, surface_atomiseur_autoporte_ha: 7.5 },
    } as any);

    await render(<TraitementScreen />);

    await waitFor(() =>
      expect(useTraitementCaptureStore.getState().terrestre.surface_atomiseur_autoporte_ha).toBe(7.5)
    );
    expect(screen.queryByDisplayValue('7,5')).toBeNull();

    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() =>
      expect(traitementRepository.updateTraitementTerrestre).toHaveBeenCalledWith(
        'trait-1',
        expect.objectContaining({ surface_atomiseur_autoporte_ha: 7.5 })
      )
    );
  });
});
