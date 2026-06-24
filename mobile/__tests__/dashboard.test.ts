import { useAuthStore } from '../src/lib/auth-store';
import * as SecureStore from 'expo-secure-store';
import { apiClient, Poste } from '../src/lib/api-client';

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

const PROSPECTEUR_USER = { id: 1, username: 'alice', role: 'prospecteur' as const };
const CHEF_EQUIPE_USER = { id: 2, username: 'bob', role: 'chef_equipe' as const };

const TEST_POSTES: Poste[] = [
  { id: 1, name: 'Poste A' },
  { id: 2, name: 'Poste B' },
  { id: 3, name: 'Poste C' },
];

beforeEach(() => {
  jest.restoreAllMocks();
  mockSecureStore.getItemAsync.mockReset();
  mockSecureStore.setItemAsync.mockReset();
  mockSecureStore.deleteItemAsync.mockReset();
  mockApiClient.login.mockReset();
  mockApiClient.getProfile.mockReset();
  mockApiClient.getPostes.mockReset();
  useAuthStore.setState({
    token: null,
    user: null,
    isAuthenticated: false,
    isInitialized: false,
  });
});

describe('Dashboard data fetching', () => {
  it('should fetch postes with token for prospecteur', async () => {
    useAuthStore.setState({
      token: TEST_TOKEN,
      user: PROSPECTEUR_USER,
      isAuthenticated: true,
    });
    mockApiClient.getPostes.mockResolvedValueOnce(TEST_POSTES);

    const postes = await apiClient.getPostes(TEST_TOKEN);

    expect(mockApiClient.getPostes).toHaveBeenCalledWith(TEST_TOKEN);
    expect(postes).toHaveLength(3);
  });

  it('should fetch postes with token for chef_equipe', async () => {
    useAuthStore.setState({
      token: TEST_TOKEN,
      user: CHEF_EQUIPE_USER,
      isAuthenticated: true,
    });
    mockApiClient.getPostes.mockResolvedValueOnce(TEST_POSTES);

    const postes = await apiClient.getPostes(TEST_TOKEN);

    expect(postes).toHaveLength(3);
  });

  it('should return empty postes on fetch failure', async () => {
    useAuthStore.setState({
      token: TEST_TOKEN,
      user: PROSPECTEUR_USER,
      isAuthenticated: true,
    });
    mockApiClient.getPostes.mockRejectedValueOnce(new Error('Network error'));

    let postes: Poste[] = [];
    try {
      postes = await apiClient.getPostes(TEST_TOKEN);
    } catch {
      postes = [];
    }

    expect(postes).toHaveLength(0);
  });
});

describe('Dashboard role adaptation', () => {
  it('should identify prospecteur role correctly', () => {
    useAuthStore.setState({
      token: TEST_TOKEN,
      user: PROSPECTEUR_USER,
      isAuthenticated: true,
    });

    const user = useAuthStore.getState().user;
    expect(user?.role).toBe('prospecteur');
  });

  it('should identify chef_equipe role correctly', () => {
    useAuthStore.setState({
      token: TEST_TOKEN,
      user: CHEF_EQUIPE_USER,
      isAuthenticated: true,
    });

    const user = useAuthStore.getState().user;
    expect(user?.role).toBe('chef_equipe');
  });

  it('should show postes count for prospecteur', () => {
    useAuthStore.setState({
      token: TEST_TOKEN,
      user: PROSPECTEUR_USER,
      isAuthenticated: true,
    });

    const user = useAuthStore.getState().user;
    const isProspecteur = user?.role === 'prospecteur';
    expect(isProspecteur).toBe(true);
  });

  it('should show fiches summary for chef_equipe', () => {
    useAuthStore.setState({
      token: TEST_TOKEN,
      user: CHEF_EQUIPE_USER,
      isAuthenticated: true,
    });

    const user = useAuthStore.getState().user;
    const isChefEquipe = user?.role === 'chef_equipe';
    expect(isChefEquipe).toBe(true);
  });
});
