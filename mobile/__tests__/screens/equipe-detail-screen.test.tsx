/** Détail d'une équipe (#641, Figma « Détail · Équipe Sud »). */
import { fireEvent, render, screen } from '@testing-library/react-native';
import EquipeDetailScreen from '@/app/(app)/equipe-detail';
import { useAuthStore } from '@/lib/auth-store';
import { listAffectationsEquipe, listParcAeronefs, listMembresEquipe, listSitesEquipe } from '@/lib/equipe-db';
import { getEquipeLocale } from '@/lib/referentiel-db';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: mockPush }),
  useLocalSearchParams: () => ({ id: 'eq-sud' }),
  useFocusEffect: (effect: () => void) => require('react').useEffect(effect, []),
}));
jest.mock('@/lib/equipe-db', () => ({
  ...jest.requireActual('@/lib/equipe-db'),
  listMembresEquipe: jest.fn(),
  listSitesEquipe: jest.fn(),
  listAffectationsEquipe: jest.fn(),
  listParcAeronefs: jest.fn(),
}));
jest.mock('@/lib/referentiel-sync', () => ({ pullReferentiel: jest.fn() }));
jest.mock('@/lib/referentiel-db', () => ({ getEquipeLocale: jest.fn() }));
jest.mock('@/lib/storage', () => ({ storage: { getItem: jest.fn(), setItem: jest.fn(), deleteItem: jest.fn() } }));

beforeEach(() => {
  mockPush.mockReset();
  useAuthStore.setState({ user: { id: 'u-1', role: 'chef_de_base' } } as any);
  jest.mocked(getEquipeLocale).mockResolvedValue({ id: 'eq-sud', nom: 'Équipe Sud', type: 'aerien', nb_membres: 3 });
  jest.mocked(listMembresEquipe).mockResolvedValue([
    { user_id: 'u-1', fonction: 'chef', nom: 'Rakoto', prenom: 'Jean' },
    { user_id: 'u-2', fonction: 'pilote', nom: 'Rabe', prenom: 'Michel' },
    { user_id: 'u-3', fonction: 'consultant_international', nom: 'Dupont', prenom: 'M.' },
  ]);
  jest.mocked(listSitesEquipe).mockResolvedValue([
    { id: 's1', parent_site_id: null, numero: 'n°03', localite: 'Isoanala', date_debut_position: '2026-09-12' },
    { id: 's2', parent_site_id: 's1', numero: 'n°01', localite: 'Isoanala', date_debut_position: null },
  ]);
  jest.mocked(listAffectationsEquipe).mockResolvedValue([
    { id: 'af-2', aeronef_id: 'ae-1', immatriculation: '5R-MHR', societe: 'Cessna 188', date_debut: '2026-09-01', date_fin: null, en_service: 1 as const },
    { id: 'af-1', aeronef_id: 'ae-2', immatriculation: '5R-MJK', societe: 'Cessna 188', date_debut: '2026-05-01', date_fin: '2026-08-31', en_service: 0 as const },
  ]);
  jest.mocked(listParcAeronefs).mockResolvedValue([
    { id: 'ae-1', immatriculation: '5R-MHR', societe: 'Cessna 188', volume_cuve_l: 800, equipe_id: 'eq-sud', equipe_nom: 'Équipe Sud' },
    { id: 'ae-2', immatriculation: '5R-MJK', societe: 'Cessna 188', volume_cuve_l: 800, equipe_id: null, equipe_nom: null },
  ]);
});

describe('EquipeDetailScreen', () => {
  it('montre les membres avec leur fonction, les sites et l’aéronef affecté', async () => {
    await render(<EquipeDetailScreen />);

    expect(await screen.findByText('Jean Rakoto')).toBeVisible();
    expect(screen.getByText('Chef')).toBeVisible();
    expect(screen.getByText('Pilote')).toBeVisible();
    expect(screen.getByText('Consultant')).toBeVisible();
    expect(screen.getByText('PRINCIPALE')).toBeVisible();
    expect(screen.getByText('Isoanala · n°03')).toBeVisible();
    expect(screen.getByText('Stand n°01')).toBeVisible();
    expect(screen.getByText('5R-MHR')).toBeVisible();
    expect(screen.getByText('AFFECTATION ACTIVE')).toBeVisible();
    expect(screen.getByText('Type fixé à la création, non modifiable.')).toBeVisible();
  });

  it('« Ajouter un membre » mène au formulaire, pour un rôle autorisé', async () => {
    await render(<EquipeDetailScreen />);

    await fireEvent.press(await screen.findByText('＋ Ajouter un membre'));

    expect(mockPush).toHaveBeenCalledWith('/(app)/equipe-membre-ajout?id=eq-sud');
  });

  it('masque « Ajouter un membre » aux rôles qui ne gèrent pas les équipes', async () => {
    useAuthStore.setState({ user: { id: 'u-1', role: 'prospecteur' } } as any);
    await render(<EquipeDetailScreen />);
    await screen.findByText('Jean Rakoto');

    expect(screen.queryByText('＋ Ajouter un membre')).toBeNull();
  });

  it('une équipe terrestre n’affiche ni sites ni aéronefs', async () => {
    jest.mocked(getEquipeLocale).mockResolvedValue({ id: 'eq-sud', nom: 'EMT Toliara', type: 'terrestre', nb_membres: 3 });
    await render(<EquipeDetailScreen />);
    await screen.findByText('Jean Rakoto');

    expect(screen.queryByText('SITES AÉRIENS')).toBeNull();
    expect(screen.queryByText('AÉRONEFS AFFECTÉS')).toBeNull();
  });

  it('met l’affectation active en avant et liste l’historique en dessous', async () => {
    await render(<EquipeDetailScreen />);
    await screen.findByText('Jean Rakoto');

    expect(screen.getByText('Depuis le 01/09/2026')).toBeVisible();
    expect(screen.getByText('HISTORIQUE DES AFFECTATIONS')).toBeVisible();
    expect(screen.getByText('5R-MJK')).toBeVisible();
    expect(screen.getByText('01/05/2026 → 31/08/2026')).toBeVisible();
  });

  it('réserve « Terminer l’affectation » et l’ajout d’un appareil à l’administrateur', async () => {
    useAuthStore.setState({ user: { id: 'u-1', role: 'admin' } } as any);
    await render(<EquipeDetailScreen />);
    await screen.findByText('Jean Rakoto');
    expect(screen.getByText(/Terminer l’affectation/)).toBeVisible();
    expect(screen.getByText('Affecter à partir d’aujourd’hui')).toBeVisible();
  });

  it('masque ces actions aux autres rôles, sans se contenter d’un refus de l’API', async () => {
    await render(<EquipeDetailScreen />);
    await screen.findByText('Jean Rakoto');

    expect(screen.queryByText(/Terminer l’affectation/)).toBeNull();
    expect(screen.queryByText('Affecter à partir d’aujourd’hui')).toBeNull();
  });
});
