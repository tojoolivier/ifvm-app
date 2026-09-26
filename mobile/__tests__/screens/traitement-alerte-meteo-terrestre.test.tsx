/**
 * #alerte-meteo-vent-temperature (Terrestre) : vent > 6 m/s ou température > 35 °C
 * → avertissement « annulez le traitement » affiché en direct sous le champ, et
 * « Continuer » refusé tant que la valeur n'est pas corrigée. 6 m/s et 35 °C pile
 * restent autorisés.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import TraitementScreen from '@/app/(traitement)/traitement';
import { useTraitementCaptureStore } from '@/lib/traitement-capture-store';
import * as traitementRepository from '@/lib/traitement-repository';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({ traitementId: 'trait-1' }),
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

const terrestre = (vent: number, temperature: number) => ({
  chef_equipe_id: 'chef-equipe-1',
  agent_encadreur: null,
  consultant_international: null,
  heure_debut: '06:00',
  heure_fin: '09:00',
  vitesse_vent_ms: vent,
  direction_vent: null,
  temperature_c: temperature,
  reprise_traitement: false,
  traitement_origine_id: null,
  surface_atomiseur_ha: null,
  surface_disque_rotatif_ha: null,
  surface_atomiseur_autoporte_ha: null,
  surface_restante_abandonnee: null,
  motif_surface_restante_abandonnee: null,
  pesticide_recu_l: null,
  stock_initial_l: null,
  // Un produit complet : un écran sans produit en amorce une ligne vide, qui bloquerait
  // « Continuer » pour une tout autre raison (produit et quantité obligatoires).
  produits: [
    { id: 'prod-1', traitement_terrestre_id: 'trait-1', numero: 1, produit_id: 'p1', quantite_l: 10, nom_commercial: 'Fyfanon' },
  ],
});

const charger = async (vent: number, temperature: number) => {
  jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
    id: 'trait-1',
    type_traitement: 'TERRESTRE',
    cible: { surface_infestee_ha: 0 },
    terrestre: terrestre(vent, temperature),
  } as any);
  await render(<TraitementScreen />);
  await waitFor(() => expect(useTraitementCaptureStore.getState().terrestre.chefEquipeId).toBe('chef-equipe-1'));
};

beforeEach(() => {
  mockPush.mockClear();
  jest.mocked(traitementRepository.updateTraitementTerrestre).mockClear().mockResolvedValue({} as any);
  useTraitementCaptureStore.setState({ ...RESET_STATE });
});

describe('TraitementScreen (Équipe, Terrestre) — alerte vent / température', () => {
  it('avertit et refuse de continuer quand le vent dépasse 6 m/s', async () => {
    await charger(7, 26);

    expect(await screen.findByText(/Vitesse du vent supérieure à 6 m\/s/)).toBeVisible();
    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() => expect(screen.getAllByText(/Vitesse du vent supérieure à 6 m\/s/).length).toBeGreaterThan(0));
    expect(traitementRepository.updateTraitementTerrestre).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('avertit et refuse de continuer quand la température dépasse 35 °C', async () => {
    await charger(2, 36);

    expect(await screen.findByText(/Température supérieure à 35 °C/)).toBeVisible();
    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() => expect(screen.getAllByText(/Température supérieure à 35 °C/).length).toBeGreaterThan(0));
    expect(traitementRepository.updateTraitementTerrestre).not.toHaveBeenCalled();
  });

  it('débloque « Continuer » dès que la valeur est corrigée', async () => {
    await charger(7, 26);
    await screen.findByText(/Vitesse du vent supérieure à 6 m\/s/);

    fireEvent.changeText(screen.getAllByPlaceholderText('0')[0], '5');
    await waitFor(() => expect(screen.queryByText(/Vitesse du vent supérieure à 6 m\/s/)).toBeNull());

    fireEvent.press(screen.getByText('Continuer  ›'));
    await waitFor(() =>
      expect(traitementRepository.updateTraitementTerrestre).toHaveBeenCalledWith(
        'trait-1',
        expect.objectContaining({ vitesse_vent_ms: 5 })
      )
    );
  });

  it('autorise 6 m/s et 35 °C pile, sans aucun avertissement', async () => {
    await charger(6, 35);

    expect(screen.queryByText(/Vitesse du vent supérieure/)).toBeNull();
    expect(screen.queryByText(/Température supérieure/)).toBeNull();
    fireEvent.press(screen.getByText('Continuer  ›'));
    await waitFor(() => expect(traitementRepository.updateTraitementTerrestre).toHaveBeenCalled());
  });
});
