const REGION_THEMES: Record<string, string> = {
  Europe: 'blue',
  Asia: 'orange',
  Americas: 'purple',
  Africa: 'yellow',
  Oceania: 'green',
};

const DEFAULT_THEME = 'grey';

export const getRegionTheme = (region: string): string =>
  REGION_THEMES[region] ?? DEFAULT_THEME;
