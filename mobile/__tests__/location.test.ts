import { getCurrentPosition, LocationPermissionDeniedError } from '../src/lib/location';

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
  it('returns lat/lon/altitude/accuracy when permission is granted', async () => {
    requestForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });
    getCurrentPositionAsync.mockResolvedValueOnce({
      coords: { latitude: -18.9, longitude: 47.5, altitude: 1280, accuracy: 5 },
    });

    const position = await getCurrentPosition();

    expect(position).toEqual({
      latitude: -18.9,
      longitude: 47.5,
      altitude: 1280,
      accuracy: 5,
    });
  });

  it('throws LocationPermissionDeniedError when permission is denied', async () => {
    requestForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });

    await expect(getCurrentPosition()).rejects.toThrow(LocationPermissionDeniedError);
    expect(getCurrentPositionAsync).not.toHaveBeenCalled();
  });
});
