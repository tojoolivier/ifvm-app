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
    await fireEvent.press(screen.getByText('Charger les référentiels ›'));
    await screen.findByText('ÉQUIPES AÉRIENNES');

    // --- Équipe aérienne ---
    await fireEvent.press(screen.getByText('+ Nouvelle équipe aérienne'));
    await fireEvent.changeText(screen.getByPlaceholderText("Nom de l'équipe"), 'Équipe Ihosy');
    await fireEvent.press(screen.getByText('Toky Rabe'));
    await fireEvent.press(screen.getByText('Créer'));
    await waitFor(() =>
      expect(apiClient.createEquipeAerienne).toHaveBeenCalledWith('token-test', {
        nom: 'Équipe Ihosy',
        chef_de_base_id: 'chef-1',
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

  it("n'affiche pas de bouton de création de base principale sans équipe disponible", async () => {
    await render(<ReferentielsAeriensScreen />);
    await fireEvent.press(screen.getByText('Charger les référentiels ›'));

    await screen.findByText('BASES PRINCIPALES');
    expect(screen.getByText('Créez d’abord une équipe aérienne.')).toBeTruthy();
    expect(screen.queryByText('+ Nouvelle base principale')).toBeNull();
  });
});
