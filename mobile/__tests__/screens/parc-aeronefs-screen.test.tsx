/** Parc aéronefs (#642, Figma « Parc aéronefs »). */
import { render, screen } from '@testing-library/react-native';
import ParcAeronefsScreen from '@/app/(app)/parc-aeronefs';
import { useAuthStore } from '@/lib/auth-store';
import { listAffectationsEquipe, listParcAeronefs } from '@/lib/equipe-db';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  useFocusEffect: (effect: () => void) => require('react').useEffect(effect, []),
}));
jest.mock('@/hooks/use-equipes-de-travail', () => ({
  useEquipesDeTravail: () => ({ courante: { id: 'eq-sud', nom: 'Équipe Sud', type: 'aerien' } }),
}));
jest.mock('@/lib/equipe-db', () => ({
  ...jest.requireActual('@/lib/equipe-db'),
  listParcAeronefs: jest.fn(),
  listAffectationsEquipe: jest.fn(),
}));
jest.mock('@/lib/storage', () => ({ storage: { getItem: jest.fn(), setItem: jest.fn(), deleteItem: jest.fn() } }));

beforeEach(() => {
  useAuthStore.setState({ user: { id: 'u-1', role: 'pilote' } } as any);
  jest.mocked(listParcAeronefs).mockResolvedValue([
    { id: 'ae-1', immatriculation: '5R-MHR', societe: 'Cessna 188', volume_cuve_l: 800, equipe_id: 'eq-sud', equipe_nom: 'Équipe Sud' },
    { id: 'ae-2', immatriculation: '5R-MLP', societe: 'Air Tractor', volume_cuve_l: 1200, equipe_id: null, equipe_nom: null },
  ]);
  jest.mocked(listAffectationsEquipe).mockResolvedValue([
    { id: 'af-1', aeronef_id: 'ae-1', immatriculation: '5R-MHR', societe: 'Cessna 188', date_debut: '2026-09-01', date_fin: null },
  ]);
});

describe('ParcAeronefsScreen', () => {
  it('met l’affectation active en avant, puis liste les appareils avec leur équipe ou « Libre »', async () => {
    await render(<ParcAeronefsScreen />);

    expect(await screen.findByText('AFFECTATION ACTIVE')).toBeVisible();
    expect(screen.getByText('TOUS LES AÉRONEFS')).toBeVisible();
    expect(screen.getByText('Libre')).toBeVisible();
    expect(screen.getAllByText('Équipe Sud').length).toBeGreaterThan(0);
  });

  it('masque l’ajout d’un appareil aux non-administrateurs', async () => {
    await render(<ParcAeronefsScreen />);
    await screen.findByText('AFFECTATION ACTIVE');

    expect(screen.queryByText('＋ Ajouter un appareil')).toBeNull();
    expect(screen.queryByText('＋ Appareil')).toBeNull();
  });

  it('propose l’ajout à l’administrateur', async () => {
    useAuthStore.setState({ user: { id: 'u-1', role: 'admin' } } as any);
    await render(<ParcAeronefsScreen />);

    expect(await screen.findByText('＋ Ajouter un appareil')).toBeVisible();
  });
});
