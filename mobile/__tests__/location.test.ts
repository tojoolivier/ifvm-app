import { getCurrentPosition } from '../src/lib/location';
import { PermissionError } from '../src/lib/errors';

const requestForegroundPermissionsAsync = jest.fn();
const getCurrentPositionAsync = jest.fn();

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: (...args: unknown[]) =>
    requestForegroundPermissionsAsync(...args),
  getCurrentPositionAsync: (...args: unknown[]) => getCurrentPositionAsync(...args),
}));

beforeEach(() => {
  requestForegroundPermissionsAsync.mockReset();
  getCurrentPositionAsync.mockReset();
});

describe('getCurrentPosition', () => {
  it('returns lat/lon/altitude/accuracy/timestamp when permission is granted', async () => {
    requestForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });
    getCurrentPositionAsync.mockResolvedValueOnce({
      coords: { latitude: -18.9, longitude: 47.5, altitude: 1280, accuracy: 5 },
      timestamp: 1_756_123_456_000,
    });

    const position = await getCurrentPosition();

    expect(position).toEqual({
      latitude: -18.9,
      longitude: 47.5,
      altitude: 1280,
      accuracy: 5,
      timestamp: 1_756_123_456_000,
    });
  });

  it('throws PermissionError when permission is denied', async () => {
    requestForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });

    await expect(getCurrentPosition()).rejects.toThrow(PermissionError);
    expect(getCurrentPositionAsync).not.toHaveBeenCalled();
  });
});
