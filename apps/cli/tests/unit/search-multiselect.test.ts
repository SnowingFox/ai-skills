import type readline from 'node:readline';
import { describe, expect, it } from 'vitest';
import {
  filterSearchMultiselectItems,
  getToggleAllValues,
  isToggleAllKey,
  measureRenderedRows,
  type SearchMultiselectItem,
} from '../../src/prompts/search-multiselect';

describe('search multiselect helpers', () => {
  const items: SearchMultiselectItem<string>[] = [
    { label: 'alpha', value: 'one', hint: 'first skill' },
    { label: 'beta', value: 'two', hint: 'second skill' },
  ];

  it('measures wrapped terminal rows without counting ANSI escapes', () => {
    expect(measureRenderedRows(['short'], 80)).toBe(1);
    expect(measureRenderedRows(['abcdef'], 3)).toBe(2);
    expect(measureRenderedRows(['\x1b[32mabcdef\x1b[39m'], 3)).toBe(2);
  });

  it('detects option/meta+a without treating plain a as toggle all', () => {
    expect(isToggleAllKey(key({ name: 'a', sequence: 'a' }))).toBe(false);
    expect(isToggleAllKey(key({ meta: true, name: 'a' }))).toBe(true);
    expect(isToggleAllKey(key({ sequence: '\x1ba' }))).toBe(true);
    expect(isToggleAllKey(key({ sequence: 'å' }))).toBe(true);
  });

  it('toggles the filtered set when search is active', () => {
    expect(
      getToggleAllValues(filterSearchMultiselectItems(items, 'alp'))
    ).toEqual(['one']);
    expect(getToggleAllValues(filterSearchMultiselectItems(items, ''))).toEqual(
      ['one', 'two']
    );
  });
});

const key = (value: Partial<readline.Key>): readline.Key =>
  value as readline.Key;
