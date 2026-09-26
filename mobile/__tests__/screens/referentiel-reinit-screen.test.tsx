/** Réinitialisation en cours (Figma « Réinitialisation · En cours »). */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ReferentielReinitScreen from '@/app/(app)/referentiel-reinit';
import { useAuthStore } from '@/lib/auth-store';
import { type OptionsReinitialisation, reinitialiserReferentiel } from '@/lib/referentiel-sync';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack, push: jest.fn() }) }));
jest.mock('@/lib/storage', () => ({ storage: { getItem: jest.fn(), setItem: jest.fn(), deleteItem: jest.fn() } }));
jest.mock('@/lib/referentiel-sync', () => ({ reinitialiserReferentiel: jest.fn() }));

const ORDRE = [
  'postes_acridiens',
  'stations_fixes',
  'utilisateurs_equipe',
  'pesticides',
  'cultures',
  'codes_stades',
  'campagnes',
  'lieux_aeriens',
  'equipes',
  'equipe_membres',
  'sites_aeriens',
  'aeronefs',
  'equipe_aeronefs',
] as const;

const fini = (i: number, lignes = 10) => ({ table: ORDRE[i], index: i + 1, total: 13, etat: 'fini' as const, lignes });
const enCours = (i: number) => ({ table: ORDRE[i], index: i + 1, total: 13, etat: 'en_cours' as const, lignes: 0 });

beforeEach(() => {
  mockBack.mockReset();
  jest.mocked(reinitialiserReferentiel).mockReset();
  useAuthStore.setState({ token: 'jeton-1' } as never);
});

describe('ReferentielReinitScreen', () => {
  it('pendant le téléchargement : 0 / 13, « Annuler » disponible', async () => {
    jest.mocked(reinitialiserReferentiel).mockReturnValue(new Promise(() => {}));
    await render(<ReferentielReinitScreen />);

    expect(screen.getByText('0 / 13 tables')).toBeTruthy();
    expect(screen.getByText('Téléchargement depuis le serveur…')).toBeTruthy();
    expect(screen.getByText('Annuler')).toBeTruthy();
  });

  it('« Annuler » pendant le téléchargement demande l’annulation et ferme l’écran', async () => {
    let options: OptionsReinitialisation = {};
    jest.mocked(reinitialiserReferentiel).mockImplementation((_t, o) => {
      options = o ?? {};
      return new Promise(() => {});
    });
    await render(<ReferentielReinitScreen />);

    await fireEvent.press(screen.getByTestId('reinit-action'));

    expect(options.signal?.aborted).toBe(true);
    expect(mockBack).toHaveBeenCalled();
  });

  it('quitter l’écran pendant le téléchargement coupe la requête', async () => {
    let options: OptionsReinitialisation = {};
    jest.mocked(reinitialiserReferentiel).mockImplementation((_t, o) => {
      options = o ?? {};
      return new Promise(() => {});
    });
    const { unmount } = await render(<ReferentielReinitScreen />);
    expect(options.signal?.aborted).toBe(false);

    await unmount();

    expect(options.signal?.aborted).toBe(true);
  });

  it('une exécution abandonnée n’écrase pas l’état de la suivante (double lancement)', async () => {
    const options: OptionsReinitialisation[] = [];
    const finir: ((r: 'termine' | 'annule') => void)[] = [];
    jest.mocked(reinitialiserReferentiel).mockImplementation((_t, o) => {
      options.push(o ?? {});
      return new Promise((resolu) => finir.push(resolu));
    });
    await render(<ReferentielReinitScreen />);

    // Relance après échec : la première exécution est abandonnée, la seconde devient la courante.
    await act(async () => {
      finir[0]('annule');
    });
    expect(await screen.findByText('Réinitialisation annulée — rien n’a été supprimé')).toBeTruthy();

    jest.mocked(reinitialiserReferentiel).mockClear();
    await fireEvent.press(screen.getByText('Fermer'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('montre les tables terminées avec leur nombre d’entrées, la table en cours et celles qui restent', async () => {
    let options: OptionsReinitialisation = {};
    jest.mocked(reinitialiserReferentiel).mockImplementation((_t, o) => {
      options = o ?? {};
      return new Promise(() => {});
    });
    await render(<ReferentielReinitScreen />);

    await act(async () => {
      options.surProgression?.(enCours(0));
      options.surProgression?.(fini(0, 86));
      options.surProgression?.(enCours(1));
    });

    expect(screen.getByText('1 / 13 tables')).toBeTruthy();
    expect(screen.getByText('Enregistrement sur le téléphone…')).toBeTruthy();
    expect(screen.getByText('Postes acridiens')).toBeTruthy();
    expect(screen.getByText('86 entrées')).toBeTruthy();
    expect(screen.getByText('en cours…')).toBeTruthy();
    expect(screen.getByText(/11 tables restantes : /)).toBeTruthy();
    // Une fois l'écriture commencée, il n'y a plus de retour possible.
    expect(screen.getByTestId('reinit-action').props.accessibilityState.disabled).toBe(true);
  });

  it('terminé : 13 / 13 et « Fermer »', async () => {
    jest.mocked(reinitialiserReferentiel).mockImplementation(async (_t, o) => {
      ORDRE.forEach((_, i) => o?.surProgression?.(fini(i)));
      return 'termine';
    });
    await render(<ReferentielReinitScreen />);

    expect(await screen.findByText('13 / 13 tables')).toBeTruthy();
    expect(screen.getByText('Référentiels à jour')).toBeTruthy();
    await fireEvent.press(screen.getByText('Fermer'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('échec : dit que les données locales sont intactes et propose de réessayer', async () => {
    jest.mocked(reinitialiserReferentiel).mockRejectedValueOnce(new Error('réseau'));
    await render(<ReferentielReinitScreen />);

    expect(await screen.findByText('La réinitialisation a échoué — vos données locales sont intactes')).toBeTruthy();

    jest.mocked(reinitialiserReferentiel).mockResolvedValueOnce('termine');
    await fireEvent.press(screen.getByTestId('reinit-reessayer'));

    await waitFor(() => expect(reinitialiserReferentiel).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Référentiels à jour')).toBeTruthy();
  });

  it('annulé avant le vidage : rien n’a été supprimé', async () => {
    jest.mocked(reinitialiserReferentiel).mockResolvedValue('annule');
    await render(<ReferentielReinitScreen />);
    expect(await screen.findByText('Réinitialisation annulée — rien n’a été supprimé')).toBeTruthy();
  });
});
