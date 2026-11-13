import { debounce } from '../src/core/debounce';

const DELAY = 300;

describe('debounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not call the function immediately', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, DELAY);

    debounced();

    expect(fn).not.toHaveBeenCalled();
  });

  it('does not call the function before the delay has passed', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, DELAY);

    debounced();
    jest.advanceTimersByTime(DELAY - 1);

    expect(fn).not.toHaveBeenCalled();
  });

  it('calls the function once after the delay', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, DELAY);

    debounced();
    jest.advanceTimersByTime(DELAY);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('passes the arguments to the function', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, DELAY);

    debounced('spain', 42);
    jest.advanceTimersByTime(DELAY);

    expect(fn).toHaveBeenCalledWith('spain', 42);
  });

  it('resets the timer when called again within the delay', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, DELAY);

    debounced();
    jest.advanceTimersByTime(DELAY - 1);
    debounced();
    jest.advanceTimersByTime(DELAY - 1);

    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('calls the function only with the arguments of the last call', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, DELAY);

    debounced('s');
    debounced('sp');
    debounced('spain');
    jest.advanceTimersByTime(DELAY);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('spain');
  });

  it('calls the function again for calls separated by more than the delay', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, DELAY);

    debounced('first');
    jest.advanceTimersByTime(DELAY);
    debounced('second');
    jest.advanceTimersByTime(DELAY);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, 'first');
    expect(fn).toHaveBeenNthCalledWith(2, 'second');
  });

  it('keeps independent timers for separately debounced functions', () => {
    const first = jest.fn();
    const second = jest.fn();
    const debouncedFirst = debounce(first, DELAY);
    const debouncedSecond = debounce(second, DELAY);

    debouncedFirst();
    jest.advanceTimersByTime(DELAY - 1);
    debouncedSecond();
    jest.advanceTimersByTime(1);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });
});
