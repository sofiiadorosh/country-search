import { createElement } from './dom';

type SearchHistoryView = {
  element: HTMLElement;
  render: (history: readonly string[]) => void;
};

const createHistoryItem = (
  query: string,
  onSelect: (query: string) => void,
): HTMLElement => {
  const button = createElement('button', {
    className: 'history__item',
    text: query,
    attrs: { type: 'button' },
  });

  button.addEventListener('click', () => onSelect(query));

  return createElement('li', { children: [button] });
};

export const createSearchHistory = (
  onSelect: (query: string) => void,
): SearchHistoryView => {
  const list = createElement('ul', { className: 'history__list' });

  const element = createElement('nav', {
    className: 'history',
    attrs: { 'aria-label': 'Recent searches' },
    children: [
      createElement('p', { className: 'history__label', text: 'Recent' }),
      list,
    ],
  });

  const render = (history: readonly string[]): void => {
    element.hidden = history.length === 0;
    list.replaceChildren(
      ...history.map((query) => createHistoryItem(query, onSelect)),
    );
  };

  return { element, render };
};
