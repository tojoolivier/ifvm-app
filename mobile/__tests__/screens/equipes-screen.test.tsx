/** Écran Équipes (#641, Figma « Équipes ») : liste filtrable des équipes terrestres et aériennes. */
import { fireEvent, render, screen } from '@testing-library/react-native';
import EquipesScreen, { libellePosition } from '@/app/(app)/equipes';
import { useAuthStore } from '@/lib/auth-store';
import { chargerListeEquipes } from '@/lib/equipe-db';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: mockPush }),
  useFocusEffect: (effect: () => void) => require('react').useEffect(effect, []),
}));
jest.mock('@/lib/equipe-db', () => ({
  ...jest.requireActual('@/lib/equipe-db'),
  chargerListeEquipes: jest.fn(),
}));
jest.mock('@/lib/storage', () => ({ storage: { getItem: jest.fn(), setItem: jest.fn(), deleteItem: jest.fn() } }));

const VIDE = { sitePrincipal: null, sitesSecondaires: [], aeronef: null, derniereIntervention: null };
const SUD = {
  equipe: { id: 'eq-sud', nom: 'Équipe Sud', type: 'aerien' as const, nb_membres: 4, chef_nom: 'Rakoto', chef_prenom: 'Jean' },
  resume: {
    ...VIDE,
    sitePrincipal: { id: 's1', parent_site_id: null, numero: 'n°03', localite: 'Isoanala', date_debut_position: '2026-09-12' },
  },
};
const TOLIARA = {
  equipe: { id: 'eq-tol', nom: 'EMT Toliara', type: 'terrestre' as const, nb_membres: 5, chef_nom: 'Rabe', chef_prenom: 'Sophie' },
  resume: { ...VIDE, derniereIntervention: '2026-09-20' },
};

beforeEach(() => {
  mockPush.mockReset();
  useAuthStore.setState({ user: { id: 'u-1', role: 'prospecteur' } } as any);
  jest.mocked(chargerListeEquipes).mockReset().mockResolvedValue([SUD, TOLIARA]);
});

describe('EquipesScreen', () => {
  it('liste les équipes avec type, effectif, chef et position', async () => {
    await render(<EquipesScreen />);

    expect(await screen.findByText('Équipe Sud')).toBeVisible();
    expect(screen.getByText('4 membres ›')).toBeVisible();
    expect(screen.getByText('Isoanala · n°03 — depuis le 12/09')).toBeVisible();
    expect(screen.getByText('Dernière intervention : 20/09')).toBeVisible();
    expect(screen.getByText(/Jean Rakoto/)).toBeVisible();
  });

  it('filtre par type d’équipe', async () => {
    await render(<EquipesScreen />);
    await screen.findByText('Équipe Sud');

    await fireEvent.press(screen.getByText('Terrestres'));

    expect(screen.queryByText('Équipe Sud')).toBeNull();
    expect(screen.getByText('EMT Toliara')).toBeVisible();
  });

  it('ouvre le détail d’une équipe', async () => {
    await render(<EquipesScreen />);

    await fireEvent.press(await screen.findByText('Équipe Sud'));

    expect(mockPush).toHaveBeenCalledWith('/(app)/equipe-detail?id=eq-sud');
  });

  it('« + Nouvelle » n’apparaît que pour les rôles qui peuvent créer une équipe', async () => {
    await render(<EquipesScreen />);
    await screen.findByText('Équipe Sud');
    expect(screen.queryByText('+ Nouvelle')).toBeNull();

    useAuthStore.setState({ user: { id: 'u-1', role: 'chef_de_base' } } as any);
    await render(<EquipesScreen />);
    await fireEvent.press(await screen.findByText('+ Nouvelle'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/equipe-nouvelle');
  });
});

describe('libellePosition', () => {
  it('équipe aérienne sans site actif', () => {
    expect(libellePosition({ equipe: SUD.equipe, resume: VIDE }).texte).toBe('Aucun site actif');
  });

  it('équipe terrestre sans intervention', () => {
    expect(libellePosition({ equipe: TOLIARA.equipe, resume: VIDE }).texte).toBe('Aucune intervention enregistrée');
  });
});
