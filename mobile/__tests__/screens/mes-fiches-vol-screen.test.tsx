/**
 * Liste des fiches de vol (#fiche-vol-menu-entree) — pas de filtre « créées
 * par moi » (aucun champ créateur sur fiche_vol), triée par date décroissante.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import MesFichesVolScreen from '@/app/(fiche-vol)/mes-fiches';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient } from '@/lib/api-client';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    listFichesVol: jest.fn(),
  },
}));

const FICHE_ANCIENNE = {
  id: 'fiche-1',
  numero_fiche: '001-2026-09-10-IHO-5R-AAA',
  date_vol: '2026-09-10',
  immatriculation: '5R-AAA',
  compagnie: 'Air Test',
  statut: 'validee',
};
const FICHE_RECENTE = {
  id: 'fiche-2',
  numero_fiche: '002-2026-09-16-IHO-5R-BBB',
  date_vol: '2026-09-16',
  immatriculation: '5R-BBB',
  compagnie: 'Air Test',
  statut: 'brouillon',
};

describe('MesFichesVolScreen', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: 'token-test' } as any);
    jest.mocked(apiClient.listFichesVol).mockReset().mockResolvedValue([FICHE_ANCIENNE, FICHE_RECENTE] as any);
  });

  it('charge et trie les fiches par date décroissante, avec le bon statut', async () => {
    await render(<MesFichesVolScreen />);

    await fireEvent.press(screen.getByText('Charger les fiches ›'));

    const numeros = await screen.findAllByText(/^00[12]-2026/);
    expect(numeros[0].props.children).toBe(FICHE_RECENTE.numero_fiche);
    expect(numeros[1].props.children).toBe(FICHE_ANCIENNE.numero_fiche);

    expect(screen.getByText('BROUILLON')).toBeTruthy();
    expect(screen.getByText('VALIDÉE')).toBeTruthy();
  });

  it("affiche un message quand il n'y a aucune fiche", async () => {
    jest.mocked(apiClient.listFichesVol).mockResolvedValue([]);
    await render(<MesFichesVolScreen />);

    await fireEvent.press(screen.getByText('Charger les fiches ›'));

    await screen.findByText('Aucune fiche de vol.');
  });
});
