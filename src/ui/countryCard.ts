import { formatNumber, formatOptional } from '../core/format';
import type { Country } from '../core/types';
import { createElement } from './dom';
import { getRegionTheme } from './regionTheme';

export const createFlag = (
  country: Country,
  className: string,
): HTMLImageElement =>
  createElement('img', {
    className,
    attrs: {
      src: country.flagUrl,
      alt: `Flag of ${country.name}`,
      loading: 'lazy',
      width: '320',
      height: '200',
    },
  });

const createFact = (label: string, value: string): HTMLElement =>
  createElement('div', {
    className: 'country-card__fact',
    children: [
      createElement('dt', { className: 'country-card__label', text: label }),
      createElement('dd', { className: 'country-card__value', text: value }),
    ],
  });

export const createCountryCard = (
  country: Country,
  onSelect: (country: Country) => void,
): HTMLElement => {
  const detailsButton = createElement('button', {
    className: 'round-button country-card__more',
    attrs: {
      type: 'button',
      'aria-label': `More details about ${country.name}`,
    },
  });

  detailsButton.addEventListener('click', () => onSelect(country));

  return createElement('li', {
    className: `tile country-card tile_${getRegionTheme(country.region)}`,
    children: [
      createElement('p', { className: 'tile__header', text: country.region }),
      createElement('div', {
        className: 'country-card__body',
        children: [
          createElement('div', {
            className: 'country-card__top',
            children: [
              createElement('h3', {
                className: 'country-card__name',
                text: country.name,
              }),
              createFlag(country, 'country-card__flag'),
            ],
          }),
          createElement('dl', {
            className: 'country-card__facts',
            children: [
              createFact('Capital', formatOptional(country.capital)),
              createFact('Population', formatNumber(country.population)),
            ],
          }),
          detailsButton,
        ],
      }),
    ],
  });
};
