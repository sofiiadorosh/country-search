import { createElement } from './dom';

const MODAL_CLASS = 'modal';
const OPENED_CLASS = 'backdrop_opened';
const SCROLL_LOCK_CLASS = 'scroll-locked';

type Modal = {
  element: HTMLElement;
  open: (content: readonly Node[], className?: string) => void;
  close: () => void;
};

export const createModal = (labelledBy: string): Modal => {
  const modal = createElement('div', {
    className: MODAL_CLASS,
    attrs: {
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': labelledBy,
    },
  });

  const backdrop = createElement('div', {
    className: 'backdrop',
    attrs: { 'aria-hidden': 'true' },
    children: [modal],
  });

  let lastFocused: Element | null = null;

  const setPageInert = (isInert: boolean): void => {
    const page = backdrop.parentElement?.children ?? [];

    Array.from(page).forEach((node) => {
      if (node !== backdrop && node instanceof HTMLElement) {
        node.inert = isInert;
      }
    });
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      close();
    }
  };

  const open = (content: readonly Node[], className = ''): void => {
    lastFocused = document.activeElement;
    modal.className = `${MODAL_CLASS} ${className}`.trim();
    modal.replaceChildren(...content);

    backdrop.classList.add(OPENED_CLASS);
    backdrop.setAttribute('aria-hidden', 'false');
    document.body.classList.add(SCROLL_LOCK_CLASS);
    setPageInert(true);
    document.addEventListener('keydown', handleKeyDown);

    modal.querySelector('button')?.focus();
  };

  const close = (): void => {
    if (!backdrop.classList.contains(OPENED_CLASS)) {
      return;
    }

    backdrop.classList.remove(OPENED_CLASS);
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.classList.remove(SCROLL_LOCK_CLASS);
    setPageInert(false);
    document.removeEventListener('keydown', handleKeyDown);

    if (lastFocused instanceof HTMLElement) {
      lastFocused.focus();
    }
  };

  backdrop.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) {
      close();
    }
  });

  return { element: backdrop, open, close };
};
