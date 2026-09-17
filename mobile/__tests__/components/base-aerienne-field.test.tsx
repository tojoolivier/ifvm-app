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
    useAuthStore.setState({ token: 'token-test' } as any);
    jest.mocked(apiClient.listBasesAeriennes).mockReset().mockResolvedValue([BASE_PRINCIPALE] as any);
    jest.mocked(apiClient.createBaseAerienne).mockReset();
    jest.mocked(getCurrentPosition)
      .mockReset()
      .mockResolvedValue({ latitude: -22.4, longitude: 46.1, altitude: 700, accuracy: 5, timestamp: 0 } as any);
  });

  it('propose la base principale existante comme parent pour une base secondaire', async () => {
    const onChange = jest.fn();
    await render(<BaseAerienneField value={null} onChange={onChange} />);

    fireEvent.press(screen.getByText('Charger la liste ›'));
    await screen.findByText('IHO01 — Ihosy');
    fireEvent.press(screen.getByText('+ Nouvelle base secondaire'));

    await screen.findByText('Secondaire de…');
    expect(screen.getByText('IHO01')).toBeVisible();
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

    fireEvent.press(screen.getByText('Charger la liste ›'));
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
