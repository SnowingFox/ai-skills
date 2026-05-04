export class SilentError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'SilentError';
    this.cause = options?.cause;
  }
}

export const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};
