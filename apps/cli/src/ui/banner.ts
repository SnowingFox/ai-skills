/**
 * ASCII banner for AI-PKGS CLI.
 *
 * The shape mirrors Story's checked-in banner renderer, while the colors
 * match `submodule/skills`: a row-by-row 256-color grayscale ramp that gives
 * the ANSI-shadow art visible depth on dark and light terminal themes.
 */

/**
 * Block-art rendering of "AI-PKGS" (6 rows). Generated once and checked in so
 * runtime startup does not need a figlet dependency.
 */
export const BANNER_LINES: readonly string[] = Object.freeze([
  ' █████╗ ██╗      ██████╗ ██╗  ██╗ ██████╗ ███████╗',
  '██╔══██╗██║      ██╔══██╗██║ ██╔╝██╔════╝ ██╔════╝',
  '███████║██║█████╗██████╔╝█████╔╝ ██║  ███╗███████╗',
  '██╔══██║██║╚════╝██╔═══╝ ██╔═██╗ ██║   ██║╚════██║',
  '██║  ██║██║      ██║     ██║  ██╗╚██████╔╝███████║',
  '╚═╝  ╚═╝╚═╝      ╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚══════╝',
]);

/**
 * 256-color middle grays, copied from `submodule/skills` for the same shadow
 * treatment and cross-theme readability.
 */
export const GRAYS: readonly string[] = Object.freeze([
  '\x1B[38;5;250m',
  '\x1B[38;5;248m',
  '\x1B[38;5;245m',
  '\x1B[38;5;243m',
  '\x1B[38;5;240m',
  '\x1B[38;5;238m',
]);

const RESET = '\x1B[0m';

/** Select the ANSI gray prefix by banner row index. */
export function gray(index: number): string {
  return GRAYS[index] ?? '';
}

/** Apply the grayscale ramp to each banner line. */
export function renderBannerLines(): string[] {
  return BANNER_LINES.map((line, index) => {
    const prefix = gray(index);
    const suffix = prefix === '' ? '' : RESET;
    return `${prefix}${line}${suffix}`;
  });
}

/** Join colored banner lines into a single printable string. */
export function renderLogo(): string {
  return renderBannerLines().join('\n');
}

/**
 * Write the colored banner to a stream when it's a TTY. Pass `force: true`
 * to skip the TTY check.
 */
export function banner(
  out: NodeJS.WritableStream = process.stdout,
  force = false
): void {
  if (!force && !isWritableTTY(out)) {
    return;
  }

  for (const line of renderBannerLines()) {
    out.write(`${line}\n`);
  }
  out.write('\n');
}

function isWritableTTY(out: NodeJS.WritableStream): boolean {
  return (out as unknown as { isTTY?: boolean }).isTTY === true;
}
