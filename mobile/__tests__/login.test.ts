import { useAuthStore } from '../src/lib/auth-store';
import * as SecureStore from 'expo-secure-store';
import { apiClient } from '../src/lib/api-client';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('../src/lib/api-client', () => ({
  apiClient: {
    login: jest.fn(),
    getProfile: jest.fn(),
  },
}));

const mockSecureStore = jest.mocked(SecureStore);
const mockApiClient = jest.mocked(apiClient);

function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  const sig = 'signature';
  return `${header}.${body}.${sig}`;
}

const TEST_USER = { id: 1, username: 'alice', role: 'prospecteur' as const };
const TEST_TOKEN = makeJwt({ user_id: 1 });

beforeEach(() => {
  jest.restoreAllMocks();
  mockSecureStore.getItemAsync.mockReset();
  mockSecureStore.setItemAsync.mockReset();
  mockSecureStore.deleteItemAsync.mockReset();
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
    mockApiClient.login.mockResolvedValueOnce({ access_token: TEST_TOKEN });
    mockSecureStore.setItemAsync.mockResolvedValueOnce(undefined);
    mockApiClient.getProfile.mockResolvedValueOnce(TEST_USER);

    await useAuthStore.getState().login('alice', 'password123');

    expect(mockApiClient.login).toHaveBeenCalledWith({
      username: 'alice',
      password: 'password123',
    });
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user).toEqual(TEST_USER);
  });

  it('should show error state on login failure', async () => {
    mockApiClient.login.mockRejectedValueOnce(new Error('Invalid credentials'));

    await expect(
      useAuthStore.getState().login('alice', 'wrong')
    ).rejects.toThrow('Login failed');

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('should clear error state and remain unauthenticated after failed login', async () => {
    mockApiClient.login.mockRejectedValueOnce(new Error('Network error'));

    await expect(
      useAuthStore.getState().login('alice', 'pass')
    ).rejects.toThrow();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
  });
});

describe('Auth guard logic', () => {
  it('should be unauthenticated when no token exists', () => {
    mockSecureStore.getItemAsync.mockResolvedValue(null);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
  });

  it('should become authenticated after successful init', async () => {
    mockSecureStore.getItemAsync.mockResolvedValueOnce(TEST_TOKEN);
    mockApiClient.getProfile.mockResolvedValueOnce(TEST_USER);

    await useAuthStore.getState().init();

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('should remain unauthenticated when init fails with invalid token', async () => {
    mockSecureStore.getItemAsync.mockResolvedValueOnce('bad-token');
    mockApiClient.getProfile.mockRejectedValueOnce(new Error('Unauthorized'));
    mockSecureStore.deleteItemAsync.mockResolvedValueOnce(undefined);

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
    mockSecureStore.deleteItemAsync.mockResolvedValueOnce(undefined);

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
    mockSecureStore.deleteItemAsync.mockResolvedValueOnce(undefined);

    await useAuthStore.getState().logout();

    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_token');
  });
});
