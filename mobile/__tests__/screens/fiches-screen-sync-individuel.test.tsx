/**
 * Écran « Mes fiches » global (fiches.tsx) — #synchro-fiche-par-fiche : le
 * badge « À SYNCHRO »/« ÉCHEC ENVOI » devient lui-même le bouton qui
 * synchronise CETTE fiche seule, sans passer par l'écran Synchronisation.
 * Couvre les deux domaines (prospection et traitement), qui n'avaient jusqu'ici
 * qu'un envoi en lot (sync.tsx) ou par écran dédié (prospection.tsx).
 */
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import FichesScreen from '@/app/(app)/fiches';
import { useAuthStore } from '@/lib/auth-store';
import * as prospectionAccueil from '@/lib/prospection-accueil';
import * as prospectionReview from '@/lib/prospection-review';
import * as traitementRepository from '@/lib/traitement-repository';
import * as traitementSync from '@/lib/traitement-sync';

jest.mock('expo-router', () => ({
  ...require('../test-utils/mock-expo-router').expoRouterMock(),
  useFocusEffect: (effect: () => void) => effect(),
}));

jest.mock('@/lib/prospection-accueil', () => ({
  loadAccueilData: jest.fn(),
  loadMesProspectionsServeur: jest.fn(),
}));

jest.mock('@/lib/prospection-review', () => ({
  syncAllProspections: jest.fn(),
}));

// Jamais exercé en vrai ici (base sqlite) : seule `synchroniserStatutServeur`
// est appelée par l'écran, sur la liste (vide ou non) des fiches déjà connues
// du serveur.
jest.mock('@/lib/prospection-repository', () => ({
  synchroniserStatutServeur: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/traitement-repository', () => ({
  listToutesTraitementsLocal: jest.fn(),
  getTraitement: jest.fn(),
}));

jest.mock('@/lib/traitement-sync', () => ({
  syncAllTraitements: jest.fn(),
}));

const EMPTY_ACCUEIL = { unsyncedCount: 0, activeDraft: null, draftsCount: 0, recent: [], validated: [], pendingSync: [] };

const PROSPECTION_A_SYNCHRO = {
  id: 'prosp-1',
  n_fiche: 'PR-2026-0001',
  type_prospection: 'intensive',
  date_prospection: '2026-09-20',
  statut: 'en_attente',
  statut_sync: 'local',
  station_nom: 'Station test',
} as any;

const TRAITEMENT_A_SYNCHRO = {
  id: 'trait-1',
  numero_fiche: 'TR-2026-0001',
  type_traitement: 'TERRESTRE',
  date_traitement: '2026-09-19',
  localite: 'Ambovombe',
  statut: 'brouillon',
  statut_sync: 'local',
  updated_at: '2026-09-19T08:00:00Z',
} as any;

describe('FichesScreen — synchro fiche par fiche (#synchro-fiche-par-fiche)', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 'user-1' } as any, token: 'token-test' } as any);

    jest.mocked(prospectionAccueil.loadAccueilData).mockReset().mockResolvedValue({
      ...EMPTY_ACCUEIL,
      recent: [PROSPECTION_A_SYNCHRO],
    });
    jest.mocked(prospectionAccueil.loadMesProspectionsServeur).mockReset().mockResolvedValue([]);
    jest.mocked(prospectionReview.syncAllProspections)
      .mockReset()
      .mockResolvedValue({ reussies: ['prosp-1'], echouees: [], conflits: [] });
    jest.mocked(traitementRepository.listToutesTraitementsLocal)
      .mockReset()
      .mockResolvedValue([TRAITEMENT_A_SYNCHRO]);
    jest.mocked(traitementRepository.getTraitement).mockReset().mockResolvedValue(TRAITEMENT_A_SYNCHRO);
    jest.mocked(traitementSync.syncAllTraitements)
      .mockReset()
      .mockResolvedValue({ reussies: ['trait-1'], echouees: [], conflits: [] });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('affiche un bouton « À SYNCHRO ↻ » sur une fiche de prospection et une fiche de traitement non envoyées', async () => {
    await render(<FichesScreen />);

    const boutons = await screen.findAllByText('À SYNCHRO ↻');
    expect(boutons).toHaveLength(2);
  });

  it('synchronise uniquement la fiche de prospection tapée, sans passer par l’écran Synchronisation', async () => {
    await render(<FichesScreen />);
    const [boutonProspection] = await screen.findAllByText('À SYNCHRO ↻');
    // La liste se rafraîchit après l'envoi, pas seulement au montage.
    const appelsAuMontage = jest.mocked(prospectionAccueil.loadAccueilData).mock.calls.length;

    fireEvent.press(boutonProspection);

    await waitFor(() =>
      expect(prospectionReview.syncAllProspections).toHaveBeenCalledWith([PROSPECTION_A_SYNCHRO], 'token-test')
    );
    expect(traitementSync.syncAllTraitements).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(jest.mocked(prospectionAccueil.loadAccueilData).mock.calls.length).toBeGreaterThan(appelsAuMontage)
    );
  });

  it('synchronise la fiche de traitement complète (pas la ligne à plat) quand son bouton est tapé', async () => {
    await render(<FichesScreen />);
    const [, boutonTraitement] = await screen.findAllByText('À SYNCHRO ↻');

    fireEvent.press(boutonTraitement);

    await waitFor(() => expect(traitementRepository.getTraitement).toHaveBeenCalledWith('trait-1'));
    await waitFor(() =>
      expect(traitementSync.syncAllTraitements).toHaveBeenCalledWith([TRAITEMENT_A_SYNCHRO], 'token-test')
    );
    expect(prospectionReview.syncAllProspections).not.toHaveBeenCalled();
  });

  it('affiche le motif d’échec en alerte plutôt que de le taire', async () => {
    jest.mocked(prospectionReview.syncAllProspections).mockResolvedValue({
      reussies: [],
      echouees: [
        {
          id: 'prosp-1',
          label: 'PR-2026-0001',
          classe: 'NetworkError',
          message: 'Appareil hors ligne.',
          action: null,
          statutHttp: null,
          sort: 'file',
        },
      ],
      conflits: [],
    });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    await render(<FichesScreen />);
    const [boutonProspection] = await screen.findAllByText('À SYNCHRO ↻');
    fireEvent.press(boutonProspection);

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('Échec de synchronisation', 'Appareil hors ligne.')
    );
  });

  it('ne propose pas de bouton de synchro pour une fiche déjà connue du serveur', async () => {
    jest.mocked(prospectionAccueil.loadAccueilData).mockResolvedValue(EMPTY_ACCUEIL);
    jest.mocked(prospectionAccueil.loadMesProspectionsServeur).mockResolvedValue([
      {
        id: 'prosp-2',
        n_fiche: 'PR-2026-0002',
        type_prospection: 'intensive',
        date_prospection: '2026-09-18',
        statut: 'validee',
        station_nom: 'Station test',
      } as any,
    ]);
    jest.mocked(traitementRepository.listToutesTraitementsLocal).mockResolvedValue([]);

    await render(<FichesScreen />);

    await screen.findByText('PR-2026-0002');
    expect(screen.getByText('Validée')).toBeVisible();
    expect(screen.queryByText(/↻/)).toBeNull();
  });
});
