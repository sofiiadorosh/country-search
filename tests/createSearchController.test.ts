import { createSearchController } from '../src/core/createSearchController';
import { HttpError } from '../src/api/HttpError';
import { mapCountryResponse } from '../src/core/mapCountryResponse';
import type { Country } from '../src/core/types';
import spainResponse from './fixtures/spain.json';

const DELAY = 400;
const spain = spainResponse.map(mapCountryResponse);

type SearchMock = jest.Mock<Promise<Country[]>, [string, AbortSignal]>;

const pendingUntilAborted = (
  _query: string,
  signal: AbortSignal,
): Promise<Country[]> =>
  new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason));
  });

const signalOfCall = (search: SearchMock, index: number): AbortSignal =>
  search.mock.calls[index][1];

const setup = (search: SearchMock) =>
  createSearchController({ search, delay: DELAY });

describe('createSearchController', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('input', () => {
    it('starts in the idle state', () => {
      const controller = setup(jest.fn());

      expect(controller.getState()).toEqual({ status: 'idle' });
    });

    it.each(['', '   '])(
      'does not search for an empty query %p',
      async (query) => {
        const search: SearchMock = jest.fn();
        const controller = setup(search);

        controller.setQuery(query);
        await jest.advanceTimersByTimeAsync(DELAY);

        expect(search).not.toHaveBeenCalled();
        expect(controller.getState()).toEqual({ status: 'idle' });
      },
    );

    it('shows loading right after the query changes', () => {
      const controller = setup(jest.fn(pendingUntilAborted));

      controller.setQuery('spain');

      expect(controller.getState()).toEqual({
        status: 'loading',
        query: 'spain',
      });
    });

    it('searches only after the debounce delay', async () => {
      const search: SearchMock = jest.fn(pendingUntilAborted);
      const controller = setup(search);

      controller.setQuery('spain');
      await jest.advanceTimersByTimeAsync(DELAY - 1);

      expect(search).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(1);

      expect(search).toHaveBeenCalledTimes(1);
      expect(search).toHaveBeenCalledWith('spain', expect.any(AbortSignal));
    });

    it('trims the query before searching', async () => {
      const search: SearchMock = jest.fn(pendingUntilAborted);
      const controller = setup(search);

      controller.setQuery('  spain  ');
      await jest.advanceTimersByTimeAsync(DELAY);

      expect(search).toHaveBeenCalledWith('spain', expect.any(AbortSignal));
    });

    it('searches once for fast typing', async () => {
      const search: SearchMock = jest.fn(pendingUntilAborted);
      const controller = setup(search);

      controller.setQuery('s');
      controller.setQuery('sp');
      controller.setQuery('spain');
      await jest.advanceTimersByTimeAsync(DELAY);

      expect(search).toHaveBeenCalledTimes(1);
      expect(search).toHaveBeenCalledWith('spain', expect.any(AbortSignal));
    });

    it('does not search again when the query has not changed', async () => {
      const search: SearchMock = jest.fn(pendingUntilAborted);
      const controller = setup(search);

      controller.setQuery('spain');
      await jest.advanceTimersByTimeAsync(DELAY);
      controller.setQuery('spain ');
      await jest.advanceTimersByTimeAsync(DELAY);

      expect(search).toHaveBeenCalledTimes(1);
      expect(signalOfCall(search, 0).aborted).toBe(false);
    });
  });

  describe('results', () => {
    it('shows the found countries', async () => {
      const controller = setup(jest.fn().mockResolvedValue(spain));

      controller.setQuery('spain');
      await jest.advanceTimersByTimeAsync(DELAY);

      expect(controller.getState()).toEqual({
        status: 'success',
        query: 'spain',
        countries: spain,
      });
    });

    it('shows not found for an empty result', async () => {
      const controller = setup(jest.fn().mockResolvedValue([]));

      controller.setQuery('zzzz');
      await jest.advanceTimersByTimeAsync(DELAY);

      expect(controller.getState()).toEqual({
        status: 'not-found',
        query: 'zzzz',
      });
    });

    it('notifies the listener about every state change', async () => {
      const onStateChange = jest.fn();
      const controller = createSearchController({
        search: jest.fn().mockResolvedValue(spain),
        delay: DELAY,
        onStateChange,
      });

      controller.setQuery('spain');
      await jest.advanceTimersByTimeAsync(DELAY);

      expect(onStateChange.mock.calls).toEqual([
        [{ status: 'loading', query: 'spain' }],
        [{ status: 'success', query: 'spain', countries: spain }],
      ]);
    });
  });

  describe('errors', () => {
    it.each([
      ['http', new HttpError(500)],
      ['timeout', new DOMException('Timed out', 'TimeoutError')],
      ['network', new TypeError('Failed to fetch')],
    ])('shows a %s error', async (errorKind, error) => {
      const controller = setup(jest.fn().mockRejectedValue(error));

      controller.setQuery('spain');
      await jest.advanceTimersByTimeAsync(DELAY);

      expect(controller.getState()).toEqual({
        status: 'error',
        query: 'spain',
        errorKind,
      });
    });

    it('does not show an error when a request is aborted', async () => {
      const onStateChange = jest.fn();
      const controller = createSearchController({
        search: jest.fn(pendingUntilAborted),
        delay: DELAY,
        onStateChange,
      });

      controller.setQuery('spain');
      await jest.advanceTimersByTimeAsync(DELAY);
      controller.setQuery('');
      await jest.advanceTimersByTimeAsync(DELAY);

      const statuses = onStateChange.mock.calls.map(([state]) => state.status);
      expect(statuses).not.toContain('error');
      expect(controller.getState()).toEqual({ status: 'idle' });
    });
  });

  describe('cancellation', () => {
    it('passes an unaborted signal to the search', async () => {
      const search: SearchMock = jest.fn(pendingUntilAborted);
      const controller = setup(search);

      controller.setQuery('spain');
      await jest.advanceTimersByTimeAsync(DELAY);

      expect(signalOfCall(search, 0).aborted).toBe(false);
    });

    it('aborts the active request as soon as the query changes', async () => {
      const search: SearchMock = jest.fn(pendingUntilAborted);
      const controller = setup(search);

      controller.setQuery('sp');
      await jest.advanceTimersByTimeAsync(DELAY);
      controller.setQuery('spa');

      expect(signalOfCall(search, 0).aborted).toBe(true);
      expect(search).toHaveBeenCalledTimes(1);
    });

    it('aborts the active request when the input is cleared', async () => {
      const search: SearchMock = jest.fn(pendingUntilAborted);
      const controller = setup(search);

      controller.setQuery('spain');
      await jest.advanceTimersByTimeAsync(DELAY);
      controller.setQuery('');

      expect(signalOfCall(search, 0).aborted).toBe(true);
      expect(controller.getState()).toEqual({ status: 'idle' });
    });

    it('does not search for a query cleared before the delay', async () => {
      const search: SearchMock = jest.fn(pendingUntilAborted);
      const controller = setup(search);

      controller.setQuery('spain');
      controller.setQuery('');
      await jest.advanceTimersByTimeAsync(DELAY);

      expect(search).not.toHaveBeenCalled();
      expect(controller.getState()).toEqual({ status: 'idle' });
    });

    it('uses a new signal for every request', async () => {
      const search: SearchMock = jest.fn(pendingUntilAborted);
      const controller = setup(search);

      controller.setQuery('sp');
      await jest.advanceTimersByTimeAsync(DELAY);
      controller.setQuery('spain');
      await jest.advanceTimersByTimeAsync(DELAY);

      expect(signalOfCall(search, 0)).not.toBe(signalOfCall(search, 1));
      expect(signalOfCall(search, 0).aborted).toBe(true);
      expect(signalOfCall(search, 1).aborted).toBe(false);
    });
  });

  describe('retry', () => {
    it('repeats the last query immediately', async () => {
      const search: SearchMock = jest
        .fn()
        .mockRejectedValueOnce(new HttpError(500))
        .mockResolvedValueOnce(spain);
      const controller = setup(search);

      controller.setQuery('spain');
      await jest.advanceTimersByTimeAsync(DELAY);
      controller.retry();
      await jest.advanceTimersByTimeAsync(0);

      expect(search).toHaveBeenCalledTimes(2);
      expect(search).toHaveBeenLastCalledWith('spain', expect.any(AbortSignal));
      expect(controller.getState()).toEqual({
        status: 'success',
        query: 'spain',
        countries: spain,
      });
    });

    it('shows loading while retrying', async () => {
      const search: SearchMock = jest
        .fn()
        .mockRejectedValueOnce(new HttpError(500))
        .mockImplementationOnce(pendingUntilAborted);
      const controller = setup(search);

      controller.setQuery('spain');
      await jest.advanceTimersByTimeAsync(DELAY);
      controller.retry();

      expect(controller.getState()).toEqual({
        status: 'loading',
        query: 'spain',
      });
    });

    it('does nothing when there is no query', async () => {
      const search: SearchMock = jest.fn();
      const controller = setup(search);

      controller.retry();
      await jest.advanceTimersByTimeAsync(DELAY);

      expect(search).not.toHaveBeenCalled();
      expect(controller.getState()).toEqual({ status: 'idle' });
    });
  });
});
