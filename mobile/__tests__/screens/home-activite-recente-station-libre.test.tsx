/**
 * Écran d'accueil — section « ACTIVITÉ RÉCENTE » : une fiche extensive/
 * validation n'a jamais de `station_nom` (pas de station fixe du référentiel,
 * cf. extensive-reference.tsx) — seul `station_libre` (saisie libre) porte la
 * localité réellement enregistrée. Avant ce correctif, cette section
 * affichait « Station non spécifiée » pour toute fiche extensive/validation
 * alors que la localité existait bel et bien, contrairement à fiches.tsx/
 * prospection.tsx qui appliquent déjà ce repli (`stationLabel`).
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
  listToutesProspectionsLocal: jest.fn().mockResolvedValue([]),
  countUnsyncedProspections: jest.fn().mockResolvedValue(0),
}));

jest.mock('@/lib/traitement-repository', () => ({
  listToutesTraitementsLocal: jest.fn().mockResolvedValue([]),
}));

jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
}));

describe('DashboardScreen — Activité récente : repli sur station_libre', () => {
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
    jest.mocked(prospectionRepository.listToutesProspectionsLocal).mockClear();
    jest.mocked(prospectionRepository.countUnsyncedProspections).mockClear();
    jest.mocked(Network.getNetworkStateAsync).mockClear();
  });

  it('affiche station_libre (extensif/validation) au lieu de « Station non spécifiée »', async () => {
    jest.mocked(prospectionRepository.listToutesProspectionsLocal).mockResolvedValue([
      {
        id: 'prosp-1',
        station_nom: null,
        station_libre: 'Andasibe-Village',
        n_fiche: 'EXT-2026-00125',
        date_prospection: '2026-09-15',
        statut_sync: 'local',
      } as any,
    ]);

    await render(
      <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
        <DashboardScreen />
      </SafeAreaProvider>
    );

    await waitFor(() => expect(screen.getByText('Andasibe-Village')).toBeTruthy());
    expect(screen.queryByText('Station non spécifiée')).toBeNull();
  });

  it('affiche station_nom (intensif, référentiel) en priorité quand les deux sont renseignés', async () => {
    jest.mocked(prospectionRepository.listToutesProspectionsLocal).mockResolvedValue([
      {
        id: 'prosp-1',
        station_nom: 'Poste Ambatondrazaka',
        station_libre: 'Andasibe-Village',
        n_fiche: 'INT-2026-00042',
        date_prospection: '2026-09-15',
        statut_sync: 'synced',
      } as any,
    ]);

    await render(
      <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
        <DashboardScreen />
      </SafeAreaProvider>
    );

    await waitFor(() => expect(screen.getByText('Poste Ambatondrazaka')).toBeTruthy());
  });

  it('affiche toujours « Station non spécifiée » quand ni l’un ni l’autre n’est renseigné', async () => {
    jest.mocked(prospectionRepository.listToutesProspectionsLocal).mockResolvedValue([
      {
        id: 'prosp-1',
        station_nom: null,
        station_libre: null,
        n_fiche: null,
        date_prospection: '2026-09-15',
        statut_sync: 'local',
      } as any,
    ]);

    await render(
      <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
        <DashboardScreen />
      </SafeAreaProvider>
    );

    await waitFor(() => expect(screen.getByText('Station non spécifiée')).toBeTruthy());
  });
});
