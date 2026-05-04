import * as readline from 'node:readline';
import { Writable } from 'node:stream';
import pc from 'picocolors';

export const cancelSymbol = Symbol('cancel');

export type SearchMultiselectItem<T> = {
  label: string;
  value: T;
  hint?: string;
  separatorAfter?: boolean;
};

export type SearchMultiselectOptions<T> = {
  message: string;
  items: SearchMultiselectItem<T>[];
  initialSelected?: T[];
  maxVisible?: number;
  required?: boolean;
  enableToggleAll?: boolean;
};

const silentOutput = new Writable({
  write(_chunk, _encoding, callback) {
    callback();
  },
});

const ANSI_RE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
const DEFAULT_RENDER_COLUMNS = 80;
const MAX_RENDER_COLUMNS = 80;
const RENDER_COLUMN_SAFETY_MARGIN = 8;
const TRUNCATION_MARKER = '...';

/**
 * Searchable multiselect for long lists like agent targets.
 *
 * Clack's stock multiselect is excellent for short lists, but the full agent
 * matrix is long enough that users need type-to-filter behavior. This prompt
 * keeps the same keyboard model: type to search, arrows to move, space to
 * toggle, enter to confirm, esc/ctrl-c to cancel.
 */
export const searchMultiselect = async <T>({
  message,
  items,
  initialSelected = [],
  maxVisible = 12,
  required = false,
  enableToggleAll = false,
}: SearchMultiselectOptions<T>): Promise<T[] | typeof cancelSymbol> => {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: silentOutput,
      terminal: false,
    });

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    readline.emitKeypressEvents(process.stdin, rl);

    let query = '';
    let cursor = 0;
    let lastRenderHeight = 0;
    const selected = new Set<T>(initialSelected);

    const filteredItems = () => {
      return filterSearchMultiselectItems(items, query);
    };

    const clear = () => {
      if (lastRenderHeight === 0) {
        return;
      }

      process.stdout.write(`\x1b[${lastRenderHeight}A`);
      for (let index = 0; index < lastRenderHeight; index += 1) {
        process.stdout.write('\x1b[2K\x1b[1B');
      }
      process.stdout.write(`\x1b[${lastRenderHeight}A`);
    };

    const render = (state: 'active' | 'submit' | 'cancel' = 'active') => {
      clear();
      const visible = filteredItems();
      const renderColumns = resolvePromptRenderColumns(process.stdout.columns);
      cursor = Math.min(cursor, Math.max(visible.length - 1, 0));
      const icon =
        state === 'active'
          ? pc.green('◆')
          : state === 'submit'
            ? pc.green('◇')
            : pc.red('■');
      const lines = [`${icon}  ${pc.bold(message)}`];

      if (state === 'active') {
        lines.push(pc.dim('│'));
        lines.push(formatSearchMultiselectSearchLine(query, renderColumns));
        const hint = enableToggleAll
          ? 'Type to filter, ↑↓ move, space select, option+a toggle all, enter confirm'
          : 'Type to filter, ↑↓ move, space select, enter confirm';
        lines.push(formatSearchMultiselectPromptLine(hint, renderColumns));
        lines.push(pc.dim('│'));

        const start = Math.max(
          0,
          Math.min(
            cursor - Math.floor(maxVisible / 2),
            visible.length - maxVisible
          )
        );
        const page = visible.slice(start, start + maxVisible);
        const showSeparators = query.trim().length === 0;

        if (page.length === 0) {
          lines.push(`${pc.dim('│')}  ${pc.dim('No matches found')}`);
        } else {
          for (const [offset, item] of page.entries()) {
            const actualIndex = start + offset;
            lines.push(
              formatSearchMultiselectItemLine({
                item,
                active: actualIndex === cursor,
                checked: selected.has(item.value),
                columns: renderColumns,
              })
            );
            if (showSeparators && item.separatorAfter) {
              lines.push(
                `${pc.dim('│')}  ${pc.dim('─────────────────────────────────')}`
              );
            }
          }
        }

        lines.push(pc.dim('│'));
        lines.push(
          `${pc.dim('│')}  ${pc.green('Selected:')} ${
            selected.size === 0 ? pc.dim('(none)') : selected.size
          }`
        );
        lines.push(pc.dim('└'));
      } else {
        const selectedLabels = items
          .filter((item) => selected.has(item.value))
          .map((item) => item.label);
        lines.push(
          formatSearchMultiselectPromptLine(
            selectedLabels.join(', ') || 'Cancelled',
            renderColumns
          )
        );
      }

      process.stdout.write(`${lines.join('\n')}\n`);
      lastRenderHeight = measureRenderedRows(lines, renderColumns);
    };

    const cleanup = () => {
      process.stdin.removeListener('keypress', onKeypress);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      rl.close();
    };

    const submit = () => {
      if (required && selected.size === 0) {
        return;
      }
      render('submit');
      cleanup();
      resolve([...selected]);
    };

    const cancel = () => {
      render('cancel');
      cleanup();
      resolve(cancelSymbol);
    };

    const onKeypress = (_input: string, key: readline.Key) => {
      const visible = filteredItems();
      if (key.name === 'return') {
        submit();
        return;
      }
      if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
        cancel();
        return;
      }
      if (key.name === 'up') {
        cursor = Math.max(0, cursor - 1);
        render();
        return;
      }
      if (key.name === 'down') {
        cursor = Math.min(visible.length - 1, cursor + 1);
        render();
        return;
      }
      if (key.name === 'space') {
        const item = visible[cursor];
        if (item) {
          if (selected.has(item.value)) {
            selected.delete(item.value);
          } else {
            selected.add(item.value);
          }
        }
        render();
        return;
      }
      if (enableToggleAll && isToggleAllKey(key)) {
        const visibleValues = getToggleAllValues(visible);
        const allVisibleSelected =
          visibleValues.length > 0 &&
          visibleValues.every((value) => selected.has(value));
        if (allVisibleSelected) {
          for (const value of visibleValues) {
            selected.delete(value);
          }
        } else {
          for (const value of visibleValues) {
            selected.add(value);
          }
        }
        render();
        return;
      }
      if (key.name === 'backspace') {
        query = query.slice(0, -1);
        cursor = 0;
        render();
        return;
      }
      if (key.sequence && !key.ctrl && !key.meta && key.sequence.length === 1) {
        query += key.sequence;
        cursor = 0;
        render();
      }
    };

    process.stdin.on('keypress', onKeypress);
    render();
  });
};

/**
 * Filter prompt items by label, hint, or raw value text.
 */
export const filterSearchMultiselectItems = <T>(
  items: SearchMultiselectItem<T>[],
  query: string
): SearchMultiselectItem<T>[] => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return items;
  }

  return items.filter((item) =>
    [item.label, item.hint, String(item.value)]
      .filter(Boolean)
      .some((part) => part?.toLowerCase().includes(normalized))
  );
};

/**
 * Render one prompt chrome line within the same one-line width budget.
 */
export const formatSearchMultiselectPromptLine = (
  content: string,
  columns: number
): string => {
  const prefix = `${pc.dim('│')}  `;
  return `${prefix}${pc.dim(
    truncateToDisplayWidth(content, columns - getVisibleTextWidth(prefix))
  )}`;
};

/**
 * Render the search input row without allowing long queries to wrap.
 */
export const formatSearchMultiselectSearchLine = (
  query: string,
  columns: number
): string => {
  const prefix = `${pc.dim('│')}  ${pc.dim('Search:')} `;
  const cursor = pc.inverse(' ');
  const availableColumns =
    columns - getVisibleTextWidth(prefix) - getVisibleTextWidth(cursor);
  return `${prefix}${truncateToDisplayWidth(query, availableColumns)}${cursor}`;
};

/**
 * Render one selectable row, truncating hints before they can wrap.
 */
export const formatSearchMultiselectItemLine = <T>({
  item,
  active,
  checked,
  columns,
}: {
  item: SearchMultiselectItem<T>;
  active: boolean;
  checked: boolean;
  columns: number;
}): string => {
  const pointer = active ? pc.cyan('❯') : ' ';
  const checkbox = checked ? pc.green('●') : pc.dim('○');
  const label = active ? pc.underline(item.label) : item.label;
  const prefix = `${pc.dim('│')} ${pointer} ${checkbox} ${label}`;
  const hint = formatSearchMultiselectHint(
    item.hint,
    columns - getVisibleTextWidth(prefix)
  );

  return `${prefix}${hint}`;
};

/**
 * Format a hint suffix within the remaining one-line budget.
 */
export const formatSearchMultiselectHint = (
  hint: string | undefined,
  availableColumns: number
): string => {
  if (!hint) {
    return '';
  }

  const wrapperWidth = getVisibleTextWidth(' ()');
  const contentColumns = availableColumns - wrapperWidth;
  if (contentColumns <= TRUNCATION_MARKER.length) {
    return '';
  }

  return pc.dim(` (${truncateToDisplayWidth(hint, contentColumns)})`);
};

/**
 * Count terminal rows occupied by rendered prompt lines.
 *
 * Long descriptions wrap in the terminal, so clearing by logical line count
 * leaves stale wrapped rows behind. ANSI color sequences are ignored.
 */
export const measureRenderedRows = (lines: string[], columns = 80): number => {
  const width = Math.max(columns, 1);
  return lines.reduce((rows, line) => {
    const visibleWidth = getVisibleTextWidth(line);
    return rows + Math.max(1, Math.ceil(visibleWidth / width));
  }, 0);
};

/**
 * Truncate text by terminal display width and append `...` when shortened.
 */
export const truncateToDisplayWidth = (
  value: string,
  maxWidth: number
): string => {
  if (getVisibleTextWidth(value) <= maxWidth) {
    return value;
  }
  if (maxWidth <= 0) {
    return '';
  }
  if (maxWidth <= TRUNCATION_MARKER.length) {
    return TRUNCATION_MARKER.slice(0, maxWidth);
  }

  const contentWidthLimit = maxWidth - TRUNCATION_MARKER.length;
  let result = '';
  let usedWidth = 0;
  for (const char of Array.from(value)) {
    const charWidth = getCodePointWidth(char);
    if (usedWidth + charWidth > contentWidthLimit) {
      break;
    }
    result += char;
    usedWidth += charWidth;
  }

  return `${result}${TRUNCATION_MARKER}`;
};

/**
 * Measure printable terminal width, ignoring ANSI styling.
 */
export const getVisibleTextWidth = (value: string): number =>
  Array.from(value.replace(ANSI_RE, '')).reduce(
    (width, char) => width + getCodePointWidth(char),
    0
  );

/**
 * Use a conservative width when estimating rows for clearing old prompt frames.
 *
 * Some browser terminals report the full terminal column count even when the
 * prompt is rendered inside a narrower pane, so measuring at the reported width
 * can leave wrapped hint rows behind.
 */
export const resolvePromptRenderColumns = (
  columns = DEFAULT_RENDER_COLUMNS
): number => {
  const normalized =
    Number.isFinite(columns) && columns > 0
      ? Math.floor(columns)
      : DEFAULT_RENDER_COLUMNS;
  return Math.max(
    1,
    Math.min(normalized, MAX_RENDER_COLUMNS) - RENDER_COLUMN_SAFETY_MARGIN
  );
};

/**
 * Detect option/meta+a without stealing plain `a` from search input.
 */
export const isToggleAllKey = (key: readline.Key): boolean => {
  if (key.meta === true && key.name === 'a') {
    return true;
  }
  return key.sequence === '\x1ba' || key.sequence === 'å' || key.name === 'å';
};

/**
 * Return the values affected by toggle-all for the current filtered set.
 */
export const getToggleAllValues = <T>(items: SearchMultiselectItem<T>[]): T[] =>
  items.map((item) => item.value);

const getCodePointWidth = (char: string): number => {
  const codePoint = char.codePointAt(0);
  if (codePoint === undefined || codePoint === 0) {
    return 0;
  }
  if (codePoint < 32 || (codePoint >= 0x7f && codePoint < 0xa0)) {
    return 0;
  }
  if (isCombiningCodePoint(codePoint)) {
    return 0;
  }
  return isWideCodePoint(codePoint) ? 2 : 1;
};

const isCombiningCodePoint = (codePoint: number): boolean =>
  (codePoint >= 0x0300 && codePoint <= 0x036f) ||
  (codePoint >= 0x1ab0 && codePoint <= 0x1aff) ||
  (codePoint >= 0x1dc0 && codePoint <= 0x1dff) ||
  (codePoint >= 0x20d0 && codePoint <= 0x20ff) ||
  (codePoint >= 0xfe20 && codePoint <= 0xfe2f);

const isWideCodePoint = (codePoint: number): boolean =>
  (codePoint >= 0x1100 && codePoint <= 0x115f) ||
  codePoint === 0x2329 ||
  codePoint === 0x232a ||
  (codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
  (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
  (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
  (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
  (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
  (codePoint >= 0xff00 && codePoint <= 0xff60) ||
  (codePoint >= 0xffe0 && codePoint <= 0xffe6);
