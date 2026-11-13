import { HttpError } from './HttpError';

export type ErrorKind = 'abort' | 'timeout' | 'http' | 'network' | 'unknown';

const hasErrorName = (error: unknown, name: string): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'name' in error &&
  error.name === name;

export const classifyError = (error: unknown): ErrorKind => {
  if (hasErrorName(error, 'AbortError')) {
    return 'abort';
  }

  if (hasErrorName(error, 'TimeoutError')) {
    return 'timeout';
  }

  if (error instanceof HttpError) {
    return 'http';
  }

  if (error instanceof TypeError) {
    return 'network';
  }

  return 'unknown';
};
