import { searchCountries } from '../api/searchCountries';
import { createCachedSearch } from '../core/createCachedSearch';
import { createSearchController } from '../core/createSearchController';
import { addToHistory } from '../core/searchHistory';
import type { SearchState } from '../core/types';
import { loadHistory, saveHistory } from '../storage/historyStorage';
import { createCountryDetails } from './countryDetails';
import { createElement } from './dom';
import { createSearchField } from './searchField';
import { createSearchHistory } from './searchHistory';
import { renderSearchState } from './searchResults';

export const startApp = (root: HTMLElement): void => {
  let history: readonly string[] = loadHistory();

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

  const rememberQuery = (query: string): void => {
    history = addToHistory(history, query);
    saveHistory(history);
    historyView.render(history);
  };

  const render = (state: SearchState): void => {
    if (state.status === 'success') {
      rememberQuery(state.query);
    }

    resultsContainer.replaceChildren(
      renderSearchState(state, {
        onRetry: () => controller.retry(),
        onSelect: details.open,
      }),
    );
  };

  const controller = createSearchController({
    search: createCachedSearch(searchCountries),
    onStateChange: render,
  });

  const searchField = createSearchField(controller.setQuery);

  const historyView = createSearchHistory((query) => {
    searchField.setValue(query);
    controller.searchNow(query);
  });

  const header = createElement('header', {
    className: 'header',
    children: [
      createElement('div', {
        className: 'container header__container',
        children: [
          createElement('h1', { className: 'logo', text: 'Country Search' }),
          searchField.element,
          historyView.element,
        ],
      }),
    ],
  });

  root.append(header, results, details.element);

  historyView.render(history);
  render(controller.getState());
};
