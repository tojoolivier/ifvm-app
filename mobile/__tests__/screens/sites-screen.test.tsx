/** Sites aériens d'une équipe (#643, Figma « Sites aériens · Équipe Sud »). */
import { fireEvent, render, screen } from '@testing-library/react-native';
import SitesScreen from '@/app/(app)/sites';
import { listAeronefsEquipe, listEquipesAvecChef } from '@/lib/equipe-db';
import { listPositionsSite, listSitesAeriensEquipe } from '@/lib/site-aerien-db';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: mockPush }),
  useLocalSearchParams: () => ({ id: 'eq-sud' }),
  useFocusEffect: (effect: () => void) => require('react').useEffect(effect, []),
}));
jest.mock('@/lib/equipe-db', () => ({
  aujourdhuiIso: () => '2026-09-24',
  listEquipesAvecChef: jest.fn(),
  listAeronefsEquipe: jest.fn(),
}));
jest.mock('@/lib/site-aerien-db', () => ({ listSitesAeriensEquipe: jest.fn(), listPositionsSite: jest.fn() }));
jest.mock('@/lib/storage', () => ({ storage: { getItem: jest.fn(), setItem: jest.fn(), deleteItem: jest.fn() } }));

const site = (extra: object) => ({
  id: 's1',
  parent_site_id: null,
  equipe_id: 'eq-sud',
  numero: '03',
  localite: 'Isoanala',
  latitude: -21.8135,
  longitude: 46.0432,
  altitude: 893,
  date_debut_position: '2026-09-12',
  statut_sync: 'synced' as const,
  ...extra,
});

beforeEach(() => {
  mockPush.mockReset();
  jest.mocked(listEquipesAvecChef).mockResolvedValue([
    { id: 'eq-sud', nom: 'Équipe Sud', type: 'aerien', nb_membres: 4, chef_nom: 'Rakoto', chef_prenom: 'Jean' },
  ]);
  jest.mocked(listAeronefsEquipe).mockResolvedValue([{ id: 'ae-1', immatriculation: 'EMA-1', societe: 'Cessna' }]);
  jest.mocked(listSitesAeriensEquipe).mockResolvedValue([
    site({}),
    site({ id: 's2', parent_site_id: 's1', equipe_id: null, numero: '01', latitude: -21.8, longitude: 46 }),
    site({ id: 's3', parent_site_id: 's1', equipe_id: null, numero: '02', localite: 'Ihosy', latitude: -22.4012, longitude: 46.1234, statut_sync: 'local' as const }),
  ]);
  jest.mocked(listPositionsSite).mockResolvedValue([
    { id: 'p2', site_id: 's1', latitude: -21.8, longitude: 46, altitude: null, date_debut: '2026-09-12', date_fin: null, localite: 'Isoanala', statut_sync: 'synced' },
    { id: 'p1', site_id: 's1', latitude: -18.9, longitude: 47.5, altitude: null, date_debut: '2026-09-01', date_fin: '2026-09-11', localite: 'Ambatobe', statut_sync: 'synced' },
  ]);
});

describe('SitesScreen', () => {
  it('montre le principal avec sa position, sa durée d’implantation et l’aéronef de l’équipe', async () => {
    await render(<SitesScreen />);

    expect(await screen.findByText('Isoanala · n°03')).toBeVisible();
    expect(screen.getByText('Équipe Sud')).toBeVisible();
    expect(screen.getByText('PRINCIPALE')).toBeVisible();
    expect(screen.getByText('EMA-1')).toBeVisible();
    expect(screen.getByText('-21.8135, 46.0432')).toBeVisible();
    expect(screen.getByText(/Depuis le 12\/09 · 12 jours/)).toBeVisible();
  });

  it('liste les dépendants et l’historique des positions, durée comprise', async () => {
    await render(<SitesScreen />);

    expect(await screen.findByTestId('site-dependant-s2')).toBeVisible();
    expect(screen.getByText('HISTORIQUE')).toBeVisible();
    expect(screen.getByText(/Isoanala · 12\/09 → actuel/)).toBeVisible();
    expect(screen.getByText(/Ambatobe · 01\/09 → 11\/09 \(10 j\)/)).toBeVisible();
  });

  it('marque « À envoyer » un site créé hors-ligne qui n’est pas encore parti', async () => {
    await render(<SitesScreen />);

    await screen.findByTestId('site-dependant-s3');
    expect(screen.getByText('À envoyer')).toBeVisible();
  });

  it('« Déplacer : installer à ma position » ouvre le déplacement du principal', async () => {
    await render(<SitesScreen />);

    await fireEvent.press(await screen.findByTestId('deplacer-principal'));

    expect(mockPush).toHaveBeenCalledWith('/(app)/site-deplacer?equipeId=eq-sud&siteId=s1');
  });

  it('« Déplacer » d’un dépendant l’ouvre seul', async () => {
    await render(<SitesScreen />);

    await fireEvent.press(await screen.findByLabelText('Déplacer Isoanala · 01'));

    expect(mockPush).toHaveBeenCalledWith('/(app)/site-deplacer?equipeId=eq-sud&siteId=s2');
  });

  it('« + Site » ouvre la création pour cette équipe', async () => {
    await render(<SitesScreen />);

    await fireEvent.press(await screen.findByText('+ Site'));

    expect(mockPush).toHaveBeenCalledWith('/(app)/site-nouveau?equipeId=eq-sud');
  });

  it('la recherche filtre les sites par numéro ou localité', async () => {
    await render(<SitesScreen />);
    await screen.findByTestId('site-dependant-s3');

    await fireEvent.changeText(screen.getByLabelText('Rechercher un site'), 'Ihosy');

    expect(screen.queryByTestId('site-dependant-s2')).toBeNull();
    expect(screen.getByTestId('site-dependant-s3')).toBeVisible();
  });

  it('la recherche garde le principal (et son bouton Déplacer) quand seul un dépendant correspond', async () => {
    await render(<SitesScreen />);
    await screen.findByTestId('site-dependant-s3');

    await fireEvent.changeText(screen.getByLabelText('Rechercher un site'), 'Ihosy');

    expect(screen.getByTestId('site-principal')).toBeVisible();
    expect(screen.getByTestId('deplacer-principal')).toBeVisible();
  });

  it('la recherche qui ne trouve rien le dit', async () => {
    await render(<SitesScreen />);
    await screen.findByTestId('site-dependant-s3');

    await fireEvent.changeText(screen.getByLabelText('Rechercher un site'), 'zzz');

    expect(screen.getByText(/Aucun site ne correspond à « zzz »/)).toBeVisible();
  });

  it('une équipe sans site invite à créer le premier', async () => {
    jest.mocked(listSitesAeriensEquipe).mockResolvedValue([]);
    jest.mocked(listPositionsSite).mockResolvedValue([]);

    await render(<SitesScreen />);

    expect(await screen.findByText(/Aucun site pour cette équipe/)).toBeVisible();
  });
});
