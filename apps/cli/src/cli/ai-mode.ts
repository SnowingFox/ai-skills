/** Options bag for detecting `--ai` / automation mode. */
export type AiModeOptions = {
  ai?: boolean;
};

/**
 * True when the command is running in strict AI/automation mode.
 *
 * AI mode never chooses defaults that would normally be asked through a TTY
 * prompt. Callers must pass explicit flags such as `--agent`, `--skill`,
 * `--force`, `--skip-existing`, or `--yes` depending on the command.
 */
export const isAICommand = (options: AiModeOptions): boolean =>
  options.ai === true;

/**
 * True when TTY prompts are allowed: not in AI mode and stdin is a TTY.
 */
export const canPrompt = (options: AiModeOptions): boolean =>
  !isAICommand(options) && process.stdin.isTTY === true;
