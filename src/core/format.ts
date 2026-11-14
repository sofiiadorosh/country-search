import type { Country } from './types';

const EMPTY_VALUE = '—';

const numberFormat = new Intl.NumberFormat('en-US');

export const formatNumber = (value: number): string =>
  numberFormat.format(value);

export const formatArea = (area: number | null): string =>
  area === null ? EMPTY_VALUE : `${formatNumber(area)} km²`;

export const formatList = (items: readonly string[]): string =>
  items.length > 0 ? items.join(', ') : EMPTY_VALUE;

export const formatOptional = (value: string | null): string =>
  value ?? EMPTY_VALUE;

export const describeCountry = ({
  name,
  nativeName,
  capital,
  region,
  subregion,
}: Country): string => {
  const localName = nativeName && nativeName !== name ? ` (${nativeName})` : '';
  const capitalPart = capital ? ` Its capital is ${capital}.` : '';

  return `${name}${localName} is located in ${subregion}, ${region}.${capitalPart}`;
};
