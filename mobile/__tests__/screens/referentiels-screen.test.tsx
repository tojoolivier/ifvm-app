/** Accueil des référentiels (Figma « Référentiels · Accueil » et « Réinitialisation · Confirmation »). */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import ReferentielsScreen from '@/app/(app)/referentiels';
import { useAuthStore } from '@/lib/auth-store';
import { REFERENTIEL_TABLES } from '@/lib/referentiel-schema.generated';
import { resumerReferentielLocal } from '@/lib/referentiel-consultation';
import { rechercherPartout } from '@/lib/referentiel-generique';
import { pullReferentiel, resetReferentielSyncCursors } from '@/lib/referentiel-sync';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: mockPush }),
  useFocusEffect: (effect: () => void) => require('react').useEffect(effect, []),
}));
jest.mock('@/lib/storage', () => ({ storage: { getItem: jest.fn(), setItem: jest.fn(), deleteItem: jest.fn() } }));
jest.mock('@/lib/referentiel-sync', () => ({ pullReferentiel: jest.fn(), resetReferentielSyncCursors: jest.fn() }));
jest.mock('@/lib/referentiel-generique', () => ({
  ...jest.requireActual('@/lib/referentiel-generique'),
  rechercherPartout: jest.fn(),
}));
jest.mock('@/lib/referentiel-consultation', () => ({
  ...jest.requireActual('@/lib/referentiel-consultation'),
  resumerReferentielLocal: jest.fn(),
}));

/** Une synchronisation d'il y a une heure : « À JOUR ». */
const IL_Y_A_UNE_HEURE = new Date(Date.now() - 3600_000).toISOString();

const resume = (derniereSynchro: string | null) => ({
  derniereSynchro,
  tables: REFERENTIEL_TABLES.map((table) => ({
    table,
    lignes: table === 'pesticide' ? 42 : 1,
    majLe: table === 'equipe_membre' ? null : '2026-09-20T05:12:00.000Z',
  })),
  totalLignes: 42 + 12,
});

beforeEach(() => {
  mockPush.mockReset();
  jest.mocked(pullReferentiel).mockReset().mockResolvedValue(undefined);
  jest.mocked(resetReferentielSyncCursors).mockReset().mockResolvedValue(undefined);
  jest.mocked(resumerReferentielLocal).mockResolvedValue(resume(IL_Y_A_UNE_HEURE));
  jest.mocked(rechercherPartout).mockReset().mockResolvedValue([]);
  useAuthStore.setState({ token: 'jeton-1' } as never);
});

describe('ReferentielsScreen', () => {
  it('range les 13 tables dans les cinq sections de la maquette, avec leur compte', async () => {
    await render(<ReferentielsScreen />);

    expect(await screen.findByText('TERRAIN')).toBeTruthy();
    for (const titre of ['PRODUITS', 'STADES & CAMPAGNES', 'AÉRIEN', 'ÉQUIPES']) expect(screen.getByText(titre)).toBeTruthy();
    expect(screen.getByText(/42 entrées · màj 20\/09/)).toBeTruthy();
    expect(screen.getByText(/13 tables · 54 entrées/)).toBeTruthy();
  });

  it('une synchro de moins de 24 h porte le badge « À JOUR »', async () => {
    await render(<ReferentielsScreen />);
    expect(await screen.findByText('À JOUR')).toBeTruthy();
  });

  it('jamais synchronisé : le badge le dit', async () => {
    jest.mocked(resumerReferentielLocal).mockResolvedValue(resume(null));
    await render(<ReferentielsScreen />);
    expect(await screen.findByText('JAMAIS SYNCHRONISÉ')).toBeTruthy();
  });

  it('chaque ligne s’ouvre : écrans dédiés pour trois, liste générique pour les autres', async () => {
    await render(<ReferentielsScreen />);
    await screen.findByText('TERRAIN');

    await fireEvent.press(screen.getByTestId('referentiel-pesticide'));
    await fireEvent.press(screen.getByTestId('referentiel-station_fixe'));
    await fireEvent.press(screen.getByTestId('referentiel-code_stade'));
    await fireEvent.press(screen.getByTestId('referentiel-culture'));
    await fireEvent.press(screen.getByTestId('referentiel-equipe_membre'));

    expect(mockPush.mock.calls.map((c) => c[0])).toEqual([
      '/(app)/referentiel-pesticides',
      '/(app)/referentiel-stations',
      '/(app)/referentiel-codes-stades',
      '/(app)/referentiel-liste?table=culture',
      '/(app)/referentiel-liste?table=equipe_membre',
    ]);
  });

  it('la recherche filtre les lignes', async () => {
    await render(<ReferentielsScreen />);
    await screen.findByText('TERRAIN');

    await fireEvent.changeText(screen.getByTestId('referentiel-recherche'), 'aeron');

    expect(screen.getByText('Aéronefs')).toBeTruthy();
    expect(screen.queryByText('Pesticides')).toBeNull();
    await fireEvent.changeText(screen.getByTestId('referentiel-recherche'), 'zzz');
    expect(screen.getByText('Aucun référentiel ne correspond à cette recherche.')).toBeTruthy();
  });

  it('un cache illisible le dit au lieu d’afficher « 0 tables »', async () => {
    jest.mocked(resumerReferentielLocal).mockRejectedValue(new Error('base fermée'));
    await render(<ReferentielsScreen />);

    expect(await screen.findByText('Impossible de lire le référentiel de ce téléphone.')).toBeTruthy();
    expect(screen.queryByText(/0 tables/)).toBeNull();
  });

  describe('recherche dans les entrées', () => {
    const trouves = [
      { table: 'station_fixe', libelle: 'Stations fixes', lignes: [{ cle: 's1', titre: 'Ihosy centre', code: 'STF-014', sousTitre: 'Ihosy', actif: true, majLe: null }] },
      { table: 'culture', libelle: 'Cultures', lignes: [{ cle: 'c1', titre: 'Maïs Ihosy', code: 'CUL-01', sousTitre: null, actif: true, majLe: null }] },
    ];

    it('montre les entrées trouvées, groupées par table', async () => {
      jest.mocked(rechercherPartout).mockResolvedValue(trouves);
      await render(<ReferentielsScreen />);
      await screen.findByText('TERRAIN');

      await fireEvent.changeText(screen.getByTestId('referentiel-recherche'), 'ihosy');

      expect(await screen.findByText('Ihosy centre')).toBeTruthy();
      expect(screen.getByText('STF-014 · Ihosy')).toBeTruthy();
      expect(screen.getByText('Maïs Ihosy')).toBeTruthy();
      // La recherche est différée de 200 ms : le mock renvoie `trouves` pour TOUT terme, donc les
      // résultats peuvent déjà être affichés (issus de l'appel initial `''`, si le rendu a pris plus
      // de 200 ms sur un runner lent) avant que l'appel pour « ihosy » ne parte — on l'attend.
      await waitFor(() => expect(rechercherPartout).toHaveBeenLastCalledWith('ihosy'));
    });

    it('un résultat ouvre sa fiche : écran dédié pour une station, fiche générique pour une culture', async () => {
      jest.mocked(rechercherPartout).mockResolvedValue(trouves);
      await render(<ReferentielsScreen />);
      await screen.findByText('TERRAIN');
      await fireEvent.changeText(screen.getByTestId('referentiel-recherche'), 'ihosy');

      await fireEvent.press(await screen.findByTestId('resultat-station_fixe-s1'));
      await fireEvent.press(screen.getByTestId('resultat-culture-c1'));

      expect(mockPush.mock.calls.map((c) => c[0])).toEqual([
        { pathname: '/(app)/referentiel-station', params: { id: 's1' } },
        { pathname: '/(app)/referentiel-fiche', params: { table: 'culture', cle: 'c1' } },
      ]);
    });

    it('un terme d’une lettre ne montre aucun résultat, même si une réponse tardive arrive', async () => {
      jest.mocked(rechercherPartout).mockResolvedValue(trouves);
      await render(<ReferentielsScreen />);
      await screen.findByText('TERRAIN');

      await fireEvent.changeText(screen.getByTestId('referentiel-recherche'), 'i');
      await new Promise((r) => setTimeout(r, 300));

      expect(screen.queryByText('Ihosy centre')).toBeNull();
    });

    it('les résultats d’entrées évitent le message « aucun référentiel »', async () => {
      jest.mocked(rechercherPartout).mockResolvedValue(trouves);
      await render(<ReferentielsScreen />);
      await screen.findByText('TERRAIN');

      await fireEvent.changeText(screen.getByTestId('referentiel-recherche'), 'zzzz');

      await screen.findByText('Ihosy centre');
      expect(screen.queryByText('Aucun référentiel ne correspond à cette recherche.')).toBeNull();
    });
  });

  it('« Synchroniser » remet les curseurs à zéro puis tire le référentiel', async () => {
    await render(<ReferentielsScreen />);
    await screen.findByText('TERRAIN');

    await fireEvent.press(screen.getByTestId('referentiels-synchroniser'));

    await waitFor(() => expect(pullReferentiel).toHaveBeenCalledWith('jeton-1'));
    expect(resetReferentielSyncCursors).toHaveBeenCalled();
  });

  describe('« Tout réinitialiser »', () => {
    const ouvrirLaConfirmation = async () => {
      await render(<ReferentielsScreen />);
      await screen.findByText('TERRAIN');
      await fireEvent.press(screen.getByTestId('referentiels-reinitialiser'));
    };

    it('demande confirmation avant de rien faire, en disant ce qui est supprimé', async () => {
      await ouvrirLaConfirmation();

      expect(screen.getByText('Réinitialiser les référentiels ?')).toBeTruthy();
      const modale = within(screen.getByTestId('modale-reinitialisation'));
      expect(modale.getByText('13 tables · 54 entrées')).toBeTruthy();
      expect(modale.getByText('Brouillons et fiches en attente d’envoi')).toBeTruthy();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('le bouton rouge est inerte tant que « Je comprends » n’est pas coché', async () => {
      await ouvrirLaConfirmation();

      await fireEvent.press(screen.getByTestId('reinit-confirmer'));
      expect(mockPush).not.toHaveBeenCalled();

      await fireEvent.press(screen.getByTestId('reinit-compris'));
      await fireEvent.press(screen.getByTestId('reinit-confirmer'));
      expect(mockPush).toHaveBeenCalledWith('/(app)/referentiel-reinit');
    });

    it('« Annuler » ferme sans rien lancer', async () => {
      await ouvrirLaConfirmation();

      await fireEvent.press(screen.getByTestId('reinit-annuler'));

      expect(mockPush).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByText('Réinitialiser les référentiels ?')).toBeNull());
    });
  });
});
