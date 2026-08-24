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

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  apiClient,
  isTokenExpired,
  refreshAccessTokenSingleFlight,
  statutHttpDe,
} from '../src/lib/api-client';
import {
  AuthError,
  NetworkError,
} from '../src/lib/errors';

const mockFetch = jest.fn();

global.fetch =
  mockFetch as unknown as typeof fetch;

function mockJsonResponse(
  overrides: {
    ok: boolean;
    status?: number;
    json: () => Promise<unknown>;
  }
) {
  return {
    ok: overrides.ok,
    status: overrides.status ?? (
      overrides.ok ? 200 : 500
    ),
    json: overrides.json,
    clone() {
      return {
        text: async () => {
          try {
            return JSON.stringify(
              await overrides.json()
            );
          } catch {
            return '';
          }
        },
      };
    },
  };
}

/**
 * Génère un JWT suffisamment réaliste pour les tests.
 *
 * On ne vérifie pas la signature ici :
 * le client ne fait qu'inspecter `exp`.
 */
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
  ) =>
    Buffer.from(
      JSON.stringify(value)
    ).toString('base64url');

  return [
    encode(header),
    encode(payload),
    'test-signature',
  ].join('.');
}

const originalEnv = process.env;

beforeEach(() => {
  jest.clearAllMocks();

  process.env = {
    ...originalEnv,
    EXPO_PUBLIC_API_URL:
      'http://test-api.com',
  };

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

afterEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  process.env = originalEnv;
});

describe('API Client', () => {
  describe('JWT expiration', () => {
    it('detects a valid non-expired JWT', () => {
      const token =
        createJwt(
          Math.floor(
            Date.now() / 1000
          ) + 3600
        );

      expect(
        isTokenExpired(token)
      ).toBe(false);
    });

    it('detects an expired JWT', () => {
      const token =
        createJwt(
          Math.floor(
            Date.now() / 1000
          ) - 60
        );

      expect(
        isTokenExpired(token)
      ).toBe(true);
    });

    it('treats malformed JWT as expired', () => {
      expect(
        isTokenExpired(
          'invalid-token'
        )
      ).toBe(true);
    });
  });

  describe('Authorization header', () => {
    it('should send Authorization header on authenticated requests', async () => {
      const token =
        createJwt(
          Math.floor(
            Date.now() / 1000
          ) + 3600
        );

      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({
          ok: true,
          status: 200,
          json: async () => ({
            id: 'user-1',
            nom: 'Dupont',
            prenom: 'Alice',
            email: 'alice@test.com',
            role: 'prospecteur',
            actif: true,
            created_at:
              '2026-01-01T00:00:00Z',
          }),
        })
      );

      await apiClient.getProfile(
        token
      );

      expect(
        mockFetch
      ).toHaveBeenCalledWith(
        'http://test-api.com/users/me',
        expect.objectContaining({
          headers:
            expect.objectContaining({
              Authorization:
                `Bearer ${token}`,
            }),
        })
      );
    });

    it('should not send Authorization header on login', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({
          ok: true,
          status: 200,
          json: async () => ({
            access_token:
              'token',
            refresh_token:
              'refresh-token',
          }),
        })
      );

      await apiClient.login({
        email: 'user@test.com',
        password: 'pass',
      });

      expect(
        mockFetch
      ).toHaveBeenCalledWith(
        'http://test-api.com/auth/login',
        expect.objectContaining({
          headers:
            expect.not.objectContaining({
              Authorization:
                expect.any(String),
            }),
        })
      );
    });
  });

  describe('Expired token handling', () => {
    it('refreshes an expired token before making the request', async () => {
      const expiredToken =
        createJwt(
          Math.floor(
            Date.now() / 1000
          ) - 60
        );

      const refreshedToken =
        createJwt(
          Math.floor(
            Date.now() / 1000
          ) + 3600
        );

      mockFetch
        .mockResolvedValueOnce(
          mockJsonResponse({
            ok: true,
            status: 200,
            json: async () => ({
              access_token:
                refreshedToken,
            }),
          })
        )
        .mockResolvedValueOnce(
          mockJsonResponse({
            ok: true,
            status: 200,
            json: async () => ({
              id: 'user-1',
              nom: 'Dupont',
              prenom: 'Alice',
              email:
                'alice@test.com',
              role: 'prospecteur',
              actif: true,
              created_at:
                '2026-01-01T00:00:00Z',
            }),
          })
        );

      await apiClient.getProfile(
        expiredToken
      );

      expect(
        mockFetch
      ).toHaveBeenCalledTimes(2);

      expect(
        mockFetch
      ).toHaveBeenNthCalledWith(
        1,
        'http://test-api.com/auth/refresh',
        expect.objectContaining({
          method: 'POST',
        })
      );

      expect(
        mockFetch
      ).toHaveBeenNthCalledWith(
        2,
        'http://test-api.com/users/me',
        expect.objectContaining({
          headers:
            expect.objectContaining({
              Authorization:
                `Bearer ${refreshedToken}`,
            }),
        })
      );
    });

    it('calls onUnauthorized when refresh fails for an expired token', async () => {
      const expiredToken =
        createJwt(
          Math.floor(
            Date.now() / 1000
          ) - 60
        );

      const onUnauthorized =
        jest.fn();

      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({
          ok: false,
          status: 401,
          json: async () => ({
            detail:
              'Invalid refresh token',
          }),
        })
      );

      await expect(
        apiClient.getProfile(
          expiredToken,
          onUnauthorized
        )
      ).rejects.toMatchObject({
        status: 401,
      });

      expect(
        onUnauthorized
      ).toHaveBeenCalledTimes(1);
    });
  });

  describe('401 handling', () => {
    it('refreshes and retries once after a 401', async () => {
      const token =
        createJwt(
          Math.floor(
            Date.now() / 1000
          ) + 3600
        );

      const refreshedToken =
        createJwt(
          Math.floor(
            Date.now() / 1000
          ) + 7200
        );

      mockFetch
        .mockResolvedValueOnce(
          mockJsonResponse({
            ok: false,
            status: 401,
            json: async () => ({
              detail:
                'Unauthorized',
            }),
          })
        )
        .mockResolvedValueOnce(
          mockJsonResponse({
            ok: true,
            status: 200,
            json: async () => ({
              access_token:
                refreshedToken,
            }),
          })
        )
        .mockResolvedValueOnce(
          mockJsonResponse({
            ok: true,
            status: 200,
            json: async () => ({
              id: 'user-1',
              nom: 'Dupont',
              prenom: 'Alice',
              email:
                'alice@test.com',
              role: 'prospecteur',
              actif: true,
              created_at:
                '2026-01-01T00:00:00Z',
            }),
          })
        );

      await apiClient.getProfile(
        token
      );

      expect(
        mockFetch
      ).toHaveBeenCalledTimes(3);

      expect(
        mockFetch
      ).toHaveBeenNthCalledWith(
        1,
        'http://test-api.com/users/me',
        expect.objectContaining({
          headers:
            expect.objectContaining({
              Authorization:
                `Bearer ${token}`,
            }),
        })
      );

      expect(
        mockFetch
      ).toHaveBeenNthCalledWith(
        2,
        'http://test-api.com/auth/refresh',
        expect.objectContaining({
          method: 'POST',
        })
      );

      expect(
        mockFetch
      ).toHaveBeenNthCalledWith(
        3,
        'http://test-api.com/users/me',
        expect.objectContaining({
          headers:
            expect.objectContaining({
              Authorization:
                `Bearer ${refreshedToken}`,
            }),
        })
      );
    });

    it('calls onUnauthorized when refresh after 401 fails', async () => {
      const token =
        createJwt(
          Math.floor(
            Date.now() / 1000
          ) + 3600
        );

      const onUnauthorized =
        jest.fn();

      mockFetch
        .mockResolvedValueOnce(
          mockJsonResponse({
            ok: false,
            status: 401,
            json: async () => ({
              detail:
                'Unauthorized',
            }),
          })
        )
        .mockResolvedValueOnce(
          mockJsonResponse({
            ok: false,
            status: 401,
            json: async () => ({
              detail:
                'Invalid refresh token',
            }),
          })
        );

      await expect(
        apiClient.getProfile(
          token,
          onUnauthorized
        )
      ).rejects.toMatchObject({
        status: 401,
      });

      expect(
        onUnauthorized
      ).toHaveBeenCalledTimes(1);
    });

    it('does not trigger onUnauthorized on non-401 errors', async () => {
      const onUnauthorized =
        jest.fn();

      const token =
        createJwt(
          Math.floor(
            Date.now() / 1000
          ) + 3600
        );

      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({
          ok: false,
          status: 500,
          json: async () => ({
            detail:
              'Server error',
          }),
        })
      );

      await expect(
        apiClient.getProfile(
          token,
          onUnauthorized
        )
      ).rejects.toMatchObject({
        status: 500,
      });

      expect(
        onUnauthorized
      ).not.toHaveBeenCalled();
    });
  });

  describe('Refresh single-flight', () => {
    it('performs only one refresh when two refresh calls happen concurrently', async () => {
      const refreshedToken =
        createJwt(
          Math.floor(
            Date.now() / 1000
          ) + 3600
        );

      let resolveRefresh:
        (value: Response) => void;

      const refreshResponsePromise =
        new Promise<Response>(
          (resolve) => {
            resolveRefresh =
              resolve;
          }
        );

      mockFetch.mockImplementation(
        async (
          url: string
        ) => {
          if (
            url ===
            'http://test-api.com/auth/refresh'
          ) {
            return refreshResponsePromise;
          }

          return mockJsonResponse({
            ok: true,
            status: 200,
            json: async () => ({
              access_token:
                refreshedToken,
            }),
          });
        }
      );

      const firstRefresh =
        refreshAccessTokenSingleFlight();

      const secondRefresh =
        refreshAccessTokenSingleFlight();

      await Promise.resolve();

      expect(
        mockFetch
      ).toHaveBeenCalledTimes(1);

      resolveRefresh!(
        mockJsonResponse({
          ok: true,
          status: 200,
          json: async () => ({
            access_token:
              refreshedToken,
          }),
        }) as unknown as Response
      );

      const [
        firstResult,
        secondResult,
      ] = await Promise.all([
        firstRefresh,
        secondRefresh,
      ]);

      expect(
        firstResult
      ).toBe(refreshedToken);

      expect(
        secondResult
      ).toBe(refreshedToken);

      expect(
        mockFetch
      ).toHaveBeenCalledTimes(1);
    });

    it('performs only one refresh when two requests receive 401 concurrently', async () => {
      const token =
        createJwt(
          Math.floor(
            Date.now() / 1000
          ) + 3600
        );

      const refreshedToken =
        createJwt(
          Math.floor(
            Date.now() / 1000
          ) + 3600
        );

      let refreshResolver:
        | ((value: unknown) => void)
        | undefined;

      const refreshPromise =
        new Promise<unknown>(
          (resolve) => {
            refreshResolver =
              resolve;
          }
        );

      mockFetch.mockImplementation(
        async (
          url: string
        ) => {
          if (
            url ===
            'http://test-api.com/auth/refresh'
          ) {
            return refreshPromise;
          }

          if (
            url ===
            'http://test-api.com/users/me'
          ) {
            return mockJsonResponse({
              ok: false,
              status: 401,
              json: async () => ({
                detail:
                  'Unauthorized',
              }),
            });
          }

          return mockJsonResponse({
            ok: true,
            status: 200,
            json: async () => ({
              id: 'user-1',
            }),
          });
        }
      );

      const request1 =
        apiClient.getProfile(
          token
        );

      const request2 =
        apiClient.getProfile(
          token
        );

      await Promise.resolve();
      await Promise.resolve();

      expect(
        mockFetch.mock.calls.filter(
          (call) =>
            call[0] ===
            'http://test-api.com/auth/refresh'
        )
      ).toHaveLength(1);

      refreshResolver!(
        mockJsonResponse({
          ok: true,
          status: 200,
          json: async () => ({
            access_token:
              refreshedToken,
          }),
        })
      );

      /**
       * Après le refresh, les retries doivent réussir.
       *
       * On remplace le comportement du endpoint
       * /users/me pour les retries.
       */
      mockFetch.mockImplementation(
        async (
          url: string,
          options?: RequestInit
        ) => {
          if (
            url ===
            'http://test-api.com/auth/refresh'
          ) {
            return mockJsonResponse({
              ok: true,
              status: 200,
              json: async () => ({
                access_token:
                  refreshedToken,
              }),
            });
          }

          const authorization =
            (
              options?.headers as Record<
                string,
                string
              >
            )?.Authorization;

          if (
            authorization ===
            `Bearer ${refreshedToken}`
          ) {
            return mockJsonResponse({
              ok: true,
              status: 200,
              json: async () => ({
                id: 'user-1',
                nom: 'Dupont',
                prenom: 'Alice',
                email:
                  'alice@test.com',
                role: 'prospecteur',
                actif: true,
                created_at:
                  '2026-01-01T00:00:00Z',
              }),
            });
          }

          return mockJsonResponse({
            ok: false,
            status: 401,
            json: async () => ({
              detail:
                'Unauthorized',
            }),
          });
        }
      );

      await Promise.all([
        request1,
        request2,
      ]);

      const refreshCalls =
        mockFetch.mock.calls.filter(
          (call) =>
            call[0] ===
            'http://test-api.com/auth/refresh'
        );

      expect(
        refreshCalls
      ).toHaveLength(1);
    });
  });

  describe('Error message extraction', () => {
    it('surfaces a plain string detail', async () => {
      const token =
        createJwt(
          Math.floor(
            Date.now() / 1000
          ) + 3600
        );

      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({
          ok: false,
          status: 403,
          json: async () => ({
            detail:
              'Seules les fiches brouillon peuvent être supprimées',
          }),
        })
      );

      await expect(
        apiClient.getProfile(token)
      ).rejects.toThrow(
        'Seules les fiches brouillon peuvent être supprimées'
      );
    });

    it('surfaces FastAPI validation errors', async () => {
      const token =
        createJwt(
          Math.floor(
            Date.now() / 1000
          ) + 3600
        );

      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({
          ok: false,
          status: 422,
          json: async () => ({
            detail: [
              {
                loc: [
                  'body',
                  'campagne_id',
                ],
                msg:
                  'field required',
                type:
                  'value_error.missing',
              },
              {
                loc: [
                  'body',
                  'date_prospection',
                ],
                msg:
                  'invalid date format',
                type:
                  'value_error',
              },
            ],
          }),
        })
      );

      await expect(
        apiClient.getProfile(token)
      ).rejects.toThrow(
        'campagne_id: field required; date_prospection: invalid date format'
      );
    });

    it('falls back to HTTP status', async () => {
      const token =
        createJwt(
          Math.floor(
            Date.now() / 1000
          ) + 3600
        );

      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({
          ok: false,
          status: 500,
          json: async () => ({}),
        })
      );

      await expect(
        apiClient.getProfile(token)
      ).rejects.toThrow(
        'HTTP error! status: 500'
      );
    });
  });

  describe('Base URL configuration', () => {
    it('uses EXPO_PUBLIC_API_URL', async () => {
      process.env.EXPO_PUBLIC_API_URL =
        'http://custom-api.com';

      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({
          ok: true,
          status: 200,
          json: async () => ({
            access_token:
              'token',
            refresh_token:
              'refresh',
          }),
        })
      );

      await apiClient.login({
        email: 'user@test.com',
        password: 'pass',
      });

      expect(
        mockFetch
      ).toHaveBeenCalledWith(
        'http://custom-api.com/auth/login',
        expect.any(Object)
      );
    });

    it('defaults to localhost:8000', async () => {
      delete process.env
        .EXPO_PUBLIC_API_URL;

      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({
          ok: true,
          status: 200,
          json: async () => ({
            access_token:
              'token',
            refresh_token:
              'refresh',
          }),
        })
      );

      await apiClient.login({
        email: 'user@test.com',
        password: 'pass',
      });

      expect(
        mockFetch
      ).toHaveBeenCalledWith(
        'http://localhost:8000/auth/login',
        expect.any(Object)
      );
    });
  });

  describe('Endpoints', () => {
    it('login should POST to /auth/login', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({
          ok: true,
          status: 200,
          json: async () => ({
            access_token:
              'token',
            refresh_token:
              'refresh',
          }),
        })
      );

      await apiClient.login({
        email: 'user@test.com',
        password: 'pass',
      });

      expect(
        mockFetch
      ).toHaveBeenCalledWith(
        'http://test-api.com/auth/login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            email: 'user@test.com',
            password: 'pass',
          }),
        })
      );
    });

    it('getPostes should GET /geo/postes', async () => {
      const token =
        createJwt(
          Math.floor(
            Date.now() / 1000
          ) + 3600
        );

      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({
          ok: true,
          status: 200,
          json: async () => [
            {
              id: 1,
              name: 'Poste 1',
            },
          ],
        })
      );

      await apiClient.getPostes(
        token
      );

      expect(
        mockFetch
      ).toHaveBeenCalledWith(
        'http://test-api.com/geo/postes',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('getStations should GET /geo/stations', async () => {
      const token =
        createJwt(
          Math.floor(
            Date.now() / 1000
          ) + 3600
        );

      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({
          ok: true,
          status: 200,
          json: async () => [
            {
              id: 1,
              name: 'Station 1',
            },
          ],
        })
      );

      await apiClient.getStations(
        token
      );

      expect(
        mockFetch
      ).toHaveBeenCalledWith(
        'http://test-api.com/geo/stations',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('getProfile should GET /users/me', async () => {
      const token =
        createJwt(
          Math.floor(
            Date.now() / 1000
          ) + 3600
        );

      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({
          ok: true,
          status: 200,
          json: async () => ({
            id:
              '550e8400-e29b-41d4-a716-446655440000',
            nom: 'Dupont',
            prenom: 'Alice',
            email:
              'alice@test.com',
            role: 'prospecteur',
            actif: true,
            created_at:
              '2026-01-01T00:00:00Z',
          }),
        })
      );

      await apiClient.getProfile(
        token
      );

      expect(
        mockFetch
      ).toHaveBeenCalledWith(
        'http://test-api.com/users/me',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('deleteProspection should DELETE /prospections/{id}', async () => {
      const token =
        createJwt(
          Math.floor(
            Date.now() / 1000
          ) + 3600
        );

      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({
          ok: true,
          status: 204,
          json: async () => {
            throw new Error(
              'no body'
            );
          },
        })
      );

      await apiClient.deleteProspection(
        token,
        'fiche-1'
      );

      expect(
        mockFetch
      ).toHaveBeenCalledWith(
        'http://test-api.com/prospections/fiche-1',
        expect.objectContaining({
          method: 'DELETE',
          headers:
            expect.objectContaining({
              Authorization:
                `Bearer ${token}`,
            }),
        })
      );
    });
  });

  describe('syncTraitement', () => {
    it('POSTs to /traitements/sync', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({
          ok: true,
          status: 201,
          json: async () => ({
            id: 'traitement-1',
          }),
        })
      );

      await apiClient.syncTraitement(
        'token',
        {
          id: 'traitement-1',
          type_traitement:
            'AERIEN',
        }
      );

      expect(
        mockFetch
      ).toHaveBeenCalledWith(
        'http://test-api.com/traitements/sync',
        expect.objectContaining({
          method: 'POST',
          headers:
            expect.objectContaining({
              Authorization:
                'Bearer token',
            }),
          body: JSON.stringify({
            id: 'traitement-1',
            type_traitement:
              'AERIEN',
          }),
        })
      );
    });

    it('resolves on 201', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({
          ok: true,
          status: 201,
          json: async () => ({
            id: 'traitement-1',
            statut: 'brouillon',
          }),
        })
      );

      const result =
        await apiClient.syncTraitement(
          'token',
          {
            id: 'traitement-1',
          }
        );

      expect(result).toEqual({
        status: 201,
        body: {
          id: 'traitement-1',
          statut: 'brouillon',
        },
      });
    });

    it('resolves on 200', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({
          ok: true,
          status: 200,
          json: async () => ({
            id: 'traitement-1',
          }),
        })
      );

      const result =
        await apiClient.syncTraitement(
          'token',
          {
            id: 'traitement-1',
          }
        );

      expect(result).toEqual({
        status: 200,
        body: {
          id: 'traitement-1',
        },
      });
    });

    it('resolves on 409 conflict', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({
          ok: false,
          status: 409,
          json: async () => ({
            id: 'traitement-1',
            statut: 'validee',
          }),
        })
      );

      const result =
        await apiClient.syncTraitement(
          'token',
          {
            id: 'traitement-1',
          }
        );

      expect(result).toEqual({
        status: 409,
        body: {
          id: 'traitement-1',
          statut: 'validee',
        },
      });
    });

    it('throws on 422', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({
          ok: false,
          status: 422,
          json: async () => ({
            detail:
              'Champ invalide',
          }),
        })
      );

      await expect(
        apiClient.syncTraitement(
          'token',
          {
            id: 'traitement-1',
          }
        )
      ).rejects.toThrow(
        'Champ invalide'
      );
    });

    it('throws on 5xx', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({
          ok: false,
          status: 500,
          json: async () => ({
            detail:
              'Erreur serveur',
          }),
        })
      );

      await expect(
        apiClient.syncTraitement(
          'token',
          {
            id: 'traitement-1',
          }
        )
      ).rejects.toThrow();
    });

    it('throws on network failure', async () => {
      mockFetch.mockRejectedValueOnce(
        new Error(
          'Network request failed'
        )
      );

      // Le message brut du moteur ne sort plus : ce qui compte est la classe,
      // parce que c'est elle qui décide du message et de l'action montrés à
      // l'agent (ADR-012 décisions 2 et 5).
      await expect(
        apiClient.syncTraitement(
          'token',
          {
            id: 'traitement-1',
          }
        )
      ).rejects.toBeInstanceOf(
        NetworkError
      );
    });
  });

  /*
   * Ces trois tests protègent la décision 2 d'ADR-012, pas un comportement :
   * `ApiError` a disparu et tout échec sorti d'api-client appartient au jeu
   * fermé. Les défaire rendrait `(bug)` à la couche d'affichage, qui
   * proposerait « Signaler au support » sur une simple panne serveur.
   */
  describe('Typage à la source (#173)', () => {
    it('lève AuthError, statut 401, quand le refresh est impossible', async () => {
      const token = createJwt(
        Math.floor(Date.now() / 1000) +
          3600
      );

      mockFetch
        .mockResolvedValueOnce(
          mockJsonResponse({
            ok: false,
            status: 401,
            json: async () => ({
              detail: 'Unauthorized',
            }),
          })
        )
        .mockResolvedValueOnce(
          mockJsonResponse({
            ok: false,
            status: 401,
            json: async () => ({
              detail:
                'Invalid refresh token',
            }),
          })
        );

      const erreur = await apiClient
        .getProfile(token)
        .catch(
          (e: unknown) => e
        );

      expect(erreur).toBeInstanceOf(
        AuthError
      );
      expect(
        statutHttpDe(erreur)
      ).toBe(401);
    });

    it('lève NetworkError, statut conservé, sur une erreur HTTP hors 401', async () => {
      const token = createJwt(
        Math.floor(Date.now() / 1000) +
          3600
      );

      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({
          ok: false,
          status: 500,
          json: async () => ({
            detail: 'Server error',
          }),
        })
      );

      const erreur = await apiClient
        .getProfile(token)
        .catch(
          (e: unknown) => e
        );

      expect(erreur).toBeInstanceOf(
        NetworkError
      );
      expect(
        statutHttpDe(erreur)
      ).toBe(500);
    });

    it('lève NetworkError quand fetch lui-même échoue', async () => {
      const token = createJwt(
        Math.floor(Date.now() / 1000) +
          3600
      );

      mockFetch.mockRejectedValueOnce(
        new Error(
          'Network request failed'
        )
      );

      const erreur = await apiClient
        .getProfile(token)
        .catch(
          (e: unknown) => e
        );

      expect(erreur).toBeInstanceOf(
        NetworkError
      );
      // Pas de statut : il n'y a jamais eu de réponse HTTP.
      expect(
        statutHttpDe(erreur)
      ).toBeNull();
    });
  });
});