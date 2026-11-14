import { classifyError } from '../src/api/classifyError';
import { HttpError } from '../src/api/HttpError';

describe('classifyError', () => {
  describe('abort', () => {
    it('classifies an AbortError DOMException as abort', () => {
      const error = new DOMException(
        'The operation was aborted.',
        'AbortError',
      );

      expect(classifyError(error)).toBe('abort');
    });

    it('classifies the reason of an aborted controller as abort', () => {
      const controller = new AbortController();
      controller.abort();

      expect(classifyError(controller.signal.reason)).toBe('abort');
    });

    it('classifies an Error named AbortError as abort', () => {
      const error = new Error('Aborted');
      error.name = 'AbortError';

      expect(classifyError(error)).toBe('abort');
    });
  });

  describe('timeout', () => {
    it('classifies a TimeoutError DOMException as timeout', () => {
      const error = new DOMException(
        'The operation timed out.',
        'TimeoutError',
      );

      expect(classifyError(error)).toBe('timeout');
    });

    it('does not confuse timeout with abort', () => {
      const timeout = new DOMException('Timed out', 'TimeoutError');
      const abort = new DOMException('Aborted', 'AbortError');

      expect(classifyError(timeout)).not.toBe(classifyError(abort));
    });
  });

  describe('http', () => {
    it.each([400, 429, 500, 503])(
      'classifies HttpError with status %i as http',
      (status) => {
        expect(classifyError(new HttpError(status))).toBe('http');
      },
    );
  });

  describe('network', () => {
    it('classifies a fetch TypeError as network', () => {
      expect(classifyError(new TypeError('Failed to fetch'))).toBe('network');
    });
  });

  describe('unknown', () => {
    it('classifies a generic Error as unknown', () => {
      expect(classifyError(new Error('Something went wrong'))).toBe('unknown');
    });

    it('classifies an invalid JSON error as unknown', () => {
      expect(classifyError(new SyntaxError('Unexpected token'))).toBe(
        'unknown',
      );
    });

    it.each([['a string'], [null], [undefined], [42], [{}]])(
      'classifies a non-error value %p as unknown',
      (value) => {
        expect(classifyError(value)).toBe('unknown');
      },
    );
  });
});
