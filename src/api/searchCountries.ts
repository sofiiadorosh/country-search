import { mapCountryResponse } from '../core/mapCountryResponse';
import type { Country, RawCountry } from '../core/types';
import {
  API_BASE_URL,
  NOT_FOUND_STATUS,
  REQUEST_TIMEOUT_MS,
} from './constants';
import { HttpError } from './HttpError';

const buildSearchUrl = (query: string): string =>
  `${API_BASE_URL}/name/${encodeURIComponent(query)}`;

export const searchCountries = async (
  query: string,
  signal: AbortSignal,
): Promise<Country[]> => {
  const response = await fetch(buildSearchUrl(query), {
    signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
  });

  if (response.status === NOT_FOUND_STATUS) {
    return [];
  }

  if (!response.ok) {
    throw new HttpError(response.status);
  }

  const data = (await response.json()) as RawCountry[];

  return data.map(mapCountryResponse);
};
