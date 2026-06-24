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
    getPostes: jest.fn(),
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

const TEST_TOKEN = makeJwt({ user_id: 1 });
const TEST_USER = { id: 1, username: 'alice', role: 'prospecteur' as const };

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

describe('Profile screen logic', () => {
  it('should display user info after auth', async () => {
    mockApiClient.login.mockResolvedValueOnce({ access_token: TEST_TOKEN });
    mockSecureStore.setItemAsync.mockResolvedValueOnce(undefined);
    mockApiClient.getProfile.mockResolvedValueOnce(TEST_USER);

    await useAuthStore.getState().login('alice', 'password123');

    const state = useAuthStore.getState();
    expect(state.user?.username).toBe('alice');
    expect(state.user?.role).toBe('prospecteur');
  });

  it('should clear user on logout', async () => {
    useAuthStore.setState({
      token: TEST_TOKEN,
      user: TEST_USER,
      isAuthenticated: true,
    });
    mockSecureStore.deleteItemAsync.mockResolvedValueOnce(undefined);

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
    mockSecureStore.deleteItemAsync.mockResolvedValueOnce(undefined);

    await useAuthStore.getState().logout();

    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_token');
  });
});

describe('Token expiry redirect', () => {
  it('should become unauthenticated after logout triggered by 401', async () => {
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

  it('should clean up SecureStore on token expiry logout', async () => {
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
