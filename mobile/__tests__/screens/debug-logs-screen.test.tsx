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
import { render, screen } from '@testing-library/react-native';
import DebugLogsScreen from '@/app/(app)/debug-logs';
import * as logger from '@/lib/logger';

jest.mock('expo-router', () => require('../test-utils/mock-expo-router').expoRouterMock());

jest.mock('expo-file-system', () => ({ File: class {}, Paths: { cache: '' } }));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn() }));

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
