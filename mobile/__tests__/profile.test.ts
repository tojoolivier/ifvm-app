import { useAuthStore } from '../src/lib/auth-store';
import { storage } from '../src/lib/storage';
import { apiClient } from '../src/lib/api-client';

jest.mock('../src/lib/storage', () => ({
  storage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    deleteItem: jest.fn(),
  },
}));

jest.mock('../src/lib/api-client', () => ({
  apiClient: {
    login: jest.fn(),
    getProfile: jest.fn(),
    getPostes: jest.fn(),
  },
}));

const mockStorage = jest.mocked(storage);
const mockApiClient = jest.mocked(apiClient);

function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const body = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const sig = 'signature';
  return `${header}.${body}.${sig}`;
}

const TEST_TOKEN = makeJwt({ user_id: '550e8400-e29b-41d4-a716-446655440000' });
const TEST_USER = { id: '550e8400-e29b-41d4-a716-446655440000', nom: 'Dupont', prenom: 'Alice', email: 'alice@test.com', role: 'prospecteur' as const, actif: true, created_at: '2026-01-01T00:00:00Z' };

beforeEach(() => {
  jest.restoreAllMocks();
  mockStorage.getItem.mockReset();
  mockStorage.setItem.mockReset();
  mockStorage.deleteItem.mockReset();
  mockApiClient.login.mockReset();
  mockApiClient.getProfile.mockReset();
  useAuthStore.setState({
    token: null,
    user: null,
    isAuthenticated: false,
    isInitialized: false,
  });
});

describe('Profile screen logic', () => {
  it('should display user info after auth', async () => {
    mockApiClient.login.mockResolvedValueOnce({ access_token: TEST_TOKEN });
    mockStorage.setItem.mockResolvedValueOnce(undefined);
    mockApiClient.getProfile.mockResolvedValueOnce(TEST_USER);

    await useAuthStore.getState().login('alice@test.com', 'password123');

    const state = useAuthStore.getState();
    expect(state.user?.prenom).toBe('Alice');
    expect(state.user?.role).toBe('prospecteur');
  });

  it('should clear user on logout', async () => {
    useAuthStore.setState({
      token: TEST_TOKEN,
      user: TEST_USER,
      isAuthenticated: true,
    });
    mockStorage.deleteItem.mockResolvedValueOnce(undefined);

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('should clear SecureStore on logout for profile', async () => {
    useAuthStore.setState({
      token: TEST_TOKEN,
      user: TEST_USER,
      isAuthenticated: true,
    });
    mockStorage.deleteItem.mockResolvedValueOnce(undefined);

    await useAuthStore.getState().logout();

    expect(mockStorage.deleteItem).toHaveBeenCalledWith('auth_token');
  });
});

describe('Token expiry redirect', () => {
  it('should become unauthenticated after logout triggered by 401', async () => {
    useAuthStore.setState({
      token: TEST_TOKEN,
      user: TEST_USER,
      isAuthenticated: true,
    });
    mockStorage.deleteItem.mockResolvedValueOnce(undefined);

    await useAuthStore.getState().logout();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('should clean up SecureStore on token expiry logout', async () => {
    useAuthStore.setState({
      token: TEST_TOKEN,
      user: TEST_USER,
      isAuthenticated: true,
    });
    mockStorage.deleteItem.mockResolvedValueOnce(undefined);

    await useAuthStore.getState().logout();

    expect(mockStorage.deleteItem).toHaveBeenCalledWith('auth_token');
  });
});
