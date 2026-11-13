import { searchCountries } from '../src/api/searchCountries';
import { HttpError } from '../src/api/HttpError';
import { mapCountryResponse } from '../src/core/mapCountryResponse';
import spainResponse from './fixtures/spain.json';

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const pendingUntilAborted = (
  _input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => {
      reject(init.signal?.reason);
    });
  });

describe('searchCountries', () => {
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requests countries by name from countries.dev', async () => {
    fetchMock.mockResolvedValue(jsonResponse(spainResponse));

    await searchCountries('spain', new AbortController().signal);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://countries.dev/name/spain');
  });

  it('encodes the query in the URL', async () => {
    fetchMock.mockResolvedValue(jsonResponse(spainResponse));

    await searchCountries('united states', new AbortController().signal);

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://countries.dev/name/united%20states',
    );
  });

  it('returns mapped countries for a successful response', async () => {
    fetchMock.mockResolvedValue(jsonResponse(spainResponse));

    const countries = await searchCountries(
      'spain',
      new AbortController().signal,
    );

    expect(countries).toEqual(spainResponse.map(mapCountryResponse));
  });

  it('returns an empty list when the API responds with 404', async () => {
    fetchMock.mockResolvedValue(
      new Response('Country not found', { status: 404 }),
    );

    const countries = await searchCountries(
      'zzzz',
      new AbortController().signal,
    );

    expect(countries).toEqual([]);
  });

  it.each([400, 429, 500, 503])(
    'throws HttpError with status %i for an unsuccessful response',
    async (status) => {
      fetchMock.mockResolvedValue(new Response('Error', { status }));

      const request = searchCountries('spain', new AbortController().signal);

      await expect(request).rejects.toBeInstanceOf(HttpError);
      await expect(request).rejects.toMatchObject({ status });
    },
  );

  it('rethrows network errors', async () => {
    const networkError = new TypeError('Failed to fetch');
    fetchMock.mockRejectedValue(networkError);

    await expect(
      searchCountries('spain', new AbortController().signal),
    ).rejects.toBe(networkError);
  });

  it('rejects with AbortError when the caller aborts the request', async () => {
    fetchMock.mockImplementation(pendingUntilAborted);
    const controller = new AbortController();

    const request = searchCountries('spain', controller.signal);
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('rejects with TimeoutError when the request takes too long', async () => {
    fetchMock.mockImplementation(pendingUntilAborted);
    const timeoutController = new AbortController();
    jest
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(timeoutController.signal);

    const request = searchCountries('spain', new AbortController().signal);
    timeoutController.abort(
      new DOMException('The operation timed out.', 'TimeoutError'),
    );

    await expect(request).rejects.toMatchObject({ name: 'TimeoutError' });
  });

  it('does not abort the caller signal on timeout', async () => {
    fetchMock.mockImplementation(pendingUntilAborted);
    const timeoutController = new AbortController();
    jest
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(timeoutController.signal);
    const callerController = new AbortController();

    const request = searchCountries('spain', callerController.signal);
    timeoutController.abort(
      new DOMException('The operation timed out.', 'TimeoutError'),
    );

    await expect(request).rejects.toMatchObject({ name: 'TimeoutError' });
    expect(callerController.signal.aborted).toBe(false);
  });
});
