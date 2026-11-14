import { loadHistory, saveHistory } from '../src/storage/historyStorage';

const STORAGE_KEY = 'country-search:history';

const createMemoryStorage = (initial: Record<string, string> = {}) => {
  const items = new Map(Object.entries(initial));

  return {
    getItem: jest.fn((key: string) => items.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => {
      items.set(key, value);
    }),
  };
};

const createBrokenStorage = () => ({
  getItem: jest.fn(() => {
    throw new Error('SecurityError');
  }),
  setItem: jest.fn(() => {
    throw new Error('QuotaExceededError');
  }),
});

describe('history storage', () => {
  describe('loadHistory', () => {
    it('returns an empty history when nothing is stored', () => {
      expect(loadHistory(createMemoryStorage())).toEqual([]);
    });

    it('returns the stored history', () => {
      const storage = createMemoryStorage({
        [STORAGE_KEY]: JSON.stringify(['spain', 'france']),
      });

      expect(loadHistory(storage)).toEqual(['spain', 'france']);
    });

    it('returns an empty history for invalid JSON', () => {
      const storage = createMemoryStorage({ [STORAGE_KEY]: '{not json' });

      expect(loadHistory(storage)).toEqual([]);
    });

    it('returns an empty history when the stored value is not a list', () => {
      const storage = createMemoryStorage({
        [STORAGE_KEY]: JSON.stringify({ query: 'spain' }),
      });

      expect(loadHistory(storage)).toEqual([]);
    });

    it('skips stored items that are not strings', () => {
      const storage = createMemoryStorage({
        [STORAGE_KEY]: JSON.stringify(['spain', 42, null, 'france']),
      });

      expect(loadHistory(storage)).toEqual(['spain', 'france']);
    });

    it('returns an empty history when storage is unavailable', () => {
      expect(loadHistory(createBrokenStorage())).toEqual([]);
    });
  });

  describe('saveHistory', () => {
    it('saves the history so it can be loaded again', () => {
      const storage = createMemoryStorage();

      saveHistory(['spain', 'france'], storage);

      expect(storage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify(['spain', 'france']),
      );
      expect(loadHistory(storage)).toEqual(['spain', 'france']);
    });

    it('does not throw when storage is unavailable', () => {
      expect(() => saveHistory(['spain'], createBrokenStorage())).not.toThrow();
    });
  });
});
