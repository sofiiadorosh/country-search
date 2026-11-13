import { classifyError } from '../api/classifyError';
import { searchCountries } from '../api/searchCountries';
import { DEBOUNCE_DELAY_MS } from './constants';
import { debounce } from './debounce';
import type { Country, SearchState } from './types';

type SearchFn = (query: string, signal: AbortSignal) => Promise<Country[]>;

type SearchControllerOptions = {
  search?: SearchFn;
  delay?: number;
  onStateChange?: (state: SearchState) => void;
};

export type SearchController = {
  setQuery: (input: string) => void;
  retry: () => void;
  getState: () => SearchState;
};

export const createSearchController = ({
  search = searchCountries,
  delay = DEBOUNCE_DELAY_MS,
  onStateChange = () => {},
}: SearchControllerOptions = {}): SearchController => {
  let state: SearchState = { status: 'idle' };
  let lastQuery = '';
  let activeRequest: AbortController | null = null;

  const setState = (nextState: SearchState): void => {
    state = nextState;
    onStateChange(state);
  };

  const abortActiveRequest = (): void => {
    activeRequest?.abort();
    activeRequest = null;
  };

  const runSearch = async (query: string): Promise<void> => {
    if (!query) {
      return;
    }

    const request = new AbortController();
    activeRequest = request;

    try {
      const countries = await search(query, request.signal);

      if (request.signal.aborted) {
        return;
      }

      setState(
        countries.length > 0
          ? { status: 'success', query, countries }
          : { status: 'not-found', query },
      );
    } catch (error) {
      const errorKind = classifyError(error);

      if (errorKind === 'abort') {
        return;
      }

      setState({ status: 'error', query, errorKind });
    }
  };

  const debouncedSearch = debounce(runSearch, delay);

  const setQuery = (input: string): void => {
    const query = input.trim();

    if (query === lastQuery) {
      return;
    }

    lastQuery = query;
    abortActiveRequest();
    debouncedSearch(query);

    setState(query ? { status: 'loading', query } : { status: 'idle' });
  };

  const retry = (): void => {
    if (!lastQuery) {
      return;
    }

    abortActiveRequest();
    setState({ status: 'loading', query: lastQuery });
    void runSearch(lastQuery);
  };

  return {
    setQuery,
    retry,
    getState: () => state,
  };
};
