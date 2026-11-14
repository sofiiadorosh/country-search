import type { VisibleErrorKind } from '../core/types';

export const ERROR_MESSAGES: Record<VisibleErrorKind, string> = {
  timeout: 'The server took too long to respond.',
  http: 'The server responded with an error.',
  network: 'Could not reach the server. Check your internet connection.',
  unknown: 'Something went wrong.',
};
