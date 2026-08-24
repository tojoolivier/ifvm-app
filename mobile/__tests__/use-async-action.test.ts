import { LocalWriteError } from '@/lib/errors';
import { executeAsyncAction } from '../src/hooks/use-async-action';

jest.mock('@/lib/storage', () => ({
  storage: { getItem: jest.fn(), setItem: jest.fn(), deleteItem: jest.fn() },
}));

function makeDeps() {
  return { signaler: jest.fn().mockReturnValue('INFORMER' as const), logError: jest.fn() };
}

describe('executeAsyncAction', () => {
  it('runs the action and shows no error on success', async () => {
    const deps = makeDeps();
    const action = jest.fn().mockResolvedValue(undefined);

    await executeAsyncAction(action, { screen: 'test' }, deps);

    expect(action).toHaveBeenCalledTimes(1);
    expect(deps.signaler).not.toHaveBeenCalled();
    expect(deps.logError).not.toHaveBeenCalled();
  });

  it('shows a visible error instead of silently returning when precondition is false', async () => {
    const deps = makeDeps();
    const action = jest.fn().mockResolvedValue(undefined);

    await executeAsyncAction(
      action,
      { screen: 'accouplement', precondition: false, preconditionMessage: 'draftId manquant' },
      deps
    );

    expect(action).not.toHaveBeenCalled();
    // Depuis #172 la précondition manquante lève une `PreconditionError` —
    // seule classe dont le message est écrit au site d'appel et affiché verbatim.
    expect(deps.signaler).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'PreconditionError', message: 'draftId manquant' }),
      'useAsyncAction'
    );
    expect(deps.logError).toHaveBeenCalledWith({
      message: 'draftId manquant',
      screen: 'accouplement',
      context: null,
    });
  });

  it('falls back to a generic message when precondition is false without preconditionMessage', async () => {
    const deps = makeDeps();

    await executeAsyncAction(jest.fn(), { screen: 'density', precondition: false }, deps);

    expect(deps.signaler).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Action impossible : données manquantes.' }),
      'useAsyncAction'
    );
  });

  it('catches a thrown error, maps it to a friendly message, and logs the stack + context', async () => {
    const deps = makeDeps();
    // Typée à la source (ADR-012 décision 2) : depuis #172, `toFriendlyError`
    // décide par `instanceof` et non plus par regex sur le message SQLite —
    // une `Error` nue serait désormais classée `(bug)`, à juste titre.
    const error = new LocalWriteError('SQLITE_CONSTRAINT: NOT NULL constraint failed');
    const action = jest.fn().mockRejectedValue(error);

    await executeAsyncAction(action, { screen: 'density', context: { draftId: 'abc' } }, deps);

    // La frontière ne fabrique plus de message : elle passe l'erreur, et
    // `error-store` demande son message et son action à la classe.
    expect(deps.signaler).toHaveBeenCalledWith(error, 'useAsyncAction', expect.any(Function));
    expect(deps.logError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Impossible d’enregistrer sur l’appareil'),
      })
    );
    expect(deps.logError).toHaveBeenCalledWith(
      expect.objectContaining({
        screen: 'density',
        context: { draftId: 'abc' },
        stack: expect.any(String),
      })
    );
  });

  it('exposes a retry callback that re-runs the same action', async () => {
    const deps = makeDeps();
    const action = jest.fn().mockRejectedValueOnce(new Error('network request failed')).mockResolvedValueOnce(undefined);

    await executeAsyncAction(action, { screen: 'density' }, deps);

    const retry = deps.signaler.mock.calls[0][2];
    expect(retry).toBeInstanceOf(Function);

    retry();
    await Promise.resolve();

    expect(action).toHaveBeenCalledTimes(2);
  });
});
