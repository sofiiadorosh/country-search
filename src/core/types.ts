export type RawLanguage = {
  name: string;
};

export type RawCurrency = {
  code: string;
  name: string;
  symbol: string;
};

export type RawCountry = {
  alpha3Code: string;
  name: string;
  nativeName: string;
  flags: {
    svg: string;
    png: string;
  };
  capital?: string;
  region: string;
  subregion: string;
  population: number;
  area?: number;
  borders?: string[];
  languages: RawLanguage[];
  currencies?: RawCurrency[];
};

export type Country = {
  code: string;
  name: string;
  nativeName: string;
  flagUrl: string;
  capital: string | null;
  region: string;
  subregion: string;
  population: number;
  area: number | null;
  borders: string[];
  languages: string[];
  currencies: string[];
};
