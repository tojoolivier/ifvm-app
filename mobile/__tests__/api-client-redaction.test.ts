/**
 * Non-régression #161 : aucun secret ne doit atteindre le journal des requêtes.
 *
 * Le bug d'origine : `redactBody` n'était appliqué qu'à `requestBody`, si bien
 * que le corps de RÉPONSE de /auth/login — qui contient `access_token` et
 * `refresh_token` — était journalisé en clair.
 */

jest.mock(
  '@react-native-async-storage/async-storage',
  () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  })
);

const capturedEntries: Record<string, unknown>[] = [];

jest.mock(
  '../src/lib/request-log-store',
  () => ({
    useRequestLogStore: {
      getState: () => ({
        addEntry: (entry: Record<string, unknown>) => {
          capturedEntries.push(entry);
        },
      }),
    },
  })
);

import { apiClient } from '../src/lib/api-client';

const ACCESS_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.SIGNATURE_ACCESS';
const REFRESH_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIyIn0.SIGNATURE_REFRESH';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function jsonResponse(payload: unknown) {
  const body = JSON.stringify(payload);
  return {
    ok: true,
    status: 200,
    json: async () => payload,
    text: async () => body,
    clone() {
      return this;
    },
  };
}

/** Tout ce qui a été écrit dans le journal, aplati en une seule chaîne. */
function journalAsText(): string {
  return capturedEntries.map((e) => JSON.stringify(e)).join('\n');
}

beforeEach(() => {
  capturedEntries.length = 0;
  mockFetch.mockReset();
});

describe('journal des requêtes — expurgation des secrets', () => {
  it("n'écrit pas les jetons renvoyés par /auth/login", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        access_token: ACCESS_TOKEN,
        refresh_token: REFRESH_TOKEN,
        token_type: 'bearer',
      })
    );

    await apiClient.login({
      email: 'agent@ifvm.mg',
      password: 'motdepasse-en-clair',
    });

    expect(capturedEntries.length).toBeGreaterThan(0);
    expect(journalAsText()).not.toContain(ACCESS_TOKEN);
    expect(journalAsText()).not.toContain(REFRESH_TOKEN);
  });

  it("n'écrit pas le mot de passe envoyé à /auth/login", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        access_token: ACCESS_TOKEN,
        refresh_token: REFRESH_TOKEN,
      })
    );

    await apiClient.login({
      email: 'agent@ifvm.mg',
      password: 'motdepasse-en-clair',
    });

    expect(journalAsText()).not.toContain('motdepasse-en-clair');
  });

  it("n'écrit pas le jeton renvoyé par /auth/refresh", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ access_token: ACCESS_TOKEN })
    );

    await apiClient.refresh(REFRESH_TOKEN);

    expect(capturedEntries.length).toBeGreaterThan(0);
    expect(journalAsText()).not.toContain(ACCESS_TOKEN);
    expect(journalAsText()).not.toContain(REFRESH_TOKEN);
  });

  it('laisse passer les données métier, qui sont la charge utile du diagnostic', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse([{ id: 'p-1', latitude: -18.8792, longitude: 47.5079 }])
    );

    // jeton non expiré (exp = 2100), sinon le client refuse avant l'appel
    const validToken = 'eyJhbGciOiAiSFMyNTYifQ.eyJzdWIiOiAiMSIsICJleHAiOiA0MTAyNDQ0ODAwfQ.SIGNATURE_VALID';
    await apiClient.listProspections(validToken, {});

    expect(journalAsText()).toContain('-18.8792');
  });
});
