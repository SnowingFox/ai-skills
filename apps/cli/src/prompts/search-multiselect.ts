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
        lines.push(
          `${pc.dim('│')}  ${pc.dim('Search:')} ${query}${pc.inverse(' ')}`
        );
        const hint = enableToggleAll
          ? 'Type to filter, ↑↓ move, space select, option+a toggle all, enter confirm'
          : 'Type to filter, ↑↓ move, space select, enter confirm';
        lines.push(`${pc.dim('│')}  ${pc.dim(hint)}`);
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
            const pointer = actualIndex === cursor ? pc.cyan('❯') : ' ';
            const checkbox = selected.has(item.value)
              ? pc.green('●')
              : pc.dim('○');
            const label =
              actualIndex === cursor ? pc.underline(item.label) : item.label;
            const hint = item.hint ? pc.dim(` (${item.hint})`) : '';
            lines.push(`${pc.dim('│')} ${pointer} ${checkbox} ${label}${hint}`);
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
          `${pc.dim('│')}  ${pc.dim(selectedLabels.join(', ') || 'Cancelled')}`
        );
      }

      process.stdout.write(`${lines.join('\n')}\n`);
      lastRenderHeight = measureRenderedRows(lines, process.stdout.columns);
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
 * Count terminal rows occupied by rendered prompt lines.
 *
 * Long descriptions wrap in the terminal, so clearing by logical line count
 * leaves stale wrapped rows behind. ANSI color sequences are ignored.
 */
export const measureRenderedRows = (lines: string[], columns = 80): number => {
  const width = Math.max(columns, 1);
  return lines.reduce((rows, line) => {
    const visibleWidth = line.replace(ANSI_RE, '').length;
    return rows + Math.max(1, Math.ceil(visibleWidth / width));
  }, 0);
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
