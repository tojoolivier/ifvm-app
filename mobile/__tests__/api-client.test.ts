import { apiClient } from '../src/lib/api-client';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock environment variable
const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
  process.env.EXPO_PUBLIC_API_URL = 'http://test-api.com';
  mockFetch.mockClear();
});

afterAll(() => {
  process.env = originalEnv;
});

describe('API Client', () => {
  describe('Authorization header', () => {
    it('should send Authorization header on authenticated requests', async () => {
      const token = 'test-token-123';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'test' }),
      });

      await apiClient.getProfile(token);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/users/me',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${token}`,
          }),
        })
      );
    });

    it('should not send Authorization header on login', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token' }),
      });

      await apiClient.login({ email: 'user@test.com', password: 'pass' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/auth/login',
        expect.objectContaining({
          headers: expect.not.objectContaining({
            'Authorization': expect.any(String),
          }),
        })
      );
    });
  });

  describe('401 handling', () => {
    it('should trigger onUnauthorized callback on 401 response', async () => {
      const onUnauthorized = jest.fn();
      const token = 'invalid-token';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Unauthorized' }),
      });

      await expect(apiClient.getProfile(token, onUnauthorized)).rejects.toThrow();
      expect(onUnauthorized).toHaveBeenCalled();
    });

    it('should not trigger onUnauthorized callback on non-401 errors', async () => {
      const onUnauthorized = jest.fn();
      const token = 'valid-token';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ detail: 'Server error' }),
      });

      await expect(apiClient.getProfile(token, onUnauthorized)).rejects.toThrow();
      expect(onUnauthorized).not.toHaveBeenCalled();
    });
  });

  describe('Base URL configuration', () => {
    it('should use EXPO_PUBLIC_API_URL environment variable', async () => {
      process.env.EXPO_PUBLIC_API_URL = 'http://custom-api.com';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token' }),
      });

      await apiClient.login({ email: 'user@test.com', password: 'pass' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://custom-api.com/auth/login',
        expect.any(Object)
      );
    });

    it('should default to http://localhost:8000 if EXPO_PUBLIC_API_URL is not set', async () => {
      delete process.env.EXPO_PUBLIC_API_URL;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token' }),
      });

      await apiClient.login({ email: 'user@test.com', password: 'pass' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/auth/login',
        expect.any(Object)
      );
    });
  });

  describe('Endpoints', () => {
    it('login should POST to /auth/login', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token' }),
      });

      await apiClient.login({ email: 'user@test.com', password: 'pass' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/auth/login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'user@test.com', password: 'pass' }),
        })
      );
    });

    it('getPostes should GET from /geo/postes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 1, name: 'Poste 1' }],
      });

      await apiClient.getPostes('token');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/geo/postes',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('getStations should GET from /geo/stations', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 1, name: 'Station 1' }],
      });

      await apiClient.getStations('token');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/geo/stations',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('getProfile should GET from /users/me', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '550e8400-e29b-41d4-a716-446655440000', nom: 'Dupont', prenom: 'Alice', email: 'alice@test.com', role: 'prospecteur', actif: true, created_at: '2026-01-01T00:00:00Z' }),
      });

      await apiClient.getProfile('token');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/users/me',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });
  });
});
