import { createSearchController } from '../src/core/createSearchController';
import { mapCountryResponse } from '../src/core/mapCountryResponse';
import type { SearchState } from '../src/core/types';
import spainResponse from './fixtures/spain.json';
import svalbardResponse from './fixtures/svalbard.json';

const DELAY = 400;
const SLOW_RESPONSE_MS = 1000;
const FAST_RESPONSE_MS = 100;

type MockRoute = {
  body: unknown;
  delayMs: number;
};

const routes: Record<string, MockRoute> = {
  'https://countries.dev/name/sp': {
    body: svalbardResponse,
    delayMs: SLOW_RESPONSE_MS,
  },
  'https://countries.dev/name/spain': {
    body: spainResponse,
    delayMs: FAST_RESPONSE_MS,
  },
};

const delayedFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> =>
  new Promise((resolve, reject) => {
    const { body, delayMs } = routes[String(input)];
    const signal = init?.signal;

    const timerId = setTimeout(() => {
      resolve(new Response(JSON.stringify(body), { status: 200 }));
    }, delayMs);

    signal?.addEventListener('abort', () => {
      clearTimeout(timerId);
      reject(signal.reason);
    });
  });

describe('race condition between requests', () => {
  let fetchMock: jest.SpiedFunction<typeof fetch>;
  let states: SearchState[];

  const typeSlowQueryThenFastQuery = async (): Promise<void> => {
    const controller = createSearchController({
      delay: DELAY,
      onStateChange: (state) => states.push(state),
    });

    controller.setQuery('sp');
    await jest.advanceTimersByTimeAsync(DELAY);
    controller.setQuery('spain');
    await jest.advanceTimersByTimeAsync(DELAY + SLOW_RESPONSE_MS);
  };

  beforeEach(() => {
    jest.useFakeTimers();
    fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(delayedFetch);
    states = [];
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('sends both requests while the first one is still in flight', async () => {
    await typeSlowQueryThenFastQuery();

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://countries.dev/name/sp',
      'https://countries.dev/name/spain',
    ]);
  });

  it('aborts the outdated request', async () => {
    await typeSlowQueryThenFastQuery();

    const outdatedSignal = fetchMock.mock.calls[0][1]?.signal;
    const latestSignal = fetchMock.mock.calls[1][1]?.signal;

    expect(outdatedSignal?.aborted).toBe(true);
    expect(latestSignal?.aborted).toBe(false);
  });

  it('shows only the result of the latest query', async () => {
    await typeSlowQueryThenFastQuery();

    expect(states.at(-1)).toEqual({
      status: 'success',
      query: 'spain',
      countries: spainResponse.map(mapCountryResponse),
    });
  });

  it('never renders the outdated response', async () => {
    await typeSlowQueryThenFastQuery();

    const outdatedResults = states.filter(
      (state) => state.status === 'success' && state.query === 'sp',
    );

    expect(outdatedResults).toEqual([]);
  });

  it('does not show the aborted request as an error', async () => {
    await typeSlowQueryThenFastQuery();

    const errors = states.filter((state) => state.status === 'error');

    expect(errors).toEqual([]);
  });
});
