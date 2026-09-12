import { describe, expect, it } from 'vitest';
import { moveItem } from '../reorder.js';

describe('moveItem', () => {
  const list = ['a', 'b', 'c', 'd'];

  it('moves an item down', () => {
    expect(moveItem(list, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves an item up', () => {
    expect(moveItem(list, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('moves an item to either end', () => {
    expect(moveItem(list, 2, 0)).toEqual(['c', 'a', 'b', 'd']);
    expect(moveItem(list, 1, 3)).toEqual(['a', 'c', 'd', 'b']);
  });

  it('does nothing when the position does not change', () => {
    expect(moveItem(list, 2, 2)).toEqual(list);
  });

  it('does nothing when a position is off the end', () => {
    expect(moveItem(list, 0, 9)).toEqual(list);
    expect(moveItem(list, -1, 2)).toEqual(list);
  });

  it('never touches the list it was given', () => {
    const original = [...list];
    moveItem(list, 0, 3);
    expect(list).toEqual(original);
  });

  it('keeps every item, however it is moved', () => {
    for (let from = 0; from < list.length; from += 1) {
      for (let to = 0; to < list.length; to += 1) {
        expect([...moveItem(list, from, to)].sort()).toEqual([...list].sort());
      }
    }
  });
});
