/**
 * Le drapeau `estLeJournalCasse()` sur l'écran de journal — ADR-012 décision 4,
 * issue #171.
 *
 * `flush()` ne peut pas journaliser son propre échec sous peine de récursion
 * sur un appareil déjà en difficulté (le `catch` vide de `logger.ts` est
 * délibéré). Le seul canal restant est donc cet écran : sans lui, le drapeau
 * est levé et personne ne le voit — un silence de plus, précisément la famille
 * que cet ADR éradique.
 */
import { Alert } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import DebugLogsScreen from '@/app/(app)/debug-logs';
import * as logger from '@/lib/logger';
import { useRequestLogStore } from '@/lib/request-log-store';
import { useDebugStore } from '@/lib/debug-store';

jest.mock('expo-router', () => require('../test-utils/mock-expo-router').expoRouterMock());

jest.mock('expo-file-system', () => ({ File: class {}, Paths: { cache: '' } }));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn() }));
jest.mock('@/lib/journal-db', () => ({ viderJournal: jest.fn().mockResolvedValue(undefined) }));

const AVERTISSEMENT = /journal n’a pas pu être enregistré/i;

describe('DebugLogsScreen — le drapeau du journal cassé', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('avertit quand le flush a échoué', async () => {
    jest.spyOn(logger, 'estLeJournalCasse').mockReturnValue(true);

    await render(<DebugLogsScreen />);

    expect(await screen.findByText(AVERTISSEMENT)).toBeTruthy();
  });

  it('ne dit rien quand le journal écrit normalement', async () => {
    jest.spyOn(logger, 'estLeJournalCasse').mockReturnValue(false);

    await render(<DebugLogsScreen />);

    expect(screen.queryByText(AVERTISSEMENT)).toBeNull();
  });
});

describe('le flag debug ne gate plus aucune écriture — ADR-012 décision 4', () => {
  it('enregistre une requête même mode debug éteint', () => {
    // Gater ici, c'était exiger de l'agent qu'il active l'interrupteur AVANT
    // le bug — une dépendance temporelle impossible à satisfaire.
    useDebugStore.setState({ enabled: false });
    useRequestLogStore.setState({ entries: [] });

    useRequestLogStore.getState().addEntry({
      method: 'GET',
      url: '/x',
      status: 500,
      ok: false,
      durationMs: 12,
      startedAt: new Date().toISOString(),
    });

    expect(useRequestLogStore.getState().entries).toHaveLength(1);
  });

  it('n’annonce plus que rien ne sera enregistré', async () => {
    useDebugStore.setState({ enabled: false });

    await render(<DebugLogsScreen />);

    expect(screen.queryByText(/aucune nouvelle requête ne sera enregistrée/i)).toBeNull();
    expect(screen.getByText(/conservés moins longtemps/i)).toBeTruthy();
  });
});

describe('« Vider » efface aussi la table durable', () => {
  it('appelle `viderJournal`, sinon le bouton mentirait', async () => {
    const { viderJournal } = jest.requireMock('@/lib/journal-db');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, boutons) => {
      boutons?.find((b) => b.text === 'Vider')?.onPress?.();
    });

    await render(<DebugLogsScreen />);
    fireEvent.press(screen.getByText('Vider'));

    // Les deux stores sont en mémoire ; la table `journal`, elle, survivrait.
    expect(viderJournal).toHaveBeenCalled();
    alert.mockRestore();
  });
});
