/**
 * BaseAerienneField (#fiche-vol-referentiel-creation-mobile) — sélecteur +
 * création rapide de base aérienne, même contrat que le web
 * (ReferentielsPage.tsx : POST /bases-aeriennes, en ligne uniquement).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { BaseAerienneField } from '@/components/referentiel/BaseAerienneField';
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
    listBasesAeriennes: jest.fn(),
    createBaseAerienne: jest.fn(),
  },
}));

jest.mock('@/lib/location', () => ({
  getCurrentPosition: jest.fn(),
}));

const BASE_PRINCIPALE = {
  id: 'base-1',
  numero: 'IHO01',
  localite: 'Ihosy',
  parent_base_id: null,
  equipe_id: 'equipe-1',
  longitude: 0,
  latitude: 0,
  altitude: 0,
  actif: true,
};

describe('BaseAerienneField', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: 'token-test', user: { id: 'chef-1', role: 'chef_de_base' } } as any);
    jest.mocked(apiClient.listBasesAeriennes).mockReset().mockResolvedValue([BASE_PRINCIPALE] as any);
    jest.mocked(apiClient.createBaseAerienne).mockReset();
    jest.mocked(getCurrentPosition)
      .mockReset()
      .mockResolvedValue({ latitude: -22.4, longitude: 46.1, altitude: 700, accuracy: 5, timestamp: 0 } as any);
  });

  it('propose la base principale existante comme parent pour une base secondaire', async () => {
    const onChange = jest.fn();
    await render(<BaseAerienneField value={null} onChange={onChange} />);

    await screen.findByText('IHO01 — Ihosy');
    fireEvent.press(screen.getByText('+ Nouvelle base secondaire'));

    await screen.findByText('Secondaire de…');
    expect(screen.getByText('IHO01')).toBeVisible();
  });

  it("ne propose que les bases de l'équipe choisie (sa principale et ses secondaires)", async () => {
    const secondaire = { ...BASE_PRINCIPALE, id: 'base-2', numero: 'IHO02', localite: 'Zazafotsy', parent_base_id: 'base-1', equipe_id: null };
    const autrePrincipale = { ...BASE_PRINCIPALE, id: 'base-9', numero: 'BET01', localite: 'Betroka', equipe_id: 'equipe-2' };
    const autreSecondaire = { ...BASE_PRINCIPALE, id: 'base-10', numero: 'BET02', localite: 'Betroka nord', parent_base_id: 'base-9', equipe_id: null };
    jest
      .mocked(apiClient.listBasesAeriennes)
      .mockResolvedValue([BASE_PRINCIPALE, secondaire, autrePrincipale, autreSecondaire] as any);
    await render(<BaseAerienneField value={null} onChange={jest.fn()} equipeId="equipe-1" />);

    await screen.findByText('IHO01 — Ihosy');
    expect(screen.getByText('IHO02 — Zazafotsy (secondaire)')).toBeVisible();
    expect(screen.queryByText('BET01 — Betroka')).toBeNull();
    expect(screen.queryByText('BET02 — Betroka nord (secondaire)')).toBeNull();
  });

  it('sans équipe choisie, toutes les bases restent listées (autres écrans)', async () => {
    const autrePrincipale = { ...BASE_PRINCIPALE, id: 'base-9', numero: 'BET01', localite: 'Betroka', equipe_id: 'equipe-2' };
    jest.mocked(apiClient.listBasesAeriennes).mockResolvedValue([BASE_PRINCIPALE, autrePrincipale] as any);
    await render(<BaseAerienneField value={null} onChange={jest.fn()} />);

    await screen.findByText('BET01 — Betroka');
    expect(screen.getByText('IHO01 — Ihosy')).toBeVisible();
  });

  it('masque la création de base secondaire à un rôle autre que chef de base', async () => {
    useAuthStore.setState({ token: 'token-test', user: { id: 'mecano-1', role: 'mecanicien' } } as any);
    await render(<BaseAerienneField value={null} onChange={jest.fn()} />);

    await screen.findByText('IHO01 — Ihosy');
    expect(screen.queryByText('+ Nouvelle base secondaire')).toBeNull();
  });

  it('crée une base secondaire rattachée au parent choisi', async () => {
    jest.mocked(apiClient.createBaseAerienne).mockResolvedValue({
      id: 'base-2',
      numero: 'IHO02',
      localite: 'Zazafotsy',
      parent_base_id: 'base-1',
      equipe_id: null,
      longitude: 46.1,
      latitude: -22.4,
      altitude: 700,
      actif: true,
    } as any);
    const onChange = jest.fn();
    await render(<BaseAerienneField value={null} onChange={onChange} />);

    await screen.findByText('+ Nouvelle base secondaire');
    fireEvent.press(screen.getByText('+ Nouvelle base secondaire'));

    await screen.findByText('IHO01');
    fireEvent.press(screen.getByText('IHO01'));
    fireEvent.changeText(screen.getByPlaceholderText('Numéro (ex. IHO01)'), 'IHO02');
    fireEvent.changeText(screen.getByPlaceholderText('Localité'), 'Zazafotsy');

    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalled());
    fireEvent.press(screen.getByText('Créer'));

    await waitFor(() =>
      expect(apiClient.createBaseAerienne).toHaveBeenCalledWith('token-test', {
        numero: 'IHO02',
        localite: 'Zazafotsy',
        parent_base_id: 'base-1',
        latitude: -22.4,
        longitude: 46.1,
        altitude: 700,
      })
    );
    expect(onChange).toHaveBeenCalledWith('base-2', {
      id: 'base-2',
      numero: 'IHO02',
      localite: 'Zazafotsy',
      parent_base_id: 'base-1',
      equipe_id: null,
    });
  });
});
