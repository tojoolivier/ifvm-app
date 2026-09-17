/**
 * Écran de gestion des référentiels aériens (#equipe-aerienne) : équipe
 * aérienne, base principale, base secondaire, stand de remplissage.
 * Cardinalités : 1 équipe = 1 chef de base = 1 base principale.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ReferentielsAeriensScreen from '@/app/(fiche-vol)/referentiels';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient } from '@/lib/api-client';
import { getCurrentPosition } from '@/lib/location';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  // Chargé automatiquement au montage (#referentiel-creation-sans-recharger) —
  // au montage seulement (deps []), jamais à chaque rendu : `charger()` pose
  // de nouveaux tableaux (`setChefs`/`setEquipes`/...) à chaque appel, un mock
  // qui rappellerait `effect()` sans tenir compte des dépendances boucle
  // indéfiniment.
  useFocusEffect: (effect: () => void) => require('react').useEffect(effect, []),
}));

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    listChefsDeBase: jest.fn(),
    listEquipesAeriennes: jest.fn(),
    listBasesAeriennes: jest.fn(),
    listStandsRemplissage: jest.fn(),
    createEquipeAerienne: jest.fn(),
    createBaseAerienne: jest.fn(),
    createStandRemplissage: jest.fn(),
  },
}));

jest.mock('@/lib/location', () => ({
  getCurrentPosition: jest.fn(),
}));

const CHEF = { id: 'chef-1', nom: 'Rabe', prenom: 'Toky', sigle: null };

describe('ReferentielsAeriensScreen', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: 'token-test' } as any);
    jest.mocked(apiClient.listChefsDeBase).mockReset().mockResolvedValue([CHEF] as any);
    jest.mocked(apiClient.listEquipesAeriennes).mockReset().mockResolvedValue([]);
    jest.mocked(apiClient.listBasesAeriennes).mockReset().mockResolvedValue([]);
    jest.mocked(apiClient.listStandsRemplissage).mockReset().mockResolvedValue([]);
    jest.mocked(apiClient.createEquipeAerienne).mockReset();
    jest.mocked(apiClient.createBaseAerienne).mockReset();
    jest.mocked(apiClient.createStandRemplissage).mockReset();
    jest.mocked(getCurrentPosition)
      .mockReset()
      .mockResolvedValue({ latitude: -22.4, longitude: 46.1, altitude: 700, accuracy: 5, timestamp: 0 } as any);
  });

  it('crée une équipe, une base principale, une base secondaire puis un stand', async () => {
    jest.mocked(apiClient.createEquipeAerienne).mockResolvedValue({
      id: 'equipe-1',
      nom: 'Équipe Ihosy',
      chef_de_base_id: 'chef-1',
      actif: true,
    } as any);
    jest.mocked(apiClient.createBaseAerienne)
      .mockResolvedValueOnce({
        id: 'base-1',
        numero: 'IHO01',
        localite: 'Ihosy',
        parent_base_id: null,
        equipe_id: 'equipe-1',
        actif: true,
      } as any)
      .mockResolvedValueOnce({
        id: 'base-2',
        numero: 'IHO02',
        localite: 'Ihosy Sud',
        parent_base_id: 'base-1',
        equipe_id: null,
        actif: true,
      } as any);
    jest.mocked(apiClient.createStandRemplissage).mockResolvedValue({
      id: 'stand-1',
      numero: 'STD01',
      localite: 'Ihosy',
      actif: true,
    } as any);

    await render(<ReferentielsAeriensScreen />);
    await screen.findByText('ÉQUIPES AÉRIENNES');

    // --- Équipe aérienne ---
    await fireEvent.press(screen.getByText('+ Nouvelle équipe aérienne'));
    await fireEvent.changeText(screen.getByPlaceholderText("Nom de l'équipe"), 'Équipe Ihosy');
    await fireEvent.press(screen.getByText('Toky Rabe'));
    await fireEvent.changeText(screen.getByPlaceholderText('Pilote'), 'Jean Rakoto');
    await fireEvent.changeText(screen.getByPlaceholderText('Mécanicien'), 'Paul Rasoa');
    await fireEvent.changeText(screen.getByPlaceholderText('Nom du membre'), 'Marie Rafara');
    await fireEvent.press(screen.getByText('Ajouter'));
    await fireEvent.press(screen.getByText('Créer'));
    await waitFor(() =>
      expect(apiClient.createEquipeAerienne).toHaveBeenCalledWith('token-test', {
        nom: 'Équipe Ihosy',
        chef_de_base_id: 'chef-1',
        pilote: 'Jean Rakoto',
        mecanicien: 'Paul Rasoa',
        consultant_international: null,
        membres: [{ nom: 'Marie Rafara' }],
      })
    );
    await screen.findByText('Équipe Ihosy');

    // --- Base principale ---
    await fireEvent.press(screen.getByText('+ Nouvelle base principale'));
    await fireEvent.changeText(screen.getByPlaceholderText('Numéro (ex. IHO01)'), 'IHO01');
    await fireEvent.changeText(screen.getByPlaceholderText('Localité'), 'Ihosy');
    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalled());
    await fireEvent.press(screen.getAllByText('Équipe Ihosy')[1]);
    await fireEvent.press(screen.getByText('Créer'));
    await waitFor(() =>
      expect(apiClient.createBaseAerienne).toHaveBeenCalledWith('token-test', {
        numero: 'IHO01',
        localite: 'Ihosy',
        equipe_id: 'equipe-1',
        latitude: -22.4,
        longitude: 46.1,
        altitude: 700,
      })
    );
    await screen.findByText('IHO01 — Ihosy');

    // --- Base secondaire ---
    await fireEvent.press(screen.getByText('+ Nouvelle base secondaire'));
    await fireEvent.changeText(screen.getByPlaceholderText('Numéro (ex. IHO02)'), 'IHO02');
    await fireEvent.changeText(screen.getByPlaceholderText('Localité'), 'Ihosy Sud');
    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalledTimes(2));
    await fireEvent.press(screen.getByText('IHO01'));
    await fireEvent.press(screen.getByText('Créer'));
    await waitFor(() =>
      expect(apiClient.createBaseAerienne).toHaveBeenCalledWith('token-test', {
        numero: 'IHO02',
        localite: 'Ihosy Sud',
        parent_base_id: 'base-1',
        latitude: -22.4,
        longitude: 46.1,
        altitude: 700,
      })
    );
    await screen.findByText('IHO02 — Ihosy Sud');

    // --- Stand de remplissage ---
    await fireEvent.press(screen.getByText('+ Nouveau stand de remplissage'));
    await fireEvent.changeText(screen.getByPlaceholderText('Numéro (ex. STD01)'), 'STD01');
    await fireEvent.changeText(screen.getByPlaceholderText('Localité'), 'Ihosy');
    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalledTimes(3));
    await fireEvent.press(screen.getByText('Créer'));
    await waitFor(() =>
      expect(apiClient.createStandRemplissage).toHaveBeenCalledWith('token-test', {
        numero: 'STD01',
        localite: 'Ihosy',
        latitude: -22.4,
        longitude: 46.1,
        altitude: 700,
      })
    );
    await screen.findByText('STD01 — Ihosy');
  });

  it('ajoute et retire un membre avant de créer une équipe', async () => {
    jest.mocked(apiClient.createEquipeAerienne).mockResolvedValue({
      id: 'equipe-1',
      nom: 'Équipe Ihosy',
      chef_de_base_id: 'chef-1',
      actif: true,
    } as any);

    await render(<ReferentielsAeriensScreen />);
    await screen.findByText('ÉQUIPES AÉRIENNES');

    await fireEvent.press(screen.getByText('+ Nouvelle équipe aérienne'));
    await fireEvent.changeText(screen.getByPlaceholderText("Nom de l'équipe"), 'Équipe Ihosy');
    await fireEvent.press(screen.getByText('Toky Rabe'));
    await fireEvent.changeText(screen.getByPlaceholderText('Pilote'), 'Jean Rakoto');
    await fireEvent.changeText(screen.getByPlaceholderText('Mécanicien'), 'Paul Rasoa');

    await fireEvent.changeText(screen.getByPlaceholderText('Nom du membre'), 'Membre à retirer');
    await fireEvent.press(screen.getByText('Ajouter'));
    await screen.findByText('Membre à retirer');
    await fireEvent.press(screen.getByText('Retirer'));
    expect(screen.queryByText('Membre à retirer')).toBeNull();

    await fireEvent.press(screen.getByText('Créer'));
    await waitFor(() =>
      expect(apiClient.createEquipeAerienne).toHaveBeenCalledWith('token-test', {
        nom: 'Équipe Ihosy',
        chef_de_base_id: 'chef-1',
        pilote: 'Jean Rakoto',
        mecanicien: 'Paul Rasoa',
        consultant_international: null,
        membres: [],
      })
    );
  });

  it("n'affiche pas de bouton de création de base principale sans équipe disponible", async () => {
    await render(<ReferentielsAeriensScreen />);

    await screen.findByText('BASES PRINCIPALES');
    expect(screen.getByText('Créez d’abord une équipe aérienne.')).toBeTruthy();
    expect(screen.queryByText('+ Nouvelle base principale')).toBeNull();
  });

  // #referentiel-echec-partiel : /equipes-aeriennes non déployé sur un
  // environnement (404) ne doit pas retomber sur le bouton « Charger les
  // référentiels » indéfiniment alors que les 3 autres référentiels ont bien
  // été chargés — chacun d'eux est indépendant, l'écran doit rester utilisable.
  it('reste utilisable (bases/stands) même si /equipes-aeriennes échoue', async () => {
    jest.mocked(apiClient.listEquipesAeriennes).mockRejectedValue(new Error('Not Found'));
    jest.mocked(apiClient.listBasesAeriennes).mockResolvedValue([
      {
        id: 'base-1',
        numero: 'IHO01',
        localite: 'Ihosy',
        parent_base_id: null,
        equipe_id: 'equipe-1',
        actif: true,
      },
    ] as any);
    jest.mocked(apiClient.listStandsRemplissage).mockResolvedValue([
      { id: 'stand-1', numero: 'STD01', localite: 'Ihosy', actif: true },
    ] as any);

    await render(<ReferentielsAeriensScreen />);

    await screen.findByText('IHO01 — Ihosy');
    expect(screen.getByText('STD01 — Ihosy')).toBeTruthy();
    expect(screen.getByText(/équipes aériennes/)).toBeTruthy();
    expect(screen.queryByText('Charger les référentiels ›')).toBeNull();
  });
});
