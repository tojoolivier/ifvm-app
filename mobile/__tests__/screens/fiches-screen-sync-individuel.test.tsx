/**
 * Écran « Mes fiches » global (fiches.tsx) — #synchro-fiche-par-fiche : le
 * badge « À SYNCHRO »/« ÉCHEC ENVOI » devient lui-même le bouton qui
 * synchronise CETTE fiche seule, sans passer par l'écran Synchronisation.
 * Couvre les fiches de traitement, qui n'avaient jusqu'ici qu'un envoi en lot (sync.tsx).
 */
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import FichesScreen from '@/app/(app)/fiches';
import { useAuthStore } from '@/lib/auth-store';
import * as traitementRepository from '@/lib/traitement-repository';
import * as traitementSync from '@/lib/traitement-sync';

jest.mock('expo-router', () => ({
  ...require('../test-utils/mock-expo-router').expoRouterMock(),
  useFocusEffect: (effect: () => void) => effect(),
}));

jest.mock('@/lib/traitement-repository', () => ({
  listToutesTraitementsLocal: jest.fn(),
  getTraitement: jest.fn(),
}));

jest.mock('@/lib/traitement-sync', () => ({
  syncAllTraitements: jest.fn(),
}));

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

  it('affiche un bouton « À SYNCHRO ↻ » sur une fiche de traitement non envoyée', async () => {
    await render(<FichesScreen />);

    const boutons = await screen.findAllByText('À SYNCHRO');
    expect(boutons).toHaveLength(1);
  });

  it('synchronise la fiche de traitement complète (pas la ligne à plat) quand son bouton est tapé', async () => {
    await render(<FichesScreen />);
    const [boutonTraitement] = await screen.findAllByText('À SYNCHRO');

    fireEvent.press(boutonTraitement);

    await waitFor(() => expect(traitementRepository.getTraitement).toHaveBeenCalledWith('trait-1'));
    await waitFor(() =>
      expect(traitementSync.syncAllTraitements).toHaveBeenCalledWith([TRAITEMENT_A_SYNCHRO], 'token-test')
    );
  });

  it('affiche le motif d’échec en alerte plutôt que de le taire', async () => {
    jest.mocked(traitementSync.syncAllTraitements).mockResolvedValue({
      reussies: [],
      echouees: [
        {
          id: 'trait-1',
          label: 'TR-2026-0001',
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
    const [boutonTraitement] = await screen.findAllByText('À SYNCHRO');
    fireEvent.press(boutonTraitement);

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('Échec de synchronisation', 'Appareil hors ligne.')
    );
  });
});
