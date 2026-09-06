import { useAuthStore } from '../src/lib/auth-store';
import { storage } from '../src/lib/storage';
import { apiClient } from '../src/lib/api-client';
import { AuthError, NetworkError } from '../src/lib/errors';

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
    refresh: jest.fn(),
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
const TEST_REFRESH_TOKEN = 'refresh-token-value';

beforeEach(() => {
  jest.restoreAllMocks();
  mockStorage.getItem.mockReset();
  mockStorage.setItem.mockReset();
  mockStorage.deleteItem.mockReset();
  mockApiClient.login.mockReset();
  mockApiClient.getProfile.mockReset();
  mockApiClient.refresh.mockReset();
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
      mockApiClient.login.mockResolvedValueOnce({ access_token: TEST_TOKEN, refresh_token: TEST_REFRESH_TOKEN });
      mockStorage.setItem.mockResolvedValueOnce(undefined);
      mockApiClient.getProfile.mockResolvedValueOnce(TEST_USER);

      await useAuthStore.getState().login('alice@test.com', 'password123');

      const state = useAuthStore.getState();
      expect(state.token).toBe(TEST_TOKEN);
      expect(state.user).toEqual(TEST_USER);
      expect(state.isAuthenticated).toBe(true);
    });

    it('should persist token in SecureStore', async () => {
      mockApiClient.login.mockResolvedValueOnce({ access_token: TEST_TOKEN, refresh_token: TEST_REFRESH_TOKEN });
      mockStorage.setItem.mockResolvedValueOnce(undefined);
      mockApiClient.getProfile.mockResolvedValueOnce(TEST_USER);

      await useAuthStore.getState().login('alice@test.com', 'password123');

      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'auth_token',
        TEST_TOKEN
      );
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'refresh_token',
        TEST_REFRESH_TOKEN
      );
    });

    it('should fetch profile after login', async () => {
      mockApiClient.login.mockResolvedValueOnce({ access_token: TEST_TOKEN, refresh_token: TEST_REFRESH_TOKEN });
      mockStorage.setItem.mockResolvedValueOnce(undefined);
      mockApiClient.getProfile.mockResolvedValueOnce(TEST_USER);

      await useAuthStore.getState().login('alice@test.com', 'password123');

      expect(mockApiClient.getProfile).toHaveBeenCalledWith(TEST_TOKEN);
    });

    it('should reset state on login failure', async () => {
      mockApiClient.login.mockRejectedValueOnce(new Error('Invalid credentials'));

      await expect(
        useAuthStore.getState().login('alice@test.com', 'wrong')
      ).rejects.toThrow('Invalid credentials');

      const state = useAuthStore.getState();
      expect(state.token).toBeNull();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it('caches the profile locally so a later offline start can show it', async () => {
      mockApiClient.login.mockResolvedValueOnce({ access_token: TEST_TOKEN, refresh_token: TEST_REFRESH_TOKEN });
      mockStorage.setItem.mockResolvedValue(undefined);
      mockApiClient.getProfile.mockResolvedValueOnce(TEST_USER);

      await useAuthStore.getState().login('alice@test.com', 'password123');

      expect(mockStorage.setItem).toHaveBeenCalledWith('auth_user', JSON.stringify(TEST_USER));
    });

    it('should still login when profile fetch fails after login', async () => {
      mockApiClient.login.mockResolvedValueOnce({ access_token: TEST_TOKEN, refresh_token: TEST_REFRESH_TOKEN });
      mockStorage.setItem.mockResolvedValueOnce(undefined);
      mockApiClient.getProfile.mockRejectedValueOnce(new Error('Network error'));

      await useAuthStore.getState().login('alice@test.com', 'password123');

      const state = useAuthStore.getState();
      expect(state.token).toBe(TEST_TOKEN);
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(true);
    });
  });

  describe('logout', () => {
    it('should transition from authenticated to unauthenticated', async () => {
      useAuthStore.setState({
        token: TEST_TOKEN,
        user: TEST_USER,
        isAuthenticated: true,
      });
      mockStorage.deleteItem.mockResolvedValueOnce(undefined);

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
      mockStorage.deleteItem.mockResolvedValue(undefined);

      await useAuthStore.getState().logout();

      expect(mockStorage.deleteItem).toHaveBeenCalledWith('auth_token');
      expect(mockStorage.deleteItem).toHaveBeenCalledWith('refresh_token');
      expect(mockStorage.deleteItem).toHaveBeenCalledWith('auth_user');
    });
  });

  describe('init', () => {
    it('should restore authenticated state from SecureStore', async () => {
      mockStorage.getItem
        .mockResolvedValueOnce(TEST_TOKEN) // auth_token
        .mockResolvedValueOnce(null); // auth_user (aucun profil en cache)
      mockApiClient.getProfile.mockResolvedValueOnce(TEST_USER);

      await useAuthStore.getState().init();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.token).toBe(TEST_TOKEN);
      expect(state.user).toEqual(TEST_USER);
      expect(state.isInitialized).toBe(true);
    });

    it('should remain unauthenticated when no token in SecureStore', async () => {
      mockStorage.getItem.mockResolvedValueOnce(null);

      await useAuthStore.getState().init();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.token).toBeNull();
      expect(state.isInitialized).toBe(true);
    });

    it('should clear invalid token and remain unauthenticated', async () => {
      mockStorage.getItem.mockResolvedValueOnce('invalid-token');
      mockApiClient.getProfile.mockRejectedValueOnce(new Error('Unauthorized'));
      mockStorage.deleteItem.mockResolvedValueOnce(undefined);

      await useAuthStore.getState().init();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isInitialized).toBe(true);
      expect(mockStorage.deleteItem).toHaveBeenCalledWith('auth_token');
    });

    it('should decode JWT and extract user_id on startup', async () => {
      const payload = { user_id: '550e8400-e29b-41d4-a716-446655440000', sub: 'alice' };
      const token = makeJwt(payload);
      const user = { id: '550e8400-e29b-41d4-a716-446655440000', nom: 'Dupont', prenom: 'Alice', email: 'alice@test.com', role: 'prospecteur' as const, actif: true, created_at: '2026-01-01T00:00:00Z' };

      mockStorage.getItem
        .mockResolvedValueOnce(token) // auth_token
        .mockResolvedValueOnce(null); // auth_user
      mockApiClient.getProfile.mockResolvedValueOnce(user);
      mockStorage.deleteItem.mockResolvedValueOnce(undefined);

      await useAuthStore.getState().init();

      const state = useAuthStore.getState();
      expect(state.token).toBe(token);
      expect(state.user).toEqual(user);
      expect(state.isAuthenticated).toBe(true);
      expect(mockApiClient.getProfile).toHaveBeenCalledWith(token);
    });

    it('should remain unauthenticated if JWT has no user_id', async () => {
      const token = makeJwt({ foo: 'bar' });

      mockStorage.getItem.mockResolvedValueOnce(token);
      mockStorage.deleteItem.mockResolvedValueOnce(undefined);

      await useAuthStore.getState().init();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isInitialized).toBe(true);
    });

    // #offline-apres-premiere-connexion : un jeton local valide doit rester
    // une session ouverte même quand le profil ne peut pas être rafraîchi
    // faute de réseau — c'est tout l'objet du correctif.
    it('keeps the session authenticated when the profile fetch fails with a NetworkError (offline)', async () => {
      mockStorage.getItem
        .mockResolvedValueOnce(TEST_TOKEN) // auth_token
        .mockResolvedValueOnce(null); // auth_user (aucun profil en cache)
      mockApiClient.getProfile.mockRejectedValueOnce(new NetworkError('Serveur injoignable'));

      await useAuthStore.getState().init();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.token).toBe(TEST_TOKEN);
      expect(state.isInitialized).toBe(true);
      expect(mockStorage.deleteItem).not.toHaveBeenCalled();
    });

    it('restores the last cached profile while offline, instead of leaving user null', async () => {
      mockStorage.getItem
        .mockResolvedValueOnce(TEST_TOKEN) // auth_token
        .mockResolvedValueOnce(JSON.stringify(TEST_USER)); // auth_user (profil mis en cache au dernier login)
      mockApiClient.getProfile.mockRejectedValueOnce(new NetworkError('Serveur injoignable'));

      await useAuthStore.getState().init();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual(TEST_USER);
    });

    it('logs out only when the server explicitly rejects the token (AuthError), not on a network failure', async () => {
      mockStorage.getItem
        .mockResolvedValueOnce(TEST_TOKEN)
        .mockResolvedValueOnce(null);
      mockApiClient.getProfile.mockRejectedValueOnce(new AuthError('Token invalide. Veuillez vous reconnecter.'));
      mockStorage.deleteItem.mockResolvedValue(undefined);

      await useAuthStore.getState().init();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.token).toBeNull();
      expect(mockStorage.deleteItem).toHaveBeenCalledWith('auth_token');
    });
  });

  describe('refreshToken', () => {
    it('exchanges the stored refresh token for a new access token', async () => {
      mockStorage.getItem.mockResolvedValueOnce(TEST_REFRESH_TOKEN);
      mockApiClient.refresh.mockResolvedValueOnce({ access_token: 'new-access-token' });
      mockStorage.setItem.mockResolvedValueOnce(undefined);

      const result = await useAuthStore.getState().refreshToken();

      expect(result).toBe(true);
      expect(mockApiClient.refresh).toHaveBeenCalledWith(TEST_REFRESH_TOKEN);
      expect(mockStorage.setItem).toHaveBeenCalledWith('auth_token', 'new-access-token');
      expect(useAuthStore.getState().token).toBe('new-access-token');
    });

    it('returns false without calling the API when no refresh token is stored', async () => {
      mockStorage.getItem.mockResolvedValueOnce(null);

      const result = await useAuthStore.getState().refreshToken();

      expect(result).toBe(false);
      expect(mockApiClient.refresh).not.toHaveBeenCalled();
    });

    it('logs out and returns false when the refresh token is rejected', async () => {
      useAuthStore.setState({ token: TEST_TOKEN, user: TEST_USER, isAuthenticated: true });
      mockStorage.getItem.mockResolvedValueOnce(TEST_REFRESH_TOKEN);
      mockApiClient.refresh.mockRejectedValueOnce(new Error('expired'));
      mockStorage.deleteItem.mockResolvedValue(undefined);

      const result = await useAuthStore.getState().refreshToken();

      expect(result).toBe(false);
      expect(mockStorage.deleteItem).toHaveBeenCalledWith('auth_token');
      expect(mockStorage.deleteItem).toHaveBeenCalledWith('refresh_token');
      const state = useAuthStore.getState();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('setUser', () => {
    it('should update user in state', () => {
      const newUser = { id: '660e8400-e29b-41d4-a716-446655440001', nom: 'Bernard', prenom: 'Bob', email: 'bob@test.com', role: 'chef_equipe' as const, actif: true, created_at: '2026-01-01T00:00:00Z' };
      useAuthStore.getState().setUser(newUser);

      expect(useAuthStore.getState().user).toEqual(newUser);
    });
  });
});
