/** Stock de pesticides (#645, Figma 81:588) : solde par (produit, unité), mouvements en attente distingués. */
import { fireEvent, render, screen } from '@testing-library/react-native';
import StockScreen from '@/app/(app)/stock';
import { useEquipeTravailStore } from '@/lib/equipe-travail-store';
import { listSitesEquipe } from '@/lib/equipe-db';
import { listPesticides } from '@/lib/referentiel-db';
import { listMouvementsPourSolde, listMouvementsSite, listSitesActifs, listSoldesServeur } from '@/lib/stock-db';

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    useRouter: () => ({ back: jest.fn(), push: mockPush }),
    useFocusEffect: (callback: () => void) => useEffect(callback, [callback]),
  };
});
jest.mock('@/lib/storage', () => ({ storage: { getItem: jest.fn(), setItem: jest.fn(), deleteItem: jest.fn() } }));
jest.mock('@/lib/equipe-db', () => ({ listSitesEquipe: jest.fn() }));
jest.mock('@/lib/referentiel-db', () => ({ listPesticides: jest.fn() }));
jest.mock('@/lib/stock-envoi', () => ({ envoyerStockSiEnLigne: jest.fn() }));
jest.mock('@/lib/stock-db', () => ({
  listSitesActifs: jest.fn(),
  listSoldesServeur: jest.fn(),
  listMouvementsPourSolde: jest.fn(),
  listMouvementsSite: jest.fn(),
}));

const SITE = { id: 's-1', numero: '03', localite: 'Isoanala' };

beforeEach(() => {
  mockPush.mockReset();
  useEquipeTravailStore.setState({ equipeId: 'eq-1', isInitialized: true });
  jest.mocked(listSitesActifs).mockResolvedValue([SITE]);
  jest.mocked(listSitesEquipe).mockResolvedValue([{ ...SITE, parent_site_id: null, date_debut_position: null }]);
  jest.mocked(listPesticides).mockResolvedValue([
    { id: 'p-feni', nom: 'Fenitrothion 96% ULV' },
    { id: 'p-delta', nom: 'Deltamethrine 0.2% DP' },
  ] as any);
  jest.mocked(listSoldesServeur).mockResolvedValue([
    { site_id: 's-1', pesticide_id: 'p-feni', unite: 'L', quantite: 450 },
    { site_id: 's-1', pesticide_id: 'p-delta', unite: 'kg', quantite: 85 },
  ]);
  jest.mocked(listMouvementsPourSolde).mockResolvedValue([]);
  jest.mocked(listMouvementsSite).mockResolvedValue([]);
});

describe('StockScreen', () => {
  it('affiche un solde par produit avec son unité, sans jamais les additionner', async () => {
    await render(<StockScreen />);

    expect(await screen.findByText('Fenitrothion 96% ULV')).toBeVisible();
    expect(screen.getByText('450')).toBeVisible();
    expect(screen.getByText('L')).toBeVisible();
    expect(screen.getByText('85')).toBeVisible();
    expect(screen.getByText('kg')).toBeVisible();
    expect(screen.queryByText('535')).toBeNull();
  });

  it('étiquette un mouvement local comme « en attente » et l’ajoute au solde affiché', async () => {
    jest.mocked(listMouvementsPourSolde).mockResolvedValue([
      { type: 'approvisionnement', pesticide_id: 'p-feni', site_id: 's-1', site_destination_id: null, quantite: 200, unite: 'L' },
    ]);
    await render(<StockScreen />);

    expect(await screen.findByText('650')).toBeVisible();
    expect(screen.getByTestId('stock-en-attente-p-feni-L')).toHaveTextContent('⏳ +200 L en attente · serveur 450');
  });

  it('liste les derniers mouvements avec leur statut', async () => {
    jest.mocked(listMouvementsSite).mockResolvedValue([
      { id: 'm-1', type: 'transfert', pesticide_id: 'p-feni', site_id: 's-1', site_destination_id: 's-2', quantite: 30, unite: 'L', date_mouvement: '2026-09-21', statut_sync: 'local' },
    ]);
    await render(<StockScreen />);

    expect(await screen.findByText('Transfert sortant')).toBeVisible();
    expect(screen.getByText('-30 L')).toBeVisible();
    expect(screen.getByText(/⏳ Local/)).toBeVisible();
  });

  it('« Approvisionner » et « Transférer » ouvrent la saisie pour le site affiché', async () => {
    await render(<StockScreen />);
    await screen.findByText('Fenitrothion 96% ULV');

    await fireEvent.press(screen.getByTestId('stock-approvisionner'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(app)/stock-mouvement', params: { type: 'approvisionnement', siteId: 's-1' } });

    await fireEvent.press(screen.getByTestId('stock-transferer'));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/(app)/stock-mouvement', params: { type: 'transfert', siteId: 's-1' } });
  });
});
