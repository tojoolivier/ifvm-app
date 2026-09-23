import { useFontScaleStore } from '../src/lib/font-scale-store';
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
  useFontScaleStore.setState({ level: 'normale', isInitialized: false });
});

describe('useFontScaleStore', () => {
  it('defaults to "normale" when nothing is stored for this user', async () => {
    mockStorage.getItem.mockResolvedValueOnce(null);

    await useFontScaleStore.getState().init('user-1');

    expect(mockStorage.getItem).toHaveBeenCalledWith('font_scale_user-1');
    expect(useFontScaleStore.getState().level).toBe('normale');
    expect(useFontScaleStore.getState().isInitialized).toBe(true);
  });

  it('reads the level persisted for this user', async () => {
    mockStorage.getItem.mockResolvedValueOnce('grande');

    await useFontScaleStore.getState().init('user-1');

    expect(useFontScaleStore.getState().level).toBe('grande');
  });

  it('falls back to "normale" on a corrupted/unknown stored value', async () => {
    mockStorage.getItem.mockResolvedValueOnce('enorme');

    await useFontScaleStore.getState().init('user-1');

    expect(useFontScaleStore.getState().level).toBe('normale');
  });

  it('persists under a key scoped to the given user id', async () => {
    mockStorage.setItem.mockResolvedValueOnce(undefined);

    await useFontScaleStore.getState().setLevel('user-42', 'petite');

    expect(mockStorage.setItem).toHaveBeenCalledWith('font_scale_user-42', 'petite');
    expect(useFontScaleStore.getState().level).toBe('petite');
  });

  it('n’appelle jamais storage avec la clé d’un autre utilisateur', async () => {
    mockStorage.getItem.mockResolvedValueOnce('grande');
    await useFontScaleStore.getState().init('user-1');

    mockStorage.getItem.mockResolvedValueOnce('petite');
    await useFontScaleStore.getState().init('user-2');

    expect(mockStorage.getItem).toHaveBeenNthCalledWith(1, 'font_scale_user-1');
    expect(mockStorage.getItem).toHaveBeenNthCalledWith(2, 'font_scale_user-2');
    expect(useFontScaleStore.getState().level).toBe('petite');
  });
});
