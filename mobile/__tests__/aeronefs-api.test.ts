jest.mock('../src/lib/storage', () => ({
  storage: { getItem: jest.fn(), setItem: jest.fn(), deleteItem: jest.fn() },
}));
jest.mock('../src/lib/auth-store', () => ({ useAuthStore: { setState: jest.fn() } }));
jest.mock('../src/lib/request-log-store', () => ({
  useRequestLogStore: { getState: () => ({ addEntry: jest.fn() }) },
}));

import { apiClient } from '../src/lib/api-client';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const jeton = [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ sub: 'u', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'),
  'sig',
].join('.');

function repondre(status: number, corps: unknown) {
  const json = async () => corps;
  mockFetch.mockResolvedValueOnce({
    ok: status < 400,
    status,
    json,
    clone: () => ({ text: async () => JSON.stringify(corps) }),
  });
}

function derniereRequete() {
  const [url, init] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
  return { url: String(url), init };
}

beforeEach(() => mockFetch.mockReset());

describe('parc aéronefs — contrat', () => {
  it('crée un appareil hors équipe', async () => {
    repondre(201, { id: 'ae-1' });

    await apiClient.createAeronef(jeton, { immatriculation: '5R-MJK', societe: 'Air Mada', volume_cuve_l: 1200 });

    const { url, init } = derniereRequete();
    expect(url).toMatch(/\/aeronefs$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ immatriculation: '5R-MJK', societe: 'Air Mada', volume_cuve_l: 1200 });
  });

  it('rend un message lisible quand l’immatriculation est déjà prise (409)', async () => {
    repondre(409, { detail: 'immatriculation déjà utilisée par un autre aéronef' });

    await expect(
      apiClient.createAeronef(jeton, { immatriculation: '5R-MJK', societe: 'Air Mada', volume_cuve_l: 1200 })
    ).rejects.toThrow(/déjà utilisée/);
  });

  it('affecte un appareil à une équipe à partir d’une date', async () => {
    repondre(201, { id: 'af-1' });

    await apiClient.affecterAeronef(jeton, 'eq-1', { aeronef_id: 'ae-1', date_debut: '2026-09-24' });

    const { url, init } = derniereRequete();
    expect(url).toMatch(/\/equipes\/eq-1\/aeronefs$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ aeronef_id: 'ae-1', date_debut: '2026-09-24' });
  });

  it('termine une affectation en bornant sa date de fin', async () => {
    repondre(200, { id: 'af-1' });

    await apiClient.cloturerAffectationAeronef(jeton, 'eq-1', 'af-1', { date_fin: '2026-09-24' });

    const { url, init } = derniereRequete();
    expect(url).toMatch(/\/equipes\/eq-1\/aeronefs\/af-1$/);
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ date_fin: '2026-09-24' });
  });
});
