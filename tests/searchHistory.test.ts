import { addToHistory } from '../src/core/searchHistory';

describe('addToHistory', () => {
  it('adds a query to an empty history', () => {
    expect(addToHistory([], 'spain')).toEqual(['spain']);
  });

  it('puts the newest query first', () => {
    expect(addToHistory(['spain'], 'france')).toEqual(['france', 'spain']);
  });

  it('moves a repeated query to the front instead of duplicating it', () => {
    expect(addToHistory(['france', 'spain', 'japan'], 'spain')).toEqual([
      'spain',
      'france',
      'japan',
    ]);
  });

  it('treats queries that differ only in letter case as the same', () => {
    expect(addToHistory(['france', 'spain'], 'Spain')).toEqual([
      'Spain',
      'france',
    ]);
  });

  it('trims the query', () => {
    expect(addToHistory([], '  spain  ')).toEqual(['spain']);
  });

  it.each(['', '   '])('ignores an empty query %p', (query) => {
    const history = ['spain'];

    expect(addToHistory(history, query)).toBe(history);
  });

  it('keeps only the five latest queries by default', () => {
    const history = ['e', 'd', 'c', 'b', 'a'];

    expect(addToHistory(history, 'f')).toEqual(['f', 'e', 'd', 'c', 'b']);
  });

  it('keeps the given number of latest queries', () => {
    expect(addToHistory(['b', 'a'], 'c', 2)).toEqual(['c', 'b']);
  });

  it('does not mutate the original history', () => {
    const history = ['france', 'spain'];

    addToHistory(history, 'japan');

    expect(history).toEqual(['france', 'spain']);
  });
});
