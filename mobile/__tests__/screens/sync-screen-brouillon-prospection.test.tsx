/**
 * #brouillon-prospection-hors-a-synchro : sur l'écran Synchronisation, la liste
 * « Fiches en attente » ne contient JAMAIS un brouillon de prospection (parcours
 * pas encore terminé) — seulement les fiches créées, enregistrées hors ligne
 * (`statut != 'brouillon'`), et le bouton « Synchroniser » ne les compte pas.
 */
import { render, screen, waitFor } from '@testing-library/react-native';
import SyncScreen from '@/app/(app)/sync';
import { useAuthStore } from '@/lib/auth-store';
import * as prospectionAccueil from '@/lib/prospection-accueil';
import * as referentielDb from '@/lib/referentiel-db';
import * as traitementRepository from '@/lib/traitement-repository';

jest.mock('expo-router', () => ({
  ...require('../test-utils/mock-expo-router').expoRouterMock(),
  useFocusEffect: (effect: () => void) => effect(),
}));

jest.mock('@/lib/prospection-accueil', () => ({
  loadAccueilData: jest.fn(),
}));

jest.mock('@/lib/prospection-review', () => ({
  syncAllProspections: jest.fn(),
}));

jest.mock('@/lib/referentiel-sync', () => ({
  pullReferentiel: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/referentiel-db', () => ({
  compterReferentielLocal: jest.fn(),
}));

jest.mock('@/lib/traitement-repository', () => ({
  getTraitement: jest.fn(),
  listToutesTraitementsLocal: jest.fn(),
}));

jest.mock('@/lib/traitement-sync', () => ({
  syncAllTraitements: jest.fn(),
}));

const fiche = (over: Record<string, unknown>) =>
  ({
    id: 'prosp-x',
    type_prospection: 'extensive',
    n_fiche: 'X',
    date_prospection: '2026-09-10',
    statut: 'en_attente',
    statut_sync: 'local',
    updated_at: '2026-09-10T08:00:00Z',
    ...over,
  }) as any;

describe('SyncScreen — brouillons de prospection exclus de « Fiches en attente »', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: 'token-test' } as any);
    jest.mocked(referentielDb.compterReferentielLocal).mockReset().mockResolvedValue([]);
    jest.mocked(traitementRepository.listToutesTraitementsLocal).mockReset().mockResolvedValue([]);
  });

  it('n’affiche que la fiche créée, pas le brouillon, et ne compte qu’elle dans « Synchroniser »', async () => {
    const brouillon = fiche({ id: 'prosp-brouillon', n_fiche: 'BROUILLON-EN-COURS', statut: 'brouillon' });
    const creee = fiche({ id: 'prosp-creee', n_fiche: 'FICHE-CREEE', statut: 'en_attente' });
    jest.mocked(prospectionAccueil.loadAccueilData).mockReset().mockResolvedValue({
      unsyncedCount: 1,
      activeDraft: brouillon,
      draftsCount: 1,
      recent: [brouillon, creee],
      validated: [],
      pendingSync: [creee],
    });

    await render(<SyncScreen />);

    await waitFor(() => expect(screen.getByText('FICHE-CREEE')).toBeVisible());
    expect(screen.queryByText('BROUILLON-EN-COURS')).toBeNull();
    expect(screen.getByText('🔄 Synchroniser (1)')).toBeVisible();
  });
});
