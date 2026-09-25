/**
 * Écran d'accueil — section « ACTIVITÉ RÉCENTE » (#activite-recente-traitements) :
 * n'affichait jusqu'ici que les fiches de prospection (`listToutesProspectionsLocal`),
 * alors que « Mes fiches » (fiches.tsx) affiche déjà prospections ET
 * traitements confondus. Toute fiche créée — y compris une fiche de
 * traitement — doit désormais y apparaître, triée avec les prospections par
 * dernière modification.
 */
import { render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import DashboardScreen from '@/app/(app)/index';
import { useAuthStore } from '@/lib/auth-store';
import * as traitementRepository from '@/lib/traitement-repository';
import * as Network from 'expo-network';

const TEST_SAFE_AREA_METRICS = {
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
  frame: { x: 0, y: 0, width: 0, height: 0 },
};

jest.mock('expo-router', () => ({
  ...require('../test-utils/mock-expo-router').expoRouterMock(),
  useFocusEffect: (effect: () => void) => effect(),
}));

jest.mock('@/lib/traitement-repository', () => ({
  listToutesTraitementsLocal: jest.fn().mockResolvedValue([]),
  listUnsyncedTraitements: jest.fn().mockResolvedValue([]),
}));

jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
}));

describe('DashboardScreen — Activité récente : inclut les fiches de traitement', () => {
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
    jest.mocked(traitementRepository.listToutesTraitementsLocal).mockReset().mockResolvedValue([]);
    jest.mocked(Network.getNetworkStateAsync).mockClear();
  });

  it('affiche une fiche de traitement récente, avec sa localité et son numéro', async () => {
    jest.mocked(traitementRepository.listToutesTraitementsLocal).mockResolvedValue([
      {
        id: 'trait-1',
        numero_fiche: 'CRT-2026-00042',
        type_traitement: 'AERIEN',
        localite: 'Betioky',
        date_traitement: '2026-09-16',
        statut_sync: 'local',
        updated_at: '2026-09-16T10:00:00Z',
      } as any,
    ]);

    await render(
      <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
        <DashboardScreen />
      </SafeAreaProvider>
    );

    await waitFor(() => expect(screen.getByText('Betioky')).toBeTruthy());
    expect(screen.getByText('N°CRT-2026-00042 · 2026-09-16')).toBeTruthy();
    expect(screen.getByText('À SYNCHRO')).toBeTruthy();
  });

  it('trie les traitements par dernière modification', async () => {
    jest.mocked(traitementRepository.listToutesTraitementsLocal).mockResolvedValue([
      {
        id: 'trait-0',
        numero_fiche: 'CRT-0',
        type_traitement: 'TERRESTRE',
        localite: 'Betioky',
        date_traitement: '2026-09-10',
        statut_sync: 'synced',
        updated_at: '2026-09-10T08:00:00Z',
      } as any,
      {
        id: 'trait-1',
        numero_fiche: 'CRT-1',
        type_traitement: 'TERRESTRE',
        localite: 'Ambovombe',
        date_traitement: '2026-09-16',
        statut_sync: 'synced',
        updated_at: '2026-09-16T08:00:00Z',
      } as any,
    ]);

    await render(
      <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
        <DashboardScreen />
      </SafeAreaProvider>
    );

    await waitFor(() => expect(screen.getByText('Ambovombe')).toBeTruthy());

    const titres = screen.getAllByText(/Ambovombe|Betioky/).map((n) => n.props.children);
    // Le traitement le plus récemment modifié apparaît en premier.
    expect(titres).toEqual(['Ambovombe', 'Betioky']);
  });

  it('n’affiche pas la section quand aucun traitement n’existe', async () => {
    await render(
      <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
        <DashboardScreen />
      </SafeAreaProvider>
    );

    await waitFor(() => expect(screen.getByText('ACCÈS RAPIDE')).toBeTruthy());
    expect(screen.queryByText('ACTIVITÉ RÉCENTE')).toBeNull();
  });
});
