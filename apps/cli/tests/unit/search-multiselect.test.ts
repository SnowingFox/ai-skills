import type readline from 'node:readline';
import { describe, expect, it } from 'vitest';
import {
  filterSearchMultiselectItems,
  formatSearchMultiselectItemLine,
  formatSearchMultiselectPromptLine,
  formatSearchMultiselectSearchLine,
  getToggleAllValues,
  getVisibleTextWidth,
  isToggleAllKey,
  measureRenderedRows,
  resolvePromptRenderColumns,
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

  it('uses conservative columns when clearing prompt frames', () => {
    expect(resolvePromptRenderColumns(120)).toBe(72);
    expect(resolvePromptRenderColumns(80)).toBe(72);
    expect(resolvePromptRenderColumns(12)).toBe(4);
    expect(resolvePromptRenderColumns()).toBe(72);
  });

  it('over-counts long hint rows when terminals report wide columns', () => {
    const longHint =
      '│ ❯ ○ lynx-code-review (Provides detailed code review and suggestions for improving code quality)';
    const reportedRows = measureRenderedRows([longHint], 120);
    const conservativeRows = measureRenderedRows(
      [longHint],
      resolvePromptRenderColumns(120)
    );

    expect(reportedRows).toBe(1);
    expect(conservativeRows).toBeGreaterThan(reportedRows);
  });

  it('keeps short hints unchanged in one-line option rows', () => {
    const row = stripAnsi(
      formatSearchMultiselectItemLine({
        item: items[0]!,
        active: true,
        checked: false,
        columns: 72,
      })
    );

    expect(row).toContain('alpha (first skill)');
    expect(row).not.toContain('...');
  });

  it('truncates long English hints before they wrap', () => {
    const row = formatSearchMultiselectItemLine({
      item: {
        label: 'ttml',
        value: 'ttml',
        hint: 'Use for TTML template development in Lynx projects and platform concepts',
      },
      active: false,
      checked: false,
      columns: 42,
    });

    expect(stripAnsi(row)).toContain('...');
    expect(getVisibleTextWidth(row)).toBeLessThanOrEqual(42);
    expect(measureRenderedRows([row], 42)).toBe(1);
  });

  it('truncates CJK hints conservatively before they wrap', () => {
    const row = formatSearchMultiselectItemLine({
      item: {
        label: 'perflab-ci',
        value: 'perflab-ci',
        hint: '为项目配置自动化性能测试并提交 MR',
      },
      active: false,
      checked: false,
      columns: 38,
    });

    expect(stripAnsi(row)).toContain('...');
    expect(getVisibleTextWidth(row)).toBeLessThanOrEqual(38);
    expect(measureRenderedRows([row], 38)).toBe(1);
  });

  it('truncates prompt chrome lines to the render width', () => {
    const helpLine = formatSearchMultiselectPromptLine(
      'Type to filter, ↑↓ move, space select, option+a toggle all, enter confirm',
      48
    );
    const searchLine = formatSearchMultiselectSearchLine(
      'a very long search query that would otherwise wrap',
      48
    );

    expect(stripAnsi(helpLine)).toContain('...');
    expect(stripAnsi(searchLine)).toContain('...');
    expect(getVisibleTextWidth(helpLine)).toBeLessThanOrEqual(48);
    expect(getVisibleTextWidth(searchLine)).toBeLessThanOrEqual(48);
    expect(measureRenderedRows([helpLine, searchLine], 48)).toBe(2);
  });

  it('measures a representative prompt frame as fixed-height rows', () => {
    const columns = 48;
    const frame = [
      '◆  Select skills to add',
      '│',
      formatSearchMultiselectSearchLine('', columns),
      formatSearchMultiselectPromptLine(
        'Type to filter, ↑↓ move, space select, option+a toggle all, enter confirm',
        columns
      ),
      '│',
      formatSearchMultiselectItemLine({
        item: {
          label: 'lynx-code-review',
          value: 'lynx-code-review',
          hint: 'Provides detailed code review and suggestions for improving code quality',
        },
        active: true,
        checked: false,
        columns,
      }),
      formatSearchMultiselectItemLine({
        item: {
          label: 'ttml',
          value: 'ttml',
          hint: 'Use for TTML template development in Lynx projects',
        },
        active: false,
        checked: false,
        columns,
      }),
      '│',
      '│  Selected: (none)',
      '└',
    ];

    expect(measureRenderedRows(frame, columns)).toBe(frame.length);
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

const ANSI_RE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
const stripAnsi = (value: string): string => value.replace(ANSI_RE, '');

const key = (value: Partial<readline.Key>): readline.Key =>
  value as readline.Key;
