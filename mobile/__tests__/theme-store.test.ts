import { useThemeStore } from '../src/lib/theme-store';
import { storage } from '../src/lib/storage';

jest.mock('../src/lib/storage', () => ({
  storage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    deleteItem: jest.fn(),
  },
}));

const mockStorage = jest.mocked(storage);

beforeEach(() => {
  mockStorage.getItem.mockReset();
  mockStorage.setItem.mockReset();
  useThemeStore.setState({ mode: 'light', isInitialized: false });
});

describe('useThemeStore', () => {
  it('defaults to system light when no theme is stored', async () => {
    mockStorage.getItem.mockResolvedValueOnce(null);

    await useThemeStore.getState().init();

    expect(mockStorage.getItem).toHaveBeenCalledWith('app_theme_mode');
    expect(useThemeStore.getState().mode).toBe('light');
    expect(useThemeStore.getState().isInitialized).toBe(true);
  });

  it('reads the saved mode from storage', async () => {
    mockStorage.getItem.mockResolvedValueOnce('dark');

    await useThemeStore.getState().init();

    expect(useThemeStore.getState().mode).toBe('dark');
  });

  it('persists the mode selected by the user', async () => {
    mockStorage.setItem.mockResolvedValueOnce(undefined);

    await useThemeStore.getState().setMode('dark');

    expect(mockStorage.setItem).toHaveBeenCalledWith('app_theme_mode', 'dark');
    expect(useThemeStore.getState().mode).toBe('dark');
  });
});
