import { HttpError } from '../src/api/HttpError';

describe('HttpError', () => {
  it('is an instance of Error', () => {
    expect(new HttpError(500)).toBeInstanceOf(Error);
  });

  it('is an instance of HttpError', () => {
    expect(new HttpError(500)).toBeInstanceOf(HttpError);
  });

  it('stores the response status', () => {
    expect(new HttpError(503).status).toBe(503);
  });

  it('has the name HttpError', () => {
    expect(new HttpError(500).name).toBe('HttpError');
  });

  it('includes the status in the message', () => {
    expect(new HttpError(502).message).toContain('502');
  });
});
