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

const TEST_USER = { id: 1, username: 'alice' };
const TEST_TOKEN = makeJwt({ user_id: 1 });

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({
    token: null,
    user: null,
    isAuthenticated: false,
    isInitialized: false,
  });
});

describe('useAuthStore', () => {
  describe('login', () => {
    it('should transition from unauthenticated to authenticated', async () => {
      mockApiClient.login.mockResolvedValueOnce({ access_token: TEST_TOKEN });
      mockSecureStore.setItemAsync.mockResolvedValueOnce(undefined);
      mockApiClient.getProfile.mockResolvedValueOnce(TEST_USER);

      const { login } = useAuthStore.getState();
      await login('alice', 'password123');

      const state = useAuthStore.getState();
      expect(state.token).toBe(TEST_TOKEN);
      expect(state.user).toEqual(TEST_USER);
      expect(state.isAuthenticated).toBe(true);
    });

    it('should persist token in SecureStore', async () => {
      mockApiClient.login.mockResolvedValueOnce({ access_token: TEST_TOKEN });
      mockSecureStore.setItemAsync.mockResolvedValueOnce(undefined);
      mockApiClient.getProfile.mockResolvedValueOnce(TEST_USER);

      await useAuthStore.getState().login('alice', 'password123');

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'auth_token',
        TEST_TOKEN
      );
    });

    it('should fetch profile after login', async () => {
      mockApiClient.login.mockResolvedValueOnce({ access_token: TEST_TOKEN });
      mockSecureStore.setItemAsync.mockResolvedValueOnce(undefined);
      mockApiClient.getProfile.mockResolvedValueOnce(TEST_USER);

      await useAuthStore.getState().login('alice', 'password123');

      expect(mockApiClient.getProfile).toHaveBeenCalledWith(TEST_TOKEN);
    });
  });

  describe('logout', () => {
    it('should transition from authenticated to unauthenticated', async () => {
      useAuthStore.setState({
        token: TEST_TOKEN,
        user: TEST_USER,
        isAuthenticated: true,
      });
      mockSecureStore.deleteItemAsync.mockResolvedValueOnce(undefined);

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.token).toBeNull();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it('should clear token from SecureStore', async () => {
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

  describe('init', () => {
    it('should restore authenticated state from SecureStore', async () => {
      mockSecureStore.getItemAsync.mockResolvedValueOnce(TEST_TOKEN);
      mockApiClient.getProfile.mockResolvedValueOnce(TEST_USER);

      await useAuthStore.getState().init();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.token).toBe(TEST_TOKEN);
      expect(state.user).toEqual(TEST_USER);
      expect(state.isInitialized).toBe(true);
    });

    it('should remain unauthenticated when no token in SecureStore', async () => {
      mockSecureStore.getItemAsync.mockResolvedValueOnce(null);

      await useAuthStore.getState().init();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.token).toBeNull();
      expect(state.isInitialized).toBe(true);
    });

    it('should clear invalid token and remain unauthenticated', async () => {
      mockSecureStore.getItemAsync.mockResolvedValueOnce('invalid-token');
      mockApiClient.getProfile.mockRejectedValueOnce(new Error('Unauthorized'));
      mockSecureStore.deleteItemAsync.mockResolvedValueOnce(undefined);

      await useAuthStore.getState().init();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isInitialized).toBe(true);
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_token');
    });
  });

  describe('setUser', () => {
    it('should update user in state', () => {
      const newUser = { id: 2, username: 'bob' };
      useAuthStore.getState().setUser(newUser);

      expect(useAuthStore.getState().user).toEqual(newUser);
    });
  });
});
