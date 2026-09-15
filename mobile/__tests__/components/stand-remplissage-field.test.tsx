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

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    listStandsRemplissage: jest.fn(),
    createStandRemplissage: jest.fn(),
  },
}));

jest.mock('@/lib/location', () => ({
  getCurrentPosition: jest.fn(),
}));

const STAND_EXISTANT = { id: 'stand-1', numero: 'STD01', localite: 'Ihosy', longitude: 0, latitude: 0, altitude: 0, actif: true };

describe('StandRemplissageField', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: 'token-test' } as any);
    jest.mocked(apiClient.listStandsRemplissage).mockReset().mockResolvedValue([STAND_EXISTANT] as any);
    jest.mocked(apiClient.createStandRemplissage).mockReset();
    jest.mocked(getCurrentPosition)
      .mockReset()
      .mockResolvedValue({ latitude: -22.4, longitude: 46.1, altitude: 700, accuracy: 5, timestamp: 0 } as any);
  });

  it('charge la liste et permet de sélectionner un stand existant', async () => {
    const onChange = jest.fn();
    await render(<StandRemplissageField value={null} onChange={onChange} />);

    fireEvent.press(screen.getByText('Charger la liste ›'));
    await screen.findByText('STD01 — Ihosy');

    fireEvent.press(screen.getByText('STD01 — Ihosy'));
    expect(onChange).toHaveBeenCalledWith('stand-1', { id: 'stand-1', numero: 'STD01', localite: 'Ihosy' });
  });

  it('crée un nouveau stand avec les coordonnées GPS capturées automatiquement', async () => {
    jest.mocked(apiClient.createStandRemplissage).mockResolvedValue({
      id: 'stand-2',
      numero: 'STD02',
      localite: 'Betroka',
      longitude: 46.1,
      latitude: -22.4,
      altitude: 700,
      actif: true,
    } as any);
    const onChange = jest.fn();
    await render(<StandRemplissageField value={null} onChange={onChange} />);

    fireEvent.press(screen.getByText('Charger la liste ›'));
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
    expect(onChange).toHaveBeenCalledWith('stand-2', { id: 'stand-2', numero: 'STD02', localite: 'Betroka' });
  });
});
