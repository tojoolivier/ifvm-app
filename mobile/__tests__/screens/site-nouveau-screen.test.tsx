/** Nouveau site aérien (#643, Figma « Nouveau site aérien ») : création groupée, hors-ligne. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import SiteNouveauScreen from '@/app/(app)/site-nouveau';
import { useAuthStore } from '@/lib/auth-store';
import { listEquipesAvecChef } from '@/lib/equipe-db';
import { useEquipeTravailStore } from '@/lib/equipe-travail-store';
import { getCurrentPosition } from '@/lib/location';
import { creerSiteSecondaire, creerSitesGroupes, listSitesAeriensEquipe } from '@/lib/site-aerien-db';
import { envoyerSitesSiEnLigne } from '@/lib/site-aerien-envoi';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));
jest.mock('@/lib/equipe-db', () => ({ listEquipesAvecChef: jest.fn() }));
jest.mock('@/lib/site-aerien-db', () => ({
  creerSitesGroupes: jest.fn(),
  creerSiteSecondaire: jest.fn(),
  listSitesAeriensEquipe: jest.fn(),
}));
jest.mock('@/lib/site-aerien-envoi', () => ({ envoyerSitesSiEnLigne: jest.fn() }));
jest.mock('@/lib/location', () => ({ getCurrentPosition: jest.fn() }));
jest.mock('@/lib/storage', () => ({ storage: { getItem: jest.fn(), setItem: jest.fn(), deleteItem: jest.fn() } }));

const FIX = { latitude: -21.8135, longitude: 46.0432, altitude: 893, accuracy: 4, timestamp: Date.now() };

beforeEach(() => {
  mockBack.mockReset();
  useAuthStore.setState({ token: 'tok', user: { id: 'u-1', role: 'chef_de_base' } } as any);
  useEquipeTravailStore.setState({ equipeId: 'eq-sud' });
  jest.mocked(listEquipesAvecChef).mockResolvedValue([
    { id: 'eq-sud', nom: 'Équipe Sud', type: 'aerien', nb_membres: 4, chef_nom: 'Rakoto', chef_prenom: 'Jean' },
  ]);
  jest.mocked(listSitesAeriensEquipe).mockResolvedValue([]);
  jest.mocked(getCurrentPosition).mockResolvedValue(FIX);
  jest.mocked(creerSitesGroupes).mockReset().mockResolvedValue({ principalId: 'p', standId: null, baseSecondaireId: null });
  jest.mocked(creerSiteSecondaire).mockReset().mockResolvedValue('s');
  jest.mocked(envoyerSitesSiEnLigne).mockReset().mockResolvedValue(undefined);
});

async function remplirPrincipal() {
  await fireEvent.changeText(screen.getByTestId('principal-numero'), '03');
  await fireEvent.changeText(screen.getByTestId('principal-localite'), 'Isoanala');
  await fireEvent.press(screen.getByTestId('principal-capturer'));
  await screen.findByText('Position capturée');
}

describe('SiteNouveauScreen — principal + dépendants', () => {
  it('sans rien saisir : liste toutes les erreurs d’un coup et n’écrit rien', async () => {
    await render(<SiteNouveauScreen />);

    await fireEvent.press(screen.getByTestId('site-enregistrer'));

    expect(screen.getByText('• Site principal : le numéro est obligatoire.')).toBeVisible();
    expect(screen.getByText('• Site principal : la localité est obligatoire.')).toBeVisible();
    expect(screen.getByText('• Site principal : La position GPS est obligatoire.')).toBeVisible();
    expect(creerSitesGroupes).not.toHaveBeenCalled();
  });

  it('enregistre un principal capturé au GPS, l’envoie si le réseau est là puis revient', async () => {
    await render(<SiteNouveauScreen />);
    expect(await screen.findByText('Équipe Sud')).toBeVisible();

    await remplirPrincipal();
    await fireEvent.press(screen.getByTestId('site-enregistrer'));

    await waitFor(() => expect(creerSitesGroupes).toHaveBeenCalledTimes(1));
    const lot = jest.mocked(creerSitesGroupes).mock.calls[0][0];
    expect(lot.equipeId).toBe('eq-sud');
    expect(lot.principal).toMatchObject({
      numero: '03',
      localite: 'Isoanala',
      position: { latitude: -21.8135, longitude: 46.0432, altitude: 893 },
    });
    expect(lot.stand.actif).toBe(false);
    expect(lot.baseSecondaire.actif).toBe(false);
    expect(envoyerSitesSiEnLigne).toHaveBeenCalledWith('tok');
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('un stand ajouté sans numéro est refusé avec une erreur lisible', async () => {
    await render(<SiteNouveauScreen />);
    await remplirPrincipal();

    await fireEvent(screen.getByTestId('stand-actif'), 'valueChange', true);
    await fireEvent.press(screen.getByTestId('site-enregistrer'));

    expect(screen.getByText('• Stand : le numéro est obligatoire.')).toBeVisible();
    expect(screen.getByText('• Stand : la localité est obligatoire.')).toBeVisible();
    expect(creerSitesGroupes).not.toHaveBeenCalled();
  });

  it('un stand « même position que le principal » n’exige pas de capture', async () => {
    await render(<SiteNouveauScreen />);
    await remplirPrincipal();

    await fireEvent(screen.getByTestId('stand-actif'), 'valueChange', true);
    await fireEvent.changeText(screen.getByTestId('stand-numero'), '01');
    await fireEvent.changeText(screen.getByTestId('stand-localite'), 'Isoanala');
    await fireEvent.press(screen.getByTestId('site-enregistrer'));

    await waitFor(() => expect(creerSitesGroupes).toHaveBeenCalled());
    expect(jest.mocked(creerSitesGroupes).mock.calls[0][0].stand).toMatchObject({
      actif: true,
      numero: '01',
      memePositionQuePrincipal: true,
    });
  });

  it('décocher « même position » demande la capture propre du dépendant', async () => {
    await render(<SiteNouveauScreen />);
    await remplirPrincipal();
    await fireEvent(screen.getByTestId('stand-actif'), 'valueChange', true);
    await fireEvent.changeText(screen.getByTestId('stand-numero'), '01');
    await fireEvent.changeText(screen.getByTestId('stand-localite'), 'Isoanala');

    await fireEvent.press(screen.getByTestId('stand-meme-position'));
    await fireEvent.press(screen.getByTestId('site-enregistrer'));

    expect(screen.getByText('• Stand : La position GPS est obligatoire.')).toBeVisible();
    expect(creerSitesGroupes).not.toHaveBeenCalled();
  });

  it('refuse une latitude hors bornes saisie à la main', async () => {
    await render(<SiteNouveauScreen />);
    await fireEvent.changeText(screen.getByTestId('principal-numero'), '03');
    await fireEvent.changeText(screen.getByTestId('principal-localite'), 'Isoanala');

    await fireEvent.changeText(screen.getByTestId('principal-latitude'), '95');
    await fireEvent.changeText(screen.getByTestId('principal-longitude'), '46');
    await fireEvent.press(screen.getByTestId('site-enregistrer'));

    expect(screen.getByText('• Site principal : La latitude doit être comprise entre −90 et 90.')).toBeVisible();
    expect(creerSitesGroupes).not.toHaveBeenCalled();
  });

  it('accepte la virgule décimale saisie au clavier', async () => {
    await render(<SiteNouveauScreen />);
    await fireEvent.changeText(screen.getByTestId('principal-numero'), '03');
    await fireEvent.changeText(screen.getByTestId('principal-localite'), 'Isoanala');

    await fireEvent.changeText(screen.getByTestId('principal-latitude'), '-21,8135');
    await fireEvent.changeText(screen.getByTestId('principal-longitude'), '46,0432');
    await fireEvent.press(screen.getByTestId('site-enregistrer'));

    await waitFor(() => expect(creerSitesGroupes).toHaveBeenCalled());
    expect(jest.mocked(creerSitesGroupes).mock.calls[0][0].principal.position).toMatchObject({
      latitude: -21.8135,
      longitude: 46.0432,
    });
  });
});

describe('SiteNouveauScreen — secondaire seul', () => {
  beforeEach(() => {
    jest.mocked(listSitesAeriensEquipe).mockResolvedValue([
      { id: 'pr-1', parent_site_id: null, equipe_id: 'eq-sud', numero: '03', localite: 'Isoanala', latitude: -21.8, longitude: 46, altitude: null, date_debut_position: '2026-09-12', statut_sync: 'synced' },
    ]);
  });

  it('une équipe qui a déjà un principal ne peut plus en créer un autre : « Secondaire » est présélectionné', async () => {
    await render(<SiteNouveauScreen />);

    await waitFor(() => expect(screen.getByTestId('type-principal').props.accessibilityState.disabled).toBe(true));
    expect(screen.getByTestId('type-secondaire').props.accessibilityState.selected).toBe(true);
  });

  it('rattache le secondaire au principal de l’équipe', async () => {
    await render(<SiteNouveauScreen />);
    await waitFor(() => expect(screen.getByTestId('type-principal').props.accessibilityState.disabled).toBe(true));

    await fireEvent.changeText(screen.getByTestId('secondaire-numero'), '02');
    await fireEvent.changeText(screen.getByTestId('secondaire-localite'), 'Ihosy');
    await fireEvent.press(screen.getByTestId('site-enregistrer'));

    await waitFor(() => expect(creerSiteSecondaire).toHaveBeenCalledTimes(1));
    expect(jest.mocked(creerSiteSecondaire).mock.calls[0][0]).toMatchObject({
      parentId: 'pr-1',
      site: { numero: '02', localite: 'Ihosy', memePositionQuePrincipal: true },
    });
    expect(creerSitesGroupes).not.toHaveBeenCalled();
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });
});
