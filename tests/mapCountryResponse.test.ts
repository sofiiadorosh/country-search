import { mapCountryResponse } from '../src/core/mapCountryResponse';
import spainResponse from './fixtures/spain.json';
import antarcticaResponse from './fixtures/antarctica.json';
import svalbardResponse from './fixtures/svalbard.json';

const [spain] = spainResponse;
const [antarctica] = antarcticaResponse;
const [svalbard] = svalbardResponse;

describe('mapCountryResponse', () => {
  it('maps a full API response to country data', () => {
    expect(mapCountryResponse(spain)).toEqual({
      code: 'ESP',
      name: 'Spain',
      nativeName: 'España',
      flagUrl: 'https://flagcdn.com/es.svg',
      capital: 'Madrid',
      region: 'Europe',
      subregion: 'Southern Europe',
      population: 47351567,
      area: 505992,
      borders: ['AND', 'FRA', 'GIB', 'PRT', 'MAR'],
      languages: ['Spanish'],
      currencies: ['Euro'],
    });
  });

  it('maps languages to a list of names in the original order', () => {
    expect(mapCountryResponse(antarctica).languages).toEqual([
      'English',
      'Russian',
    ]);
  });

  it('returns null capital when the country has no capital', () => {
    expect(mapCountryResponse(antarctica).capital).toBeNull();
  });

  it('returns an empty currency list when the country has no currencies', () => {
    expect(mapCountryResponse(antarctica).currencies).toEqual([]);
  });

  it('returns an empty border list when the country has no borders', () => {
    expect(mapCountryResponse(antarctica).borders).toEqual([]);
  });

  it('returns null area when the country has no area', () => {
    expect(mapCountryResponse(svalbard).area).toBeNull();
  });

  it('does not mutate the raw response', () => {
    const raw = structuredClone(spain);

    mapCountryResponse(raw);

    expect(raw).toEqual(spain);
  });

  it('does not share arrays with the raw response', () => {
    const raw = structuredClone(spain);
    const country = mapCountryResponse(raw);

    country.borders.push('XXX');

    expect(raw.borders).toEqual(spain.borders);
  });

  it('returns the same result for the same input', () => {
    expect(mapCountryResponse(spain)).toEqual(mapCountryResponse(spain));
  });
});
