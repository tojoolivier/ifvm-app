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

const TEST_USER = { id: '550e8400-e29b-41d4-a716-446655440000', nom: 'Dupont', prenom: 'Alice', email: 'alice@test.com', role: 'prospecteur' as const, actif: true, created_at: '2026-01-01T00:00:00Z' };
const TEST_TOKEN = makeJwt({ user_id: '550e8400-e29b-41d4-a716-446655440000' });

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

describe('Login flow', () => {
  it('should call login with credentials and transition to authenticated', async () => {
    mockApiClient.login.mockResolvedValueOnce({ access_token: TEST_TOKEN, refresh_token: 'refresh-token-value' });
    mockStorage.setItem.mockResolvedValueOnce(undefined);
    mockApiClient.getProfile.mockResolvedValueOnce(TEST_USER);

    await useAuthStore.getState().login('alice@test.com', 'password123');

    expect(mockApiClient.login).toHaveBeenCalledWith({
      email: 'alice@test.com',
      password: 'password123',
    });
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user).toEqual(TEST_USER);
  });

  it('should show error state on login failure', async () => {
    mockApiClient.login.mockRejectedValueOnce(new Error('Invalid credentials'));

    await expect(
      useAuthStore.getState().login('alice@test.com', 'wrong')
    ).rejects.toThrow('Login failed');

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('should clear error state and remain unauthenticated after failed login', async () => {
    mockApiClient.login.mockRejectedValueOnce(new Error('Network error'));

    await expect(
      useAuthStore.getState().login('alice@test.com', 'pass')
    ).rejects.toThrow();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
  });
});

describe('Auth guard logic', () => {
  it('should be unauthenticated when no token exists', () => {
    mockStorage.getItem.mockResolvedValue(null);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
  });

  it('should become authenticated after successful init', async () => {
    mockStorage.getItem.mockResolvedValueOnce(TEST_TOKEN);
    mockApiClient.getProfile.mockResolvedValueOnce(TEST_USER);

    await useAuthStore.getState().init();

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('should remain unauthenticated when init fails with invalid token', async () => {
    mockStorage.getItem.mockResolvedValueOnce('bad-token');
    mockApiClient.getProfile.mockRejectedValueOnce(new Error('Unauthorized'));
    mockStorage.deleteItem.mockResolvedValueOnce(undefined);

    await useAuthStore.getState().init();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});

describe('Token expiry handling', () => {
  it('should logout when 401 is received via onUnauthorized callback', async () => {
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

  it('should clear SecureStore on logout', async () => {
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
