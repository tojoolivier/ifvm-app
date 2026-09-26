/** Saisie d'un approvisionnement / transfert (#645) : hors-ligne, destination requise pour le transfert seulement. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import StockMouvementScreen from '@/app/(app)/stock-mouvement';
import { listPesticides } from '@/lib/referentiel-db';
import { creerMouvement, listSitesPrincipaux } from '@/lib/stock-db';

const mockBack = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/lib/storage', () => ({ storage: { getItem: jest.fn(), setItem: jest.fn(), deleteItem: jest.fn() } }));
jest.mock('@/lib/referentiel-db', () => ({ listPesticides: jest.fn() }));
jest.mock('@/lib/stock-envoi', () => ({ envoyerStockSiEnLigne: jest.fn() }));
jest.mock('@/lib/stock-db', () => ({ listSitesPrincipaux: jest.fn(), creerMouvement: jest.fn() }));

beforeEach(() => {
  mockBack.mockReset();
  mockParams = { type: 'approvisionnement', siteId: 's-1' };
  jest.mocked(creerMouvement).mockReset().mockResolvedValue('m-1');
  jest.mocked(listSitesPrincipaux).mockResolvedValue([
    { id: 's-1', numero: '03', localite: 'Isoanala' },
    { id: 's-2', numero: '01', localite: 'Betroka' },
  ]);
  jest.mocked(listPesticides).mockResolvedValue([{ id: 'p-1', nom: 'Fipronil 7.5 UL' }] as any);
});

describe('StockMouvementScreen', () => {
  it('enregistre un approvisionnement sans demander de destination', async () => {
    await render(<StockMouvementScreen />);
    await fireEvent.press(await screen.findByTestId('stock-produit-p-1'));
    await fireEvent.changeText(screen.getByTestId('stock-quantite'), '200');
    expect(screen.queryByText('Site de destination *')).toBeNull();

    await fireEvent.press(screen.getByTestId('stock-enregistrer'));

    await waitFor(() =>
      expect(creerMouvement).toHaveBeenCalledWith({
        type: 'approvisionnement',
        pesticideId: 'p-1',
        siteId: 's-1',
        siteDestinationId: null,
        quantite: '200',
        unite: 'L',
      })
    );
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('exige une destination pour un transfert et ne propose pas le site source', async () => {
    mockParams = { type: 'transfert', siteId: 's-1' };
    await render(<StockMouvementScreen />);
    await fireEvent.press(await screen.findByTestId('stock-produit-p-1'));
    await fireEvent.changeText(screen.getByTestId('stock-quantite'), '30');
    expect(screen.queryByTestId('stock-destination-s-1')).toBeNull();

    await fireEvent.press(screen.getByTestId('stock-enregistrer'));
    expect(await screen.findByText('• Choisissez le site de destination.')).toBeVisible();
    expect(creerMouvement).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('stock-destination-s-2'));
    await fireEvent.press(screen.getByTestId('stock-unite-kg'));
    await fireEvent.press(screen.getByTestId('stock-enregistrer'));
    await waitFor(() =>
      expect(creerMouvement).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'transfert', siteDestinationId: 's-2', unite: 'kg' })
      )
    );
  });

  it('refuse une quantité nulle', async () => {
    await render(<StockMouvementScreen />);
    await fireEvent.press(await screen.findByTestId('stock-produit-p-1'));
    await fireEvent.press(screen.getByTestId('stock-enregistrer'));
    expect(await screen.findByText('• La quantité doit être supérieure à zéro.')).toBeVisible();
    expect(creerMouvement).not.toHaveBeenCalled();
  });
});
