import { createSearchController } from '../core/createSearchController';
import type { SearchState } from '../core/types';
import { createCountryDetails } from './countryDetails';
import { createElement } from './dom';
import { createSearchField } from './searchField';
import { renderSearchState } from './searchResults';

const createHeader = (onInput: (value: string) => void): HTMLElement =>
  createElement('header', {
    className: 'header',
    children: [
      createElement('div', {
        className: 'container header__container',
        children: [
          createElement('h1', { className: 'logo', text: 'Country Search' }),
          createSearchField(onInput),
        ],
      }),
    ],
  });

export const startApp = (root: HTMLElement): void => {
  const resultsContainer = createElement('div', {
    className: 'container',
    attrs: { 'aria-live': 'polite' },
  });
  const results = createElement('section', {
    className: 'results',
    attrs: { 'aria-label': 'Search results' },
    children: [resultsContainer],
  });
  const details = createCountryDetails();

  const render = (state: SearchState): void => {
    resultsContainer.replaceChildren(
      renderSearchState(state, {
        onRetry: () => controller.retry(),
        onSelect: details.open,
      }),
    );
  };

  const controller = createSearchController({ onStateChange: render });

  root.append(createHeader(controller.setQuery), results, details.element);

  render(controller.getState());
};
