import { createCachedSearch } from '../src/core/createCachedSearch';
import { mapCountryResponse } from '../src/core/mapCountryResponse';
import type { Country } from '../src/core/types';
import spainResponse from './fixtures/spain.json';
import svalbardResponse from './fixtures/svalbard.json';

const spain = spainResponse.map(mapCountryResponse);
const svalbard = svalbardResponse.map(mapCountryResponse);

type PendingRequest = {
  query: string;
  signal: AbortSignal;
  resolve: (countries: Country[]) => void;
  reject: (reason: unknown) => void;
};

const createControlledSearch = () => {
  const requests: PendingRequest[] = [];

  const search = jest.fn(
    (query: string, signal: AbortSignal): Promise<Country[]> =>
      new Promise((resolve, reject) => {
        requests.push({ query, signal, resolve, reject });
        signal.addEventListener('abort', () => reject(signal.reason));
      }),
  );

  return { search, requests };
};

const newSignal = (): AbortSignal => new AbortController().signal;

describe('createCachedSearch', () => {
  describe('cache', () => {
    it('searches on the first request and returns the result', async () => {
      const search = jest.fn().mockResolvedValue(spain);
      const cachedSearch = createCachedSearch(search);

      await expect(cachedSearch('spain', newSignal())).resolves.toEqual(spain);
      expect(search).toHaveBeenCalledTimes(1);
      expect(search).toHaveBeenCalledWith('spain', expect.any(AbortSignal));
    });

    it('returns a repeated query from the cache without searching again', async () => {
      const search = jest.fn().mockResolvedValue(spain);
      const cachedSearch = createCachedSearch(search);

      await cachedSearch('spain', newSignal());
      const result = await cachedSearch('spain', newSignal());

      expect(result).toEqual(spain);
      expect(search).toHaveBeenCalledTimes(1);
    });

    it('treats queries that differ only in letter case as the same', async () => {
      const search = jest.fn().mockResolvedValue(spain);
      const cachedSearch = createCachedSearch(search);

      await cachedSearch('Spain', newSignal());
      await cachedSearch('spain', newSignal());

      expect(search).toHaveBeenCalledTimes(1);
    });

    it('searches separately for different queries', async () => {
      const search = jest
        .fn()
        .mockResolvedValueOnce(spain)
        .mockResolvedValueOnce(svalbard);
      const cachedSearch = createCachedSearch(search);

      await expect(cachedSearch('spain', newSignal())).resolves.toEqual(spain);
      await expect(cachedSearch('svalbard', newSignal())).resolves.toEqual(
        svalbard,
      );
      expect(search).toHaveBeenCalledTimes(2);
    });

    it('caches an empty result', async () => {
      const search = jest.fn().mockResolvedValue([]);
      const cachedSearch = createCachedSearch(search);

      await cachedSearch('zzzz', newSignal());
      const result = await cachedSearch('zzzz', newSignal());

      expect(result).toEqual([]);
      expect(search).toHaveBeenCalledTimes(1);
    });

    it('does not cache a failed request', async () => {
      const search = jest
        .fn()
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(spain);
      const cachedSearch = createCachedSearch(search);

      await expect(cachedSearch('spain', newSignal())).rejects.toThrow(
        TypeError,
      );
      await expect(cachedSearch('spain', newSignal())).resolves.toEqual(spain);
      expect(search).toHaveBeenCalledTimes(2);
    });

    it('evicts the oldest entry when the cache is full', async () => {
      const search = jest.fn().mockResolvedValue(spain);
      const cachedSearch = createCachedSearch(search, { maxEntries: 2 });

      await cachedSearch('a', newSignal());
      await cachedSearch('b', newSignal());
      await cachedSearch('c', newSignal());
      await cachedSearch('a', newSignal());

      expect(search.mock.calls.map(([query]) => query)).toEqual([
        'a',
        'b',
        'c',
        'a',
      ]);
    });
  });

  describe('deduplication', () => {
    it('shares one request between concurrent identical queries', async () => {
      const { search, requests } = createControlledSearch();
      const cachedSearch = createCachedSearch(search);

      const first = cachedSearch('spain', newSignal());
      const second = cachedSearch('spain', newSignal());
      requests[0].resolve(spain);

      await expect(first).resolves.toEqual(spain);
      await expect(second).resolves.toEqual(spain);
      expect(search).toHaveBeenCalledTimes(1);
    });

    it('starts a new request after the shared one has failed', async () => {
      const { search, requests } = createControlledSearch();
      const cachedSearch = createCachedSearch(search);

      const first = cachedSearch('spain', newSignal());
      requests[0].reject(new TypeError('Failed to fetch'));
      await expect(first).rejects.toThrow(TypeError);

      const second = cachedSearch('spain', newSignal());
      requests[1].resolve(spain);

      await expect(second).resolves.toEqual(spain);
      expect(search).toHaveBeenCalledTimes(2);
    });
  });

  describe('cancellation', () => {
    it('passes its own signal to the search, not the caller signal', () => {
      const { search, requests } = createControlledSearch();
      const cachedSearch = createCachedSearch(search);
      const callerSignal = newSignal();

      void cachedSearch('spain', callerSignal);

      expect(requests[0].signal).not.toBe(callerSignal);
    });

    it('rejects with AbortError when the caller aborts', async () => {
      const { search } = createControlledSearch();
      const cachedSearch = createCachedSearch(search);
      const controller = new AbortController();

      const request = cachedSearch('spain', controller.signal);
      controller.abort();

      await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    });

    it('rejects immediately for an already aborted signal', async () => {
      const { search } = createControlledSearch();
      const cachedSearch = createCachedSearch(search);
      const controller = new AbortController();
      controller.abort();

      await expect(
        cachedSearch('spain', controller.signal),
      ).rejects.toMatchObject({ name: 'AbortError' });
      expect(search).not.toHaveBeenCalled();
    });

    it('keeps the shared request alive for other callers when one aborts', async () => {
      const { search, requests } = createControlledSearch();
      const cachedSearch = createCachedSearch(search);
      const leaving = new AbortController();

      const leavingRequest = cachedSearch('spain', leaving.signal);
      const stayingRequest = cachedSearch('spain', newSignal());
      leaving.abort();
      requests[0].resolve(spain);

      await expect(leavingRequest).rejects.toMatchObject({
        name: 'AbortError',
      });
      await expect(stayingRequest).resolves.toEqual(spain);
      expect(requests[0].signal.aborted).toBe(false);
    });

    it('aborts the shared request when every caller has aborted', async () => {
      const { search, requests } = createControlledSearch();
      const cachedSearch = createCachedSearch(search);
      const first = new AbortController();
      const second = new AbortController();

      const firstRequest = cachedSearch('spain', first.signal);
      const secondRequest = cachedSearch('spain', second.signal);
      first.abort();
      second.abort();

      await expect(firstRequest).rejects.toMatchObject({ name: 'AbortError' });
      await expect(secondRequest).rejects.toMatchObject({ name: 'AbortError' });
      expect(requests[0].signal.aborted).toBe(true);
    });

    it('does not cache a request aborted by every caller', async () => {
      const { search, requests } = createControlledSearch();
      const cachedSearch = createCachedSearch(search);
      const controller = new AbortController();

      const aborted = cachedSearch('spain', controller.signal);
      controller.abort();
      await expect(aborted).rejects.toMatchObject({ name: 'AbortError' });

      const repeated = cachedSearch('spain', newSignal());
      requests[1].resolve(spain);

      await expect(repeated).resolves.toEqual(spain);
      expect(search).toHaveBeenCalledTimes(2);
    });
  });
});
