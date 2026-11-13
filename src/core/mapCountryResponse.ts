import type { Country, RawCountry } from './types';

export const mapCountryResponse = (raw: RawCountry): Country => ({
  code: raw.alpha3Code,
  name: raw.name,
  nativeName: raw.nativeName,
  flagUrl: raw.flags.svg,
  capital: raw.capital ?? null,
  region: raw.region,
  subregion: raw.subregion,
  population: raw.population,
  area: raw.area ?? null,
  borders: [...(raw.borders ?? [])],
  languages: raw.languages.map(({ name }) => name),
  currencies: (raw.currencies ?? []).map(({ name }) => name),
});
