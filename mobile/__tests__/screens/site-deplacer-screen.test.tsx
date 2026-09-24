/** Déplacer un site (#643, Figma « Déplacer · Site principal »). */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import SiteDeplacerScreen from '@/app/(app)/site-deplacer';
import { useAuthStore } from '@/lib/auth-store';
import { listAeronefsEquipe } from '@/lib/equipe-db';
import { useEquipeTravailStore } from '@/lib/equipe-travail-store';
import { getCurrentPosition } from '@/lib/location';
import { deplacerSites, listSitesAeriensEquipe } from '@/lib/site-aerien-db';
import { envoyerSitesSiEnLigne } from '@/lib/site-aerien-envoi';

const mockBack = jest.fn();
let mockParams: { siteId: string; equipeId?: string } = { siteId: 'pr-1' };
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/lib/equipe-db', () => ({ aujourdhuiIso: () => '2026-09-24', listAeronefsEquipe: jest.fn() }));
jest.mock('@/lib/site-aerien-db', () => ({ deplacerSites: jest.fn(), listSitesAeriensEquipe: jest.fn() }));
jest.mock('@/lib/site-aerien-envoi', () => ({ envoyerSitesSiEnLigne: jest.fn() }));
jest.mock('@/lib/location', () => ({ getCurrentPosition: jest.fn() }));
jest.mock('@/lib/storage', () => ({ storage: { getItem: jest.fn(), setItem: jest.fn(), deleteItem: jest.fn() } }));
// Le sélecteur d'heure est natif : un champ texte le remplace, l'écran ne voit que `value`/`onChange`.
jest.mock('@/components/TimeField', () => {
  const { TextInput } = require('react-native');
  return {
    TimeField: ({ value, onChange }: { value: string | null; onChange: (v: string) => void }) => (
      <TextInput placeholder="hh:mm" value={value ?? ''} onChangeText={onChange} />
    ),
  };
});

const FIX = { latitude: -22.4012, longitude: 46.1234, altitude: 712, accuracy: 4, timestamp: Date.now() };
const site = (extra: object) => ({
  id: 'pr-1',
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
  mockBack.mockReset();
  mockParams = { siteId: 'pr-1' };
  useAuthStore.setState({ token: 'tok', user: { id: 'u-1', role: 'chef_de_base' } } as any);
  useEquipeTravailStore.setState({ equipeId: 'eq-sud' });
  jest.mocked(listAeronefsEquipe).mockResolvedValue([{ id: 'ae-1', immatriculation: 'EMA-1', societe: 'Cessna' }]);
  jest.mocked(listSitesAeriensEquipe).mockResolvedValue([
    site({}),
    site({ id: 'st-1', parent_site_id: 'pr-1', equipe_id: null, numero: '01' }),
    site({ id: 'bs-1', parent_site_id: 'pr-1', equipe_id: null, numero: '02', localite: 'Ihosy' }),
  ]);
  jest.mocked(getCurrentPosition).mockResolvedValue(FIX);
  jest.mocked(deplacerSites).mockReset().mockResolvedValue(undefined);
  jest.mocked(envoyerSitesSiEnLigne).mockReset().mockResolvedValue(undefined);
});

async function capturer() {
  await fireEvent.press(await screen.findByTestId('deplacement-capturer'));
  await screen.findByText('Position capturée');
}

describe('SiteDeplacerScreen — principal', () => {
  it('montre le site actuel et présélectionne ses dépendants « Déplacer aussi »', async () => {
    await render(<SiteDeplacerScreen />);

    expect(await screen.findByText('Isoanala · n°03')).toBeVisible();
    expect(screen.getByText('SITE ACTUEL')).toBeVisible();
    expect(screen.getByTestId('deplacer-st-1').props.accessibilityState.checked).toBe(true);
    expect(screen.getByTestId('deplacer-bs-1').props.accessibilityState.checked).toBe(true);
  });

  it('sans position capturée : refuse avec une erreur lisible', async () => {
    await render(<SiteDeplacerScreen />);
    await screen.findByText('SITE ACTUEL');

    await fireEvent.press(screen.getByTestId('deplacement-confirmer'));

    expect(screen.getByText('• La position GPS est obligatoire.')).toBeVisible();
    expect(deplacerSites).not.toHaveBeenCalled();
  });

  it('déplace le principal avec tous ses dépendants cochés et envoie', async () => {
    await render(<SiteDeplacerScreen />);
    await fireEvent.changeText(await screen.findByTestId('deplacement-localite'), 'Ambatobe');
    await capturer();

    await fireEvent.press(screen.getByTestId('deplacement-confirmer'));

    await waitFor(() => expect(deplacerSites).toHaveBeenCalledTimes(1));
    expect(jest.mocked(deplacerSites).mock.calls[0][0]).toEqual({
      siteId: 'pr-1',
      numero: '03',
      localite: 'Ambatobe',
      position: { latitude: -22.4012, longitude: 46.1234, altitude: 712 },
      dependantIds: ['st-1', 'bs-1'],
      vol: null,
    });
    expect(envoyerSitesSiEnLigne).toHaveBeenCalledWith('tok');
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('un dépendant décoché reste en place', async () => {
    await render(<SiteDeplacerScreen />);
    await capturer();

    await fireEvent.press(screen.getByTestId('deplacer-bs-1'));
    await fireEvent.press(screen.getByTestId('deplacement-confirmer'));

    await waitFor(() => expect(deplacerSites).toHaveBeenCalled());
    expect(jest.mocked(deplacerSites).mock.calls[0][0].dependantIds).toEqual(['st-1']);
  });

  it('refuse une longitude hors bornes', async () => {
    await render(<SiteDeplacerScreen />);
    await fireEvent.changeText(await screen.findByTestId('deplacement-latitude'), '10');
    await fireEvent.changeText(screen.getByTestId('deplacement-longitude'), '181');

    await fireEvent.press(screen.getByTestId('deplacement-confirmer'));

    expect(screen.getByText('• La longitude doit être comprise entre −180 et 180.')).toBeVisible();
    expect(deplacerSites).not.toHaveBeenCalled();
  });
});

describe('SiteDeplacerScreen — vol de mise en place', () => {
  const saisirHeures = async (debut: string, fin: string) => {
    await fireEvent.changeText(within(screen.getByTestId('vol-debut')).getByPlaceholderText('hh:mm'), debut);
    await fireEvent.changeText(within(screen.getByTestId('vol-fin')).getByPlaceholderText('hh:mm'), fin);
  };
  const choisirStand = async () => {
    await fireEvent.press(screen.getByLabelText('Stand'));
    // Le libellé existe déjà dans « Déplacer aussi » : l'option de la feuille est la dernière rendue.
    const occurrences = await screen.findAllByText('Isoanala · 01');
    await fireEvent.press(occurrences[occurrences.length - 1]);
  };

  it('sans heure ni stand saisis, aucun vol n’est créé (facultatif)', async () => {
    await render(<SiteDeplacerScreen />);
    await capturer();

    await fireEvent.press(screen.getByTestId('deplacement-confirmer'));

    await waitFor(() => expect(deplacerSites).toHaveBeenCalled());
    expect(jest.mocked(deplacerSites).mock.calls[0][0].vol).toBeNull();
  });

  it('enregistre le vol avec son stand et l’aéronef de l’équipe', async () => {
    await render(<SiteDeplacerScreen />);
    await capturer();
    await saisirHeures('07:30', '08:45');
    await choisirStand();

    await fireEvent.press(screen.getByTestId('deplacement-confirmer'));

    await waitFor(() => expect(deplacerSites).toHaveBeenCalled());
    expect(jest.mocked(deplacerSites).mock.calls[0][0].vol).toEqual({
      debut: '07:30',
      fin: '08:45',
      standId: 'st-1',
      aeronefId: 'ae-1',
      equipeId: 'eq-sud',
    });
  });

  it('un vol sans stand choisi est refusé', async () => {
    await render(<SiteDeplacerScreen />);
    await capturer();
    await saisirHeures('07:30', '08:45');

    await fireEvent.press(screen.getByTestId('deplacement-confirmer'));

    expect(screen.getByText('• Choisissez le stand du vol de mise en place.')).toBeVisible();
    expect(deplacerSites).not.toHaveBeenCalled();
  });

  it('un vol dont la fin précède le début est refusé', async () => {
    await render(<SiteDeplacerScreen />);
    await capturer();
    await saisirHeures('09:00', '08:00');
    await choisirStand();

    await fireEvent.press(screen.getByTestId('deplacement-confirmer'));

    expect(screen.getByText('• L’heure de fin doit être postérieure à l’heure de début.')).toBeVisible();
    expect(deplacerSites).not.toHaveBeenCalled();
  });

  it('un site sans stand refuse le vol de mise en place', async () => {
    jest.mocked(listSitesAeriensEquipe).mockResolvedValue([site({})]);
    await render(<SiteDeplacerScreen />);
    await capturer();
    await saisirHeures('07:30', '08:45');

    await fireEvent.press(screen.getByTestId('deplacement-confirmer'));

    expect(screen.getByText('• Ce site n’a aucun stand : impossible de saisir un vol de mise en place.')).toBeVisible();
    expect(deplacerSites).not.toHaveBeenCalled();
  });

  it('une équipe sans aéronef en service refuse le vol', async () => {
    jest.mocked(listAeronefsEquipe).mockResolvedValue([]);
    await render(<SiteDeplacerScreen />);
    await capturer();
    await saisirHeures('07:30', '08:45');
    await choisirStand();

    await fireEvent.press(screen.getByTestId('deplacement-confirmer'));

    expect(screen.getByText('• L’équipe n’a aucun aéronef en service : impossible de saisir un vol.')).toBeVisible();
    expect(deplacerSites).not.toHaveBeenCalled();
  });
});

describe('SiteDeplacerScreen — secondaire', () => {
  beforeEach(() => {
    mockParams = { siteId: 'st-1' };
  });

  it('se déplace seul : ni « Déplacer aussi » ni vol de mise en place', async () => {
    await render(<SiteDeplacerScreen />);
    await capturer();

    expect(screen.queryByText('DÉPLACER AUSSI')).toBeNull();
    expect(screen.queryByText('VOL DE MISE EN PLACE (FACULTATIF)')).toBeNull();

    await fireEvent.press(screen.getByTestId('deplacement-confirmer'));

    await waitFor(() => expect(deplacerSites).toHaveBeenCalled());
    expect(jest.mocked(deplacerSites).mock.calls[0][0]).toMatchObject({
      siteId: 'st-1',
      dependantIds: [],
      vol: null,
    });
  });
});

describe('SiteDeplacerScreen — équipe consultée', () => {
  it('lit les sites de l’équipe passée en paramètre, pas de l’équipe de travail', async () => {
    mockParams = { siteId: 'pr-1', equipeId: 'eq-nord' };

    await render(<SiteDeplacerScreen />);
    await screen.findByText('SITE ACTUEL');

    expect(listSitesAeriensEquipe).toHaveBeenCalledWith('eq-nord');
  });
});
