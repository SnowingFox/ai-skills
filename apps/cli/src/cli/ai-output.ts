import pc from 'picocolors';

/** Format a progress line for `--ai` output using Clack-style box drawing. */
export const renderAiStep = (message: string): string =>
  `${pc.gray('│')}\n${pc.green('◇')}  ${message}\n`;

/** Format a completion/done line for `--ai` output using Clack-style box drawing. */
export const renderAiDone = (message: string): string =>
  `${pc.gray('│')}\n${pc.green('◆')}  ${message}\n`;
