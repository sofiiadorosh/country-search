import { HISTORY_LIMIT } from './constants';

export const addToHistory = (
  history: readonly string[],
  query: string,
  limit = HISTORY_LIMIT,
): readonly string[] => {
  const entry = query.trim();

  if (!entry) {
    return history;
  }

  const key = entry.toLowerCase();
  const rest = history.filter((item) => item.toLowerCase() !== key);

  return [entry, ...rest].slice(0, limit);
};
