/**
 * An error whose message should be printed without the generic
 * "run --help" hint. Used for expected CLI failures (mutually exclusive
 * flags, missing required arguments, user cancellation) where the standard
 * stack trace and usage noise would be misleading.
 *
 * @example
 * throw new SilentError('--force and --skip-existing are mutually exclusive');
 * // stderr: "--force and --skip-existing are mutually exclusive"
 * // (no "Run ai-pkgs --help" suffix)
 */
export class SilentError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'SilentError';
    this.cause = options?.cause;
  }
}

/**
 * Extract a human-readable message from any thrown value.
 * Prefers `Error.message`; falls back to `String(error)`.
 */
export const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};
