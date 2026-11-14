import { createElement } from './dom';

export const createSearchField = (
  onInput: (value: string) => void,
): HTMLElement => {
  const input = createElement('input', {
    className: 'search-field__input',
    attrs: {
      id: 'country-search',
      type: 'search',
      placeholder: 'Search a country',
      autocomplete: 'off',
      spellcheck: 'false',
    },
  });

  input.addEventListener('input', () => onInput(input.value));

  return createElement('div', {
    className: 'search-field',
    children: [
      createElement('label', {
        className: 'visually-hidden',
        text: 'Country name',
        attrs: { for: 'country-search' },
      }),
      createElement('span', {
        className: 'search-field__icon',
        attrs: { 'aria-hidden': 'true' },
      }),
      input,
      createElement('span', {
        className: 'sticker sticker_red search-field__sticker',
        text: 'Live',
        attrs: { 'aria-hidden': 'true' },
      }),
    ],
  });
};
