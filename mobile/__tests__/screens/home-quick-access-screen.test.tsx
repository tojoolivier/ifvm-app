/**
 * Écran d'accueil — section « ACCÈS RAPIDE » (#accueil-carte-de-zone-retiree) :
 * la tuile « Carte de zone » est retirée définitivement de l'interface, les
 * autres raccourcis (Nouvelle prospection, Mes fiches, Nouveau traitement,
 * Alertes) restent inchangés.
 */
import { render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import DashboardScreen from '@/app/(app)/index';
import { useAuthStore } from '@/lib/auth-store';
import * as prospectionRepository from '@/lib/prospection-repository';
import * as Network from 'expo-network';

const TEST_SAFE_AREA_METRICS = {
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
  frame: { x: 0, y: 0, width: 0, height: 0 },
};

jest.mock('expo-router', () => ({
  ...require('../test-utils/mock-expo-router').expoRouterMock(),
  useFocusEffect: (effect: () => void) => effect(),
}));

jest.mock('@/lib/prospection-repository', () => ({
  listRecentProspections: jest.fn().mockResolvedValue([]),
  countUnsyncedProspections: jest.fn().mockResolvedValue(0),
}));

jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
}));

describe('DashboardScreen — Accès rapide', () => {
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
    jest.mocked(prospectionRepository.listRecentProspections).mockClear();
    jest.mocked(prospectionRepository.countUnsyncedProspections).mockClear();
    jest.mocked(Network.getNetworkStateAsync).mockClear();
  });

  it('« Carte de zone » n\'apparaît plus, les autres raccourcis restent présents', async () => {
    await render(
      <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
        <DashboardScreen />
      </SafeAreaProvider>
    );
    // `toBeVisible()` dépend de l'opacité animée (fadeAnim, non avancée en test) — on
    // vérifie ici la présence dans l'arbre, ce qui suffit à couvrir la tuile retirée.
    await waitFor(() => expect(screen.getByText('ACCÈS RAPIDE')).toBeTruthy());

    expect(screen.queryByText('Carte de zone')).toBeNull();

    expect(screen.getByText('Nouvelle prospection')).toBeTruthy();
    expect(screen.getByText('Mes fiches')).toBeTruthy();
    expect(screen.getByText('Nouveau traitement')).toBeTruthy();
    expect(screen.getByText('Alertes')).toBeTruthy();
  });

  // #revalidation-prospection
  it('« Prospections à revalider » est accessible depuis le tableau de bord', async () => {
    await render(
      <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
        <DashboardScreen />
      </SafeAreaProvider>
    );
    await waitFor(() => expect(screen.getByText('ACCÈS RAPIDE')).toBeTruthy());

    expect(screen.getByText('Prospections à revalider')).toBeTruthy();
  });
});
