import { getCurrentPosition } from '../src/lib/location';
import { PermissionError, PreconditionError } from '../src/lib/errors';
import { PRECISION_GPS_CIBLE_M } from '../src/lib/gps-precision';

const requestForegroundPermissionsAsync = jest.fn();
const watchPositionAsync = jest.fn();
const remove = jest.fn();

/** Fixes successifs poussés par le mock de `watchPositionAsync`. */
let emit: (fix: { accuracy: number | null; timestamp?: number }) => void = () => {};

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3, High: 4, Highest: 5, BestForNavigation: 6 },
  requestForegroundPermissionsAsync: (...args: unknown[]) =>
    requestForegroundPermissionsAsync(...args),
  watchPositionAsync: (...args: unknown[]) => watchPositionAsync(...args),
}));

beforeEach(() => {
  jest.useFakeTimers();
  requestForegroundPermissionsAsync.mockReset().mockResolvedValue({ status: 'granted' });
  remove.mockReset();
  watchPositionAsync.mockReset().mockImplementation(async (_options, callback) => {
    emit = ({ accuracy, timestamp = 1_756_123_456_000 }) =>
      callback({
        coords: { latitude: -18.9, longitude: 47.5, altitude: 1280, accuracy },
        timestamp,
      });
    return { remove };
  });
});

afterEach(() => {
  jest.useRealTimers();
});

/** Laisse la micro-tâche `watchPositionAsync` s'installer avant d'émettre un fix. */
async function abonnementInstalle() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('getCurrentPosition', () => {
  it('demande un fix GNSS (High) et non le mode Balanced par défaut d\'expo-location', async () => {
    const promise = getCurrentPosition();
    await abonnementInstalle();
    emit({ accuracy: 8 });
    await promise;

    expect(watchPositionAsync).toHaveBeenCalledWith(
      expect.objectContaining({ accuracy: 4 }),
      expect.any(Function)
    );
  });

  it('résout dès que la précision cible est atteinte, puis coupe l\'abonnement', async () => {
    const promise = getCurrentPosition();
    await abonnementInstalle();
    emit({ accuracy: PRECISION_GPS_CIBLE_M });

    const position = await promise;

    expect(position).toEqual({
      latitude: -18.9,
      longitude: 47.5,
      altitude: 1280,
      accuracy: PRECISION_GPS_CIBLE_M,
      timestamp: 1_756_123_456_000,
    });
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('ignore les premiers fix imprécis au lieu de renvoyer le fix de convergence', async () => {
    const promise = getCurrentPosition();
    await abonnementInstalle();
    emit({ accuracy: 480 });
    emit({ accuracy: 120 });
    emit({ accuracy: 9 });

    const position = await promise;

    expect(position.accuracy).toBe(9);
  });

  it('renvoie le meilleur fix obtenu quand le délai expire sans atteindre la cible', async () => {
    const promise = getCurrentPosition({ timeoutMs: 20_000 });
    await abonnementInstalle();
    emit({ accuracy: 480 });
    emit({ accuracy: 60 });
    emit({ accuracy: 95 });

    jest.advanceTimersByTime(20_000);
    const position = await promise;

    expect(position.accuracy).toBe(60);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('échoue avec PreconditionError si aucun fix n\'arrive avant le délai', async () => {
    const promise = getCurrentPosition({ timeoutMs: 20_000 });
    await abonnementInstalle();

    jest.advanceTimersByTime(20_000);

    await expect(promise).rejects.toThrow(PreconditionError);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('notifie la progression pour que l\'écran affiche la précision qui descend', async () => {
    const onProgress = jest.fn();
    const promise = getCurrentPosition({ onProgress });
    await abonnementInstalle();
    emit({ accuracy: 480 });
    emit({ accuracy: 12 });
    await promise;

    expect(onProgress.mock.calls.map(([p]) => p.accuracy)).toEqual([480, 12]);
  });

  it('ne remonte pas une progression qui régresse en précision', async () => {
    const onProgress = jest.fn();
    const promise = getCurrentPosition({ onProgress, timeoutMs: 20_000 });
    await abonnementInstalle();
    emit({ accuracy: 60 });
    emit({ accuracy: 300 });

    jest.advanceTimersByTime(20_000);
    await promise;

    expect(onProgress.mock.calls.map(([p]) => p.accuracy)).toEqual([60]);
  });

  it('lève PermissionError sans jamais ouvrir d\'abonnement si la permission est refusée', async () => {
    requestForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });

    await expect(getCurrentPosition()).rejects.toThrow(PermissionError);
    expect(watchPositionAsync).not.toHaveBeenCalled();
  });
});
