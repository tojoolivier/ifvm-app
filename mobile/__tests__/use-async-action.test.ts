import { executeAsyncAction } from '../src/hooks/use-async-action';

jest.mock('@/lib/storage', () => ({
  storage: { getItem: jest.fn(), setItem: jest.fn(), deleteItem: jest.fn() },
}));

function makeDeps() {
  return { showError: jest.fn(), logError: jest.fn() };
}

describe('executeAsyncAction', () => {
  it('runs the action and shows no error on success', async () => {
    const deps = makeDeps();
    const action = jest.fn().mockResolvedValue(undefined);

    await executeAsyncAction(action, { screen: 'test' }, deps);

    expect(action).toHaveBeenCalledTimes(1);
    expect(deps.showError).not.toHaveBeenCalled();
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
    expect(deps.showError).toHaveBeenCalledWith({ message: 'draftId manquant' });
    expect(deps.logError).toHaveBeenCalledWith({
      message: 'draftId manquant',
      screen: 'accouplement',
      context: null,
    });
  });

  it('falls back to a generic message when precondition is false without preconditionMessage', async () => {
    const deps = makeDeps();

    await executeAsyncAction(jest.fn(), { screen: 'density', precondition: false }, deps);

    expect(deps.showError).toHaveBeenCalledWith({ message: 'Action impossible : données manquantes.' });
  });

  it('catches a thrown error, maps it to a friendly message, and logs the stack + context', async () => {
    const deps = makeDeps();
    const error = new Error('SQLITE_CONSTRAINT: NOT NULL constraint failed');
    const action = jest.fn().mockRejectedValue(error);

    await executeAsyncAction(action, { screen: 'density', context: { draftId: 'abc' } }, deps);

    expect(deps.showError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Impossible d’enregistrer ces données sur l’appareil.' })
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

    const retry = deps.showError.mock.calls[0][0].retry;
    expect(retry).toBeInstanceOf(Function);

    retry();
    await Promise.resolve();

    expect(action).toHaveBeenCalledTimes(2);
  });
});
