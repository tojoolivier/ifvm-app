/**
 * StandRemplissageField (#fiche-vol-referentiel-creation-mobile) — sélecteur +
 * création rapide de stand de remplissage, même contrat que le web
 * (ReferentielsPage.tsx : POST /stands-remplissage, en ligne uniquement).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StandRemplissageField } from '@/components/referentiel/StandRemplissageField';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient } from '@/lib/api-client';
import { getCurrentPosition } from '@/lib/location';

// Charge automatiquement au montage (#referentiel-creation-sans-recharger) —
// `useFocusEffect` exige un vrai `NavigationContainer`, absent ici puisque le
// composant est rendu isolément. `useEffect(effect, [])` en tient lieu : au
// montage seulement, jamais à chaque rendu — `charger()` recrée un nouveau
// tableau (`.map()`) à chaque appel, un mock qui rappellerait `effect()` sans
// tenir compte des dépendances boucle indéfiniment.
jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void) => require('react').useEffect(effect, []),
}));

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    listStandsRemplissage: jest.fn(),
    createStandRemplissage: jest.fn(),
  },
}));

jest.mock('@/lib/location', () => ({
  getCurrentPosition: jest.fn(),
}));

const STAND_EXISTANT = {
  id: 'stand-1',
  numero: 'STD01',
  localite: 'Ihosy',
  longitude: 0,
  latitude: 0,
  altitude: 0,
  equipe_aerienne_id: 'equipe-1',
  actif: true,
};
const STAND_AUTRE_EQUIPE = { ...STAND_EXISTANT, id: 'stand-9', numero: 'STD09', localite: 'Betroka', equipe_aerienne_id: 'equipe-2' };
const STAND_SANS_EQUIPE = { ...STAND_EXISTANT, id: 'stand-0', numero: 'STD00', localite: 'Ancien', equipe_aerienne_id: null };

describe('StandRemplissageField', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: 'token-test', user: { id: 'chef-1', role: 'chef_de_base' } } as any);
    jest.mocked(apiClient.listStandsRemplissage).mockReset().mockResolvedValue([STAND_EXISTANT] as any);
    jest.mocked(apiClient.createStandRemplissage).mockReset();
    jest.mocked(getCurrentPosition)
      .mockReset()
      .mockResolvedValue({ latitude: -22.4, longitude: 46.1, altitude: 700, accuracy: 5, timestamp: 0 } as any);
  });

  it('charge la liste et permet de sélectionner un stand existant', async () => {
    const onChange = jest.fn();
    await render(<StandRemplissageField value={null} onChange={onChange} />);

    await screen.findByText('STD01 — Ihosy');

    fireEvent.press(screen.getByText('STD01 — Ihosy'));
    expect(onChange).toHaveBeenCalledWith('stand-1', {
      id: 'stand-1',
      numero: 'STD01',
      localite: 'Ihosy',
      equipe_aerienne_id: 'equipe-1',
    });
  });

  it("ne propose que les stands de l'équipe choisie", async () => {
    jest
      .mocked(apiClient.listStandsRemplissage)
      .mockResolvedValue([STAND_EXISTANT, STAND_AUTRE_EQUIPE, STAND_SANS_EQUIPE] as any);
    await render(<StandRemplissageField value={null} onChange={jest.fn()} equipeId="equipe-1" />);

    await screen.findByText('STD01 — Ihosy');
    expect(screen.queryByText('STD09 — Betroka')).toBeNull();
    // Un stand « sans équipe » (antérieur à la migration) n'appartient à personne.
    expect(screen.queryByText('STD00 — Ancien')).toBeNull();
  });

  it('sans équipe choisie, tous les stands restent listés (autres écrans)', async () => {
    jest.mocked(apiClient.listStandsRemplissage).mockResolvedValue([STAND_EXISTANT, STAND_AUTRE_EQUIPE] as any);
    await render(<StandRemplissageField value={null} onChange={jest.fn()} />);

    await screen.findByText('STD09 — Betroka');
    expect(screen.getByText('STD01 — Ihosy')).toBeVisible();
  });

  it("masque la création de stand à un rôle autre que chef de base", async () => {
    useAuthStore.setState({ token: 'token-test', user: { id: 'pilote-1', role: 'pilote' } } as any);
    await render(<StandRemplissageField value={null} onChange={jest.fn()} />);

    await screen.findByText('STD01 — Ihosy');
    expect(screen.queryByText('+ Nouveau stand de remplissage')).toBeNull();
  });

  it('crée un nouveau stand avec les coordonnées GPS capturées automatiquement', async () => {
    jest.mocked(apiClient.createStandRemplissage).mockResolvedValue({
      id: 'stand-2',
      numero: 'STD02',
      localite: 'Betroka',
      longitude: 46.1,
      latitude: -22.4,
      altitude: 700,
      equipe_aerienne_id: 'equipe-1',
      actif: true,
    } as any);
    const onChange = jest.fn();
    await render(<StandRemplissageField value={null} onChange={onChange} />);

    await screen.findByText('+ Nouveau stand de remplissage');
    fireEvent.press(screen.getByText('+ Nouveau stand de remplissage'));

    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalled());
    await screen.findByText('-22.4000, 46.1000');

    fireEvent.changeText(screen.getByPlaceholderText('Numéro (ex. STD01)'), 'STD02');
    fireEvent.changeText(screen.getByPlaceholderText('Localité'), 'Betroka');
    await screen.findByDisplayValue('Betroka');
    fireEvent.press(screen.getByText('Créer'));

    await waitFor(() =>
      expect(apiClient.createStandRemplissage).toHaveBeenCalledWith('token-test', {
        numero: 'STD02',
        localite: 'Betroka',
        latitude: -22.4,
        longitude: 46.1,
        altitude: 700,
      })
    );
    expect(onChange).toHaveBeenCalledWith('stand-2', {
      id: 'stand-2',
      numero: 'STD02',
      localite: 'Betroka',
      equipe_aerienne_id: 'equipe-1',
    });
  });
});
