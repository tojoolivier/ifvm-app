/**
 * Écran de gestion des référentiels aériens (#equipe-aerienne) : équipe
 * aérienne, base principale, base secondaire (sites aériens unifiés, #604/#640).
 * Cardinalités : 1 équipe = 1 chef de base = 1 base principale.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ReferentielsAeriensScreen from '@/app/(app)/equipes-aeriennes';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient } from '@/lib/api-client';

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
    listSitesAeriens: jest.fn(),
    createEquipeAerienne: jest.fn(),
    createSiteAerien: jest.fn(),
  },
}));

const CHEF = { id: 'chef-1', nom: 'Rabe', prenom: 'Toky', sigle: null };

describe('ReferentielsAeriensScreen', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: 'token-test', user: { id: 'chef-1', role: 'chef_de_base' } } as any);
    jest.mocked(apiClient.listChefsDeBase).mockReset().mockResolvedValue([CHEF] as any);
    jest.mocked(apiClient.listEquipesAeriennes).mockReset().mockResolvedValue([]);
    jest.mocked(apiClient.listSitesAeriens).mockReset().mockResolvedValue([]);
    jest.mocked(apiClient.createEquipeAerienne).mockReset();
    jest.mocked(apiClient.createSiteAerien).mockReset();
  });

  it('crée une équipe, une base principale, une base secondaire', async () => {
    jest.mocked(apiClient.createEquipeAerienne).mockResolvedValue({
      id: 'equipe-1',
      nom: 'Équipe Ihosy',
      type: 'aerien',
      membres: [{ user_id: 'chef-1', fonction: 'chef', nom: 'Rabe', prenom: 'Toky' }],
      actif: true,
    } as any);
    jest.mocked(apiClient.createSiteAerien)
      .mockResolvedValueOnce({
        id: 'base-1',
        numero: 'IHO01',
        localite: 'Ihosy',
        parent_site_id: null,
        equipe_id: 'equipe-1',
        actif: true,
      } as any)
      .mockResolvedValueOnce({
        id: 'base-2',
        numero: 'IHO02',
        localite: 'Ihosy Sud',
        parent_site_id: 'base-1',
        equipe_id: null,
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
    await fireEvent.changeText(screen.getByPlaceholderText('Immatriculation (ex. 5R-MXY)'), '5R-MJA');
    await fireEvent.changeText(screen.getByPlaceholderText('Société'), 'Heli Madagascar');
    await fireEvent.changeText(screen.getByPlaceholderText('Volume de cuve (L)'), '800');
    await fireEvent.changeText(screen.getByPlaceholderText('Nom du membre'), 'Marie Rafara');
    await fireEvent.press(screen.getByText('Ajouter'));
    await fireEvent.press(screen.getByText('Créer'));
    await waitFor(() =>
      expect(apiClient.createEquipeAerienne).toHaveBeenCalledWith('token-test', {
        nom: 'Équipe Ihosy',
        type: 'aerien',
        aeronef: { immatriculation: '5R-MJA', societe: 'Heli Madagascar', volume_cuve_l: 800 },
        membres: [
          { user_id: 'chef-1', fonction: 'chef' },
          { nom: 'Jean Rakoto', fonction: 'pilote' },
          { nom: 'Paul Rasoa', fonction: 'mecanicien' },
          { nom: 'Marie Rafara', fonction: 'membre' },
        ],
      })
    );
    await screen.findByText('Équipe Ihosy');

    // --- Base principale ---
    await fireEvent.press(screen.getByText('+ Nouvelle base principale'));
    await fireEvent.changeText(screen.getByPlaceholderText('Numéro (ex. IHO01)'), 'IHO01');
    await fireEvent.changeText(screen.getByPlaceholderText('Localité'), 'Ihosy');
    await fireEvent.press(screen.getAllByText('Équipe Ihosy')[1]);
    await fireEvent.press(screen.getByText('Créer'));
    await waitFor(() =>
      expect(apiClient.createSiteAerien).toHaveBeenCalledWith('token-test', {
        numero: 'IHO01',
        localite: 'Ihosy',
        equipe_id: 'equipe-1',
      })
    );
    await screen.findByText('IHO01 — Ihosy');

    // --- Base secondaire ---
    await fireEvent.press(screen.getByText('+ Nouvelle base secondaire'));
    await fireEvent.changeText(screen.getByPlaceholderText('Numéro (ex. IHO02)'), 'IHO02');
    await fireEvent.changeText(screen.getByPlaceholderText('Localité'), 'Ihosy Sud');
    await fireEvent.press(screen.getByText('IHO01'));
    await fireEvent.press(screen.getByText('Créer'));
    await waitFor(() =>
      expect(apiClient.createSiteAerien).toHaveBeenCalledWith('token-test', {
        numero: 'IHO02',
        localite: 'Ihosy Sud',
        parent_site_id: 'base-1',
      })
    );
    await screen.findByText('IHO02 — Ihosy Sud');
  });

  it('ajoute et retire un membre avant de créer une équipe', async () => {
    jest.mocked(apiClient.createEquipeAerienne).mockResolvedValue({
      id: 'equipe-1',
      nom: 'Équipe Ihosy',
      type: 'aerien',
      membres: [{ user_id: 'chef-1', fonction: 'chef', nom: 'Rabe', prenom: 'Toky' }],
      actif: true,
    } as any);

    await render(<ReferentielsAeriensScreen />);
    await screen.findByText('ÉQUIPES AÉRIENNES');

    await fireEvent.press(screen.getByText('+ Nouvelle équipe aérienne'));
    await fireEvent.changeText(screen.getByPlaceholderText("Nom de l'équipe"), 'Équipe Ihosy');
    await fireEvent.press(screen.getByText('Toky Rabe'));
    await fireEvent.changeText(screen.getByPlaceholderText('Pilote'), 'Jean Rakoto');
    await fireEvent.changeText(screen.getByPlaceholderText('Mécanicien'), 'Paul Rasoa');
    await fireEvent.changeText(screen.getByPlaceholderText('Immatriculation (ex. 5R-MXY)'), '5R-MJA');
    await fireEvent.changeText(screen.getByPlaceholderText('Société'), 'Heli Madagascar');
    await fireEvent.changeText(screen.getByPlaceholderText('Volume de cuve (L)'), '800');

    await fireEvent.changeText(screen.getByPlaceholderText('Nom du membre'), 'Membre à retirer');
    await fireEvent.press(screen.getByText('Ajouter'));
    await screen.findByText('Membre à retirer');
    await fireEvent.press(screen.getByText('Retirer'));
    expect(screen.queryByText('Membre à retirer')).toBeNull();

    await fireEvent.press(screen.getByText('Créer'));
    await waitFor(() =>
      expect(apiClient.createEquipeAerienne).toHaveBeenCalledWith('token-test', {
        nom: 'Équipe Ihosy',
        type: 'aerien',
        aeronef: { immatriculation: '5R-MJA', societe: 'Heli Madagascar', volume_cuve_l: 800 },
        membres: [
          { user_id: 'chef-1', fonction: 'chef' },
          { nom: 'Jean Rakoto', fonction: 'pilote' },
          { nom: 'Paul Rasoa', fonction: 'mecanicien' },
        ],
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
  // référentiels » indéfiniment alors que les autres référentiels ont bien
  // été chargés — chacun d'eux est indépendant, l'écran doit rester utilisable.
  it('reste utilisable (sites aériens) même si /equipes échoue', async () => {
    jest.mocked(apiClient.listEquipesAeriennes).mockRejectedValue(new Error('Not Found'));
    jest.mocked(apiClient.listSitesAeriens).mockResolvedValue([
      {
        id: 'base-1',
        numero: 'IHO01',
        localite: 'Ihosy',
        parent_site_id: null,
        equipe_id: 'equipe-1',
        actif: true,
      },
    ] as any);

    await render(<ReferentielsAeriensScreen />);

    await screen.findByText('IHO01 — Ihosy');
    expect(screen.getByText(/équipes aériennes/)).toBeTruthy();
    expect(screen.queryByText('Charger les référentiels ›')).toBeNull();
  });

  // Seul le chef de base crée les lieux de SON équipe (le serveur répond 403 sinon) :
  // inutile de proposer des formulaires voués à l'échec aux autres rôles.
  it("masque la création de bases à un rôle autre que chef de base", async () => {
    useAuthStore.setState({ token: 'token-test', user: { id: 'pilote-1', role: 'pilote' } } as any);
    jest.mocked(apiClient.listEquipesAeriennes).mockResolvedValue([
      {
        id: 'equipe-1',
        nom: 'Équipe Ihosy',
        type: 'aerien',
        membres: [{ user_id: 'chef-1', fonction: 'chef', nom: 'Rabe', prenom: 'Toky' }],
        actif: true,
      },
    ] as any);
    jest.mocked(apiClient.listSitesAeriens).mockResolvedValue([
      { id: 'base-1', numero: 'IHO01', localite: 'Ihosy', parent_site_id: null, equipe_id: 'equipe-1', actif: true },
    ] as any);

    await render(<ReferentielsAeriensScreen />);

    await screen.findByText('IHO01 — Ihosy');
    expect(screen.queryByText('+ Nouvelle base principale')).toBeNull();
    expect(screen.queryByText('+ Nouvelle base secondaire')).toBeNull();
  });

  it("affiche l'hélicoptère de chaque équipe", async () => {
    jest.mocked(apiClient.listEquipesAeriennes).mockResolvedValue([
      {
        id: 'equipe-1',
        nom: 'Équipe Ihosy',
        type: 'aerien',
        membres: [{ user_id: 'chef-1', fonction: 'chef', nom: 'Rabe', prenom: 'Toky' }],
        aeronef: { immatriculation: '5R-MJA', societe: 'Heli Madagascar', volume_cuve_l: 800 },
        actif: true,
      },
    ] as any);

    await render(<ReferentielsAeriensScreen />);

    await screen.findByText('Hélicoptère : 5R-MJA — Heli Madagascar (cuve 800 L)');
  });
});
