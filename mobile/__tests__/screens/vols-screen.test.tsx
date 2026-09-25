/** « Mes vols » : tous les vols, toutes origines, avec statut de synchro (#644, Figma 81:524). */
import { fireEvent, render, screen } from '@testing-library/react-native';
import VolsScreen from '@/app/(app)/vols';
import { useEquipeTravailStore } from '@/lib/equipe-travail-store';
import { listVols } from '@/lib/vol-db';

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    useRouter: () => ({ back: jest.fn(), push: mockPush }),
    useFocusEffect: (callback: () => void) => useEffect(callback, [callback]),
  };
});
jest.mock('@/lib/storage', () => ({ storage: { getItem: jest.fn(), setItem: jest.fn(), deleteItem: jest.fn() } }));
jest.mock('@/lib/vol-db', () => ({ listVols: jest.fn() }));

const vol = (surcharge: object) => ({
  id: 'v',
  categorie: 'application',
  origine: 'traitement',
  date_vol: '2026-09-23',
  heure_debut: '06:30',
  heure_fin: '09:15',
  lieu_depart: null,
  lieu_arrivee: null,
  libelle_lieu: 'Isoanala',
  statut_sync: 'synced',
  ...surcharge,
});

beforeEach(() => {
  mockPush.mockReset();
  useEquipeTravailStore.setState({ equipeId: 'eq-1', isInitialized: true });
  jest.mocked(listVols).mockResolvedValue([
    vol({ id: 'v1' }),
    vol({ id: 'v2', categorie: 'convoyage', origine: 'saisie_directe', date_vol: '2026-09-22', heure_debut: '10:00', heure_fin: '11:30', libelle_lieu: 'Antsirabe → Isoanala' }),
    vol({ id: 'v3', categorie: 'mise_en_place', origine: 'installation_site', statut_sync: 'echec', heure_debut: '07:30', heure_fin: '08:45' }),
    vol({ id: 'v4', categorie: 'prospection', origine: 'prospection', statut_sync: 'local', heure_debut: '06:00', heure_fin: '08:30' }),
  ] as any);
});

describe('VolsScreen', () => {
  it('liste tous les vols avec leur origine et leur statut de synchro', async () => {
    await render(<VolsScreen />);

    expect(await screen.findByText('Traitement')).toBeVisible();
    expect(screen.getByText('Saisie directe')).toBeVisible();
    expect(screen.getByText('Installation site')).toBeVisible();
    expect(screen.getByText('Prospection ext.')).toBeVisible();
    expect(screen.getAllByText('Sync')).toHaveLength(2);
    expect(screen.getByText('⏳ Local')).toBeVisible();
    expect(screen.getByText('Refusé')).toBeVisible();
  });

  it('totalise les heures de tous les vols, puis du filtre choisi', async () => {
    await render(<VolsScreen />);
    // 2h45 + 1h30 + 1h15 + 2h30 = 8h00
    expect(await screen.findByText('8h 00min')).toBeVisible();

    await fireEvent.press(screen.getByTestId('vols-filtre-convoyage'));

    expect(screen.getByText('1h 30min')).toBeVisible();
    expect(screen.queryByTestId('vol-v1')).toBeNull();
    expect(screen.getByTestId('vol-v2')).toBeVisible();
  });

  it('« + Nouveau » ouvre la saisie d’un vol', async () => {
    await render(<VolsScreen />);
    await fireEvent.press(await screen.findByText('+ Nouveau'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/vol-nouveau');
  });
});
