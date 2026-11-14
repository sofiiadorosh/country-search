import {
  describeCountry,
  formatArea,
  formatList,
  formatNumber,
  formatOptional,
} from '../core/format';
import type { Country } from '../core/types';
import { createFlag } from './countryCard';
import { createElement } from './dom';
import { createModal } from './modal';
import { getRegionTheme } from './regionTheme';

const TITLE_ID = 'details-title';

type CountryDetails = {
  element: HTMLElement;
  open: (country: Country) => void;
};

const createWidget = (label: string, value: string): HTMLElement =>
  createElement('div', {
    className: 'widget',
    children: [
      createElement('dt', { className: 'widget__label', text: label }),
      createElement('dd', { className: 'widget__value', text: value }),
    ],
  });

const renderDetails = (
  country: Country,
  onClose: () => void,
): HTMLElement[] => {
  const closeButton = createElement('button', {
    className: 'details__close',
    attrs: { type: 'button', 'aria-label': 'Close details' },
  });

  closeButton.addEventListener('click', onClose);

  return [
    createElement('div', {
      className: 'tile__header details__header',
      children: [
        createElement('span', { text: 'Country details' }),
        closeButton,
      ],
    }),
    createElement('div', {
      className: 'details__body',
      children: [
        createElement('div', {
          className: 'details__hero',
          children: [
            createElement('div', {
              children: [
                createElement('h2', {
                  className: 'details__title',
                  text: country.name,
                  attrs: { id: TITLE_ID },
                }),
                createElement('p', {
                  className: 'details__subtitle',
                  text: `${country.subregion}, ${country.region}`,
                }),
              ],
            }),
            createFlag(country, 'details__flag'),
          ],
        }),
        createElement('p', {
          className: 'details__description',
          text: describeCountry(country),
        }),
        createElement('dl', {
          className: 'details__widgets',
          children: [
            createWidget('Capital', formatOptional(country.capital)),
            createWidget('Population', formatNumber(country.population)),
            createWidget('Area', formatArea(country.area)),
            createWidget('Borders', formatList(country.borders)),
            createWidget('Languages', formatList(country.languages)),
            createWidget('Currencies', formatList(country.currencies)),
          ],
        }),
      ],
    }),
  ];
};

export const createCountryDetails = (): CountryDetails => {
  const modal = createModal(TITLE_ID);

  const open = (country: Country): void => {
    modal.open(
      renderDetails(country, modal.close),
      `details tile tile_${getRegionTheme(country.region)}`,
    );
  };

  return { element: modal.element, open };
};
