/**
 * #brouillon-prospection-hors-a-synchro : sur l'accueil (« ACTIVITÉ RÉCENTE »),
 * une prospection encore en cours de saisie (`statut = 'brouillon'`) portait le
 * badge « À SYNCHRO » — laissant croire qu'elle partirait au prochain passage
 * réseau. Elle n'est une fiche envoyable qu'une fois tout le parcours validé
 * (enregistrement, `completeProspection`) : d'ici là, « BROUILLON ».
 */
import { render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import DashboardScreen from '@/app/(app)/index';
import { useAuthStore } from '@/lib/auth-store';
import * as prospectionRepository from '@/lib/prospection-repository';
import * as traitementRepository from '@/lib/traitement-repository';

const TEST_SAFE_AREA_METRICS = {
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
  frame: { x: 0, y: 0, width: 0, height: 0 },
};

jest.mock('expo-router', () => ({
  ...require('../test-utils/mock-expo-router').expoRouterMock(),
  useFocusEffect: (effect: () => void) => effect(),
}));

jest.mock('@/lib/prospection-repository', () => ({
  listToutesProspectionsLocal: jest.fn().mockResolvedValue([]),
  countUnsyncedProspections: jest.fn().mockResolvedValue(0),
}));

jest.mock('@/lib/traitement-repository', () => ({
  listToutesTraitementsLocal: jest.fn().mockResolvedValue([]),
}));

jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
}));

const prospection = (over: Record<string, unknown>) =>
  ({
    id: 'prosp-1',
    station_nom: 'Poste Ambatondrazaka',
    station_libre: null,
    n_fiche: 'EXT-1',
    date_prospection: '2026-09-10',
    statut: 'en_attente',
    statut_sync: 'local',
    updated_at: '2026-09-10T08:00:00Z',
    ...over,
  }) as any;

async function ouvrir() {
  await render(
    <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
      <DashboardScreen />
    </SafeAreaProvider>
  );
}

describe('DashboardScreen — Activité récente : brouillon de prospection ≠ « À SYNCHRO »', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: 'user-1',
        nom: 'Rakoto',
        prenom: 'Jean',
        email: 'jean@test.com',
        role: 'prospecteur',
        actif: true,
        created_at: '2026-01-01T00:00:00Z',
      } as any,
      token: 'token-test',
    });
    jest.mocked(prospectionRepository.listToutesProspectionsLocal).mockReset().mockResolvedValue([]);
    jest.mocked(traitementRepository.listToutesTraitementsLocal).mockReset().mockResolvedValue([]);
  });

  it('affiche « BROUILLON » (et jamais « À SYNCHRO ») pour une prospection encore en cours de saisie', async () => {
    jest
      .mocked(prospectionRepository.listToutesProspectionsLocal)
      .mockResolvedValue([prospection({ statut: 'brouillon', statut_sync: 'local' })]);

    await ouvrir();

    await waitFor(() => expect(screen.getByText('Poste Ambatondrazaka')).toBeTruthy());
    expect(screen.getByText('BROUILLON')).toBeTruthy();
    expect(screen.queryByText('À SYNCHRO')).toBeNull();
  });

  it('affiche « À SYNCHRO » une fois la fiche créée (parcours validé, enregistrée hors ligne)', async () => {
    jest
      .mocked(prospectionRepository.listToutesProspectionsLocal)
      .mockResolvedValue([prospection({ statut: 'en_attente', statut_sync: 'local' })]);

    await ouvrir();

    await waitFor(() => expect(screen.getByText('Poste Ambatondrazaka')).toBeTruthy());
    expect(screen.getByText('À SYNCHRO')).toBeTruthy();
    expect(screen.queryByText('BROUILLON')).toBeNull();
  });

  // #traitement-brouillon-distinct-fiche-creee : même règle pour un traitement.
  it('affiche « BROUILLON » pour un traitement jamais enregistré, « À SYNCHRO » une fois enregistré', async () => {
    const traitement = (id: string, statutSync: string) =>
      ({
        id,
        numero_fiche: `T-${id}`,
        type_traitement: 'TERRESTRE',
        localite: `Loc-${id}`,
        date_traitement: '2026-09-16',
        statut: 'brouillon',
        statut_sync: statutSync,
        updated_at: '2026-09-16T08:00:00Z',
      }) as any;
    jest
      .mocked(traitementRepository.listToutesTraitementsLocal)
      .mockResolvedValue([traitement('a', 'brouillon'), traitement('b', 'local')]);

    await ouvrir();

    await waitFor(() => expect(screen.getByText('Loc-a')).toBeTruthy());
    expect(screen.getAllByText('BROUILLON')).toHaveLength(1);
    expect(screen.getAllByText('À SYNCHRO')).toHaveLength(1);
  });
});
