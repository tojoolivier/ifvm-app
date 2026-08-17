jest.mock(
  '@react-native-async-storage/async-storage',
  () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  })
);

jest.mock(
  '../src/lib/request-log-store',
  () => ({
    useRequestLogStore: {
      getState: () => ({
        addEntry: jest.fn(),
      }),
    },
  })
);

jest.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(() => ({
      remove: jest.fn(),
    })),
  },
}));

jest.mock('../src/lib/api-client', () => ({
  apiClient: {
    pullReferentiel: jest.fn(),
  },

  refreshAccessTokenSingleFlight: jest.fn(),
}));

jest.mock('../src/lib/auth-store', () => ({
  useAuthStore: {
    getState: jest.fn(() => ({
      refreshToken: jest.fn(),
      logout: jest.fn(),
      token: null,
    })),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  shouldTriggerAutoSync,
  isTokenExpiringSoon,
  refreshTokenForAutoSync,
} from '../src/lib/referentiel-auto-sync';

import {
  refreshAccessTokenSingleFlight,
} from '../src/lib/api-client';

const mockRefreshAccessTokenSingleFlight =
  refreshAccessTokenSingleFlight as jest.MockedFunction<
    typeof refreshAccessTokenSingleFlight
  >;

function createJwt(
  expSeconds: number
): string {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const payload = {
    sub: 'test-user',
    exp: expSeconds,
  };

  const encode = (
    value: unknown
  ): string =>
    Buffer.from(
      JSON.stringify(value)
    ).toString('base64url');

  return [
    encode(header),
    encode(payload),
    'test-signature',
  ].join('.');
}

beforeEach(() => {
  jest.clearAllMocks();

  mockRefreshAccessTokenSingleFlight.mockReset();

  (
    AsyncStorage.getItem as jest.Mock
  ).mockResolvedValue(
    'refresh-token-test'
  );

  (
    AsyncStorage.setItem as jest.Mock
  ).mockResolvedValue(
    undefined
  );
});

describe('shouldTriggerAutoSync', () => {
  it('triggers when connectivity returns after being offline', () => {
    expect(
      shouldTriggerAutoSync({
        wasConnected: false,
        isConnected: true,
      })
    ).toBe(true);
  });

  it('does not trigger when already connected', () => {
    expect(
      shouldTriggerAutoSync({
        wasConnected: true,
        isConnected: true,
      })
    ).toBe(false);
  });

  it('does not trigger when going offline', () => {
    expect(
      shouldTriggerAutoSync({
        wasConnected: true,
        isConnected: false,
      })
    ).toBe(false);
  });

  it('does not trigger when remaining offline', () => {
    expect(
      shouldTriggerAutoSync({
        wasConnected: false,
        isConnected: false,
      })
    ).toBe(false);
  });

  it('triggers on first known state if already connected', () => {
    expect(
      shouldTriggerAutoSync({
        wasConnected: null,
        isConnected: true,
      })
    ).toBe(true);
  });

  it('does not trigger on first known state if offline', () => {
    expect(
      shouldTriggerAutoSync({
        wasConnected: null,
        isConnected: false,
      })
    ).toBe(false);
  });
});

describe('isTokenExpiringSoon', () => {
  it('returns false for a token expiring in more than 5 minutes', async () => {
    const token =
      createJwt(
        Math.floor(
          Date.now() / 1000
        ) + 3600
      );

    await expect(
      isTokenExpiringSoon(token)
    ).resolves.toBe(false);
  });

  it('returns true for a token expiring in less than 5 minutes', async () => {
    const token =
      createJwt(
        Math.floor(
          Date.now() / 1000
        ) + 60
      );

    await expect(
      isTokenExpiringSoon(token)
    ).resolves.toBe(true);
  });

  it('returns true for an expired token', async () => {
    const token =
      createJwt(
        Math.floor(
          Date.now() / 1000
        ) - 60
      );

    await expect(
      isTokenExpiringSoon(token)
    ).resolves.toBe(true);
  });

  it('returns true for a malformed token', async () => {
    await expect(
      isTokenExpiringSoon(
        'invalid-token'
      )
    ).resolves.toBe(true);
  });
});

describe('referentiel auto-sync refresh', () => {
  it('uses the shared single-flight refresh mechanism', async () => {
    const refreshedToken =
      createJwt(
        Math.floor(
          Date.now() / 1000
        ) + 3600
      );

    mockRefreshAccessTokenSingleFlight.mockResolvedValueOnce(
      refreshedToken
    );

    const token =
      await refreshTokenForAutoSync();

    expect(
      mockRefreshAccessTokenSingleFlight
    ).toHaveBeenCalledTimes(1);

    expect(token).toBe(
      refreshedToken
    );
  });

  it('calls the same shared refresh mechanism for concurrent auto-sync refreshes', async () => {
    const refreshedToken =
      createJwt(
        Math.floor(
          Date.now() / 1000
        ) + 3600
      );

    let resolveRefresh:
      | ((value: string) => void)
      | undefined;

    const refreshPromise =
      new Promise<string>(
        (resolve) => {
          resolveRefresh =
            resolve;
        }
      );

    mockRefreshAccessTokenSingleFlight.mockReturnValue(
      refreshPromise
    );

    const refresh1 =
      refreshTokenForAutoSync();

    const refresh2 =
      refreshTokenForAutoSync();

    expect(
      mockRefreshAccessTokenSingleFlight
    ).toHaveBeenCalledTimes(2);

    resolveRefresh!(
      refreshedToken
    );

    const [
      result1,
      result2,
    ] = await Promise.all([
      refresh1,
      refresh2,
    ]);

    expect(result1).toBe(
      refreshedToken
    );

    expect(result2).toBe(
      refreshedToken
    );

    expect(
      mockRefreshAccessTokenSingleFlight
    ).toHaveBeenCalledTimes(2);
  });

  it('returns null when the shared refresh mechanism fails', async () => {
    mockRefreshAccessTokenSingleFlight.mockResolvedValueOnce(
      null
    );

    await expect(
      refreshTokenForAutoSync()
    ).resolves.toBeNull();

    expect(
      mockRefreshAccessTokenSingleFlight
    ).toHaveBeenCalledTimes(1);
  });

  it('propagates a refresh error from the shared mechanism', async () => {
    const refreshError =
      new Error(
        'Refresh failed'
      );

    mockRefreshAccessTokenSingleFlight.mockRejectedValueOnce(
      refreshError
    );

    await expect(
      refreshTokenForAutoSync()
    ).rejects.toThrow(
      'Refresh failed'
    );

    expect(
      mockRefreshAccessTokenSingleFlight
    ).toHaveBeenCalledTimes(1);
  });
});

describe('shared refresh mechanism', () => {
  it('exports the shared refresh function from api-client', () => {
    expect(
      refreshAccessTokenSingleFlight
    ).toBeDefined();

    expect(
      typeof refreshAccessTokenSingleFlight
    ).toBe('function');
  });

  it('refreshTokenForAutoSync delegates to the shared function', async () => {
    const refreshedToken =
      createJwt(
        Math.floor(
          Date.now() / 1000
        ) + 3600
      );

    mockRefreshAccessTokenSingleFlight.mockResolvedValueOnce(
      refreshedToken
    );

    const result =
      await refreshTokenForAutoSync();

    expect(
      mockRefreshAccessTokenSingleFlight
    ).toHaveBeenCalledTimes(1);

    expect(result).toBe(
      refreshedToken
    );
  });

  it('does not implement a separate refresh mechanism', async () => {
    const refreshedToken =
      createJwt(
        Math.floor(
          Date.now() / 1000
        ) + 3600
      );

    mockRefreshAccessTokenSingleFlight.mockResolvedValueOnce(
      refreshedToken
    );

    await refreshTokenForAutoSync();

    expect(
      mockRefreshAccessTokenSingleFlight
    ).toHaveBeenCalledTimes(1);
  });
});