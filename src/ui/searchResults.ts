import type { Country, SearchState } from '../core/types';
import { createCountryCard } from './countryCard';
import { createElement } from './dom';
import { ERROR_MESSAGES } from './messages';

type ResultHandlers = {
  onRetry: () => void;
  onSelect: (country: Country) => void;
};

const createMessage = (
  theme: string,
  header: string,
  title: string,
  hint: string,
): HTMLElement =>
  createElement('div', {
    className: `tile message tile_${theme}`,
    children: [
      createElement('p', { className: 'tile__header', text: header }),
      createElement('div', {
        className: 'message__body',
        children: [
          createElement('p', { className: 'message__title', text: title }),
          createElement('p', { className: 'message__hint', text: hint }),
        ],
      }),
    ],
  });

const renderLoading = (query: string): HTMLElement =>
  createElement('div', {
    className: 'tile message tile_purple',
    attrs: { role: 'status' },
    children: [
      createElement('p', { className: 'tile__header', text: 'Searching' }),
      createElement('div', {
        className: 'message__body',
        children: [
          createElement('span', {
            className: 'spinner',
            attrs: { 'aria-hidden': 'true' },
          }),
          createElement('p', {
            className: 'message__title',
            text: `Looking for “${query}”…`,
          }),
        ],
      }),
    ],
  });

const renderError = (
  state: Extract<SearchState, { status: 'error' }>,
  onRetry: () => void,
): HTMLElement => {
  const retryButton = createElement('button', {
    className: 'button',
    text: 'Retry',
    attrs: { type: 'button' },
  });

  retryButton.addEventListener('click', onRetry);

  return createElement('div', {
    className: 'alert',
    attrs: { role: 'alert' },
    children: [
      createElement('span', {
        className: 'alert__icon',
        text: '!',
        attrs: { 'aria-hidden': 'true' },
      }),
      createElement('div', {
        className: 'alert__text',
        children: [
          createElement('p', {
            className: 'alert__title',
            text: ERROR_MESSAGES[state.errorKind],
          }),
          createElement('p', {
            className: 'alert__hint',
            text: `Your search for “${state.query}” did not finish.`,
          }),
        ],
      }),
      retryButton,
    ],
  });
};

const renderCountries = (
  countries: readonly Country[],
  onSelect: (country: Country) => void,
): HTMLElement =>
  createElement('div', {
    className: 'results__found',
    children: [
      createElement('h2', {
        className: 'section-label',
        text: `Results · ${countries.length} ${countries.length === 1 ? 'country' : 'countries'}`,
      }),
      createElement('ul', {
        className: 'results__list',
        children: countries.map((country) =>
          createCountryCard(country, onSelect),
        ),
      }),
    ],
  });

export const renderSearchState = (
  state: SearchState,
  { onRetry, onSelect }: ResultHandlers,
): HTMLElement => {
  switch (state.status) {
    case 'idle':
      return createMessage(
        'blue',
        'Start here',
        'Start typing to find a country.',
        'Results update as you type.',
      );
    case 'loading':
      return renderLoading(state.query);
    case 'not-found':
      return createMessage(
        'yellow',
        'No matches',
        `No countries match “${state.query}”.`,
        'Check the spelling or try another name.',
      );
    case 'error':
      return renderError(state, onRetry);
    case 'success':
      return renderCountries(state.countries, onSelect);
  }
};
