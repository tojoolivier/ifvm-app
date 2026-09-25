/**
 * Écran Synchronisation ((app)/sync.tsx) — le domaine « traitement » y était
 * absent : ni affiché dans « Fiches en attente », ni inclus dans le lot
 * envoyé par le bouton « Synchroniser ». Une fiche de traitement complète en
 * attente d'envoi était donc signalée indéfiniment « Aucune fiche en attente »
 * / « Aucune fiche à synchroniser », quel que soit le nombre de tentatives
 * (#erreur-sync-fiche-introuvable).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import SyncScreen from '@/app/(app)/sync';
import { useAuthStore } from '@/lib/auth-store';
import * as referentielSync from '@/lib/referentiel-sync';
import * as referentielDb from '@/lib/referentiel-db';
import * as traitementRepository from '@/lib/traitement-repository';
import * as traitementSync from '@/lib/traitement-sync';

jest.mock('expo-router', () => ({
  ...require('../test-utils/mock-expo-router').expoRouterMock(),
  useFocusEffect: (effect: () => void) => effect(),
}));



jest.mock('@/lib/referentiel-sync', () => ({
  pullReferentiel: jest.fn(),
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

const TRAITEMENT_EN_ATTENTE = {
  id: 'trait-1',
  prospection_id: 'prosp-1',
  numero_fiche: 'TRAIT-2026-00042',
  type_traitement: 'TERRESTRE',
  date_traitement: '2026-09-01',
  statut: 'brouillon',
  statut_sync: 'local',
  updated_at: '2026-09-01T10:00:00Z',
} as any;

describe('SyncScreen — fiches de traitement en attente', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: 'token-test' } as any);

    jest.mocked(referentielSync.pullReferentiel).mockReset().mockResolvedValue(undefined);
    jest.mocked(referentielDb.compterReferentielLocal).mockReset().mockResolvedValue([]);
    jest.mocked(traitementRepository.listToutesTraitementsLocal)
      .mockReset()
      .mockResolvedValue([TRAITEMENT_EN_ATTENTE]);
    jest.mocked(traitementRepository.getTraitement)
      .mockReset()
      .mockResolvedValue(TRAITEMENT_EN_ATTENTE);
    jest.mocked(traitementSync.syncAllTraitements)
      .mockReset()
      .mockResolvedValue({ reussies: ['trait-1'], echouees: [], conflits: [] });
  });

  it('affiche la fiche de traitement en attente, pas « Aucune fiche en attente »', async () => {
    await render(<SyncScreen />);

    await waitFor(() => expect(screen.getByText('TRAIT-2026-00042')).toBeVisible());
    expect(screen.queryByText('Aucune fiche en attente')).toBeNull();
    expect(screen.getByText('🔄 Synchroniser (1)')).toBeVisible();
  });

  it('« Synchroniser » envoie la fiche de traitement — le résumé n\'affiche plus « Aucune fiche à synchroniser »', async () => {
    await render(<SyncScreen />);
    await screen.findByText('TRAIT-2026-00042');

    fireEvent.press(screen.getByText('🔄 Synchroniser (1)'));

    await waitFor(() =>
      expect(traitementSync.syncAllTraitements).toHaveBeenCalledWith(
        [TRAITEMENT_EN_ATTENTE],
        'token-test'
      )
    );
    expect(screen.queryByText('Aucune fiche à synchroniser')).toBeNull();
    await waitFor(() => expect(screen.getByText(/synchronisée/)).toBeVisible());
  });

  // #traitement-brouillon-distinct-fiche-creee : un traitement jamais enregistré (parcours en
  // cours) n'est pas une fiche à synchroniser — ni listé, ni compté, ni envoyé.
  it('n’affiche ni ne compte un traitement encore en brouillon (jamais enregistré)', async () => {
    jest.mocked(traitementRepository.listToutesTraitementsLocal).mockResolvedValue([
      { ...TRAITEMENT_EN_ATTENTE, id: 'trait-brouillon', numero_fiche: 'TRAIT-BROUILLON', statut_sync: 'brouillon' },
      TRAITEMENT_EN_ATTENTE,
    ]);

    await render(<SyncScreen />);

    await waitFor(() => expect(screen.getByText('TRAIT-2026-00042')).toBeVisible());
    expect(screen.queryByText('TRAIT-BROUILLON')).toBeNull();
    expect(screen.getByText('🔄 Synchroniser (1)')).toBeVisible();
  });
});
