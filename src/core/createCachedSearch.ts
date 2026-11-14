import type { Country, SearchFn } from './types';

type CachedSearchOptions = {
  maxEntries?: number;
};

type SharedRequest = {
  promise: Promise<Country[]>;
  controller: AbortController;
  subscribers: number;
};

const DEFAULT_MAX_ENTRIES = 50;

const toCacheKey = (query: string): string => query.toLowerCase();

const withOwnSignal = <T>(
  promise: Promise<T>,
  signal: AbortSignal,
  onAbort: () => void,
): Promise<T> =>
  new Promise((resolve, reject) => {
    const handleAbort = (): void => {
      onAbort();
      reject(signal.reason);
    };

    signal.addEventListener('abort', handleAbort, { once: true });

    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', handleAbort));
  });

export const createCachedSearch = (
  search: SearchFn,
  { maxEntries = DEFAULT_MAX_ENTRIES }: CachedSearchOptions = {},
): SearchFn => {
  const cache = new Map<string, Country[]>();
  const inFlight = new Map<string, SharedRequest>();

  const remember = (key: string, countries: Country[]): void => {
    cache.delete(key);
    cache.set(key, countries);

    if (cache.size > maxEntries) {
      const oldestKey = cache.keys().next().value;

      if (oldestKey !== undefined) {
        cache.delete(oldestKey);
      }
    }
  };

  const forget = (key: string, request: SharedRequest): void => {
    if (inFlight.get(key) === request) {
      inFlight.delete(key);
    }
  };

  const startRequest = (key: string, query: string): SharedRequest => {
    const controller = new AbortController();
    const request: SharedRequest = {
      controller,
      subscribers: 0,
      promise: search(query, controller.signal)
        .then((countries) => {
          remember(key, countries);
          return countries;
        })
        .finally(() => forget(key, request)),
    };

    inFlight.set(key, request);

    return request;
  };

  return (query, signal) => {
    if (signal.aborted) {
      return Promise.reject(signal.reason);
    }

    const key = toCacheKey(query);
    const cached = cache.get(key);

    if (cached) {
      remember(key, cached);
      return Promise.resolve(cached);
    }

    const request = inFlight.get(key) ?? startRequest(key, query);
    request.subscribers += 1;

    const leave = (): void => {
      request.subscribers -= 1;

      if (request.subscribers === 0) {
        forget(key, request);
        request.controller.abort();
      }
    };

    return withOwnSignal(request.promise, signal, leave);
  };
};
