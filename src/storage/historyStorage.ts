const STORAGE_KEY = 'country-search:history';

type HistoryStorage = Pick<Storage, 'getItem' | 'setItem'>;

const isString = (value: unknown): value is string => typeof value === 'string';

export const loadHistory = (
  storage: HistoryStorage = localStorage,
): string[] => {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed) ? parsed.filter(isString) : [];
  } catch {
    return [];
  }
};

export const saveHistory = (
  history: readonly string[],
  storage: HistoryStorage = localStorage,
): void => {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // localStorage is unavailable (private mode or quota exceeded)
  }
};
