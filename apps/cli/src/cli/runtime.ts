import type { CAC } from 'cac';
import { SilentError, formatError } from '../errors';
import { renderHelp } from './help';

/**
 * Parse and execute a configured cac instance with one top-level error policy.
 * `SilentError` messages are printed without extra help text; unexpected
 * errors keep the usage hint so command wiring failures remain diagnosable.
 */
export const runParsedCli = async (
  cli: CAC,
  argv: string[]
): Promise<number> => {
  try {
    if (isBareInvocation(argv)) {
      process.stdout.write(renderHelp(cli));
      return 0;
    }

    cli.parse(argv, { run: false });
    if (
      cli.matchedCommandName === undefined &&
      argv.slice(2).length > 0 &&
      !hasHelpFlag(argv)
    ) {
      process.stderr.write(`Unknown command: ${argv.slice(2).join(' ')}\n`);
      process.stderr.write('Run ai-pkgs --help for usage.\n');
      return 1;
    }

    return await resolveCliResult(cli.runMatchedCommand());
  } catch (error) {
    process.stderr.write(`${formatCliError(error)}\n`);
    if (error instanceof SilentError) {
      process.stderr.write(`${formatDetailedUsageHint(cli)}\n`);
    }
    if (!(error instanceof SilentError)) {
      process.stderr.write('Run ai-pkgs --help for usage.\n');
    }
    return 1;
  }
};

export const resolveCliResult = async (result: unknown): Promise<number> => {
  if (isPromiseLike(result)) {
    return (await result) as number;
  }

  if (typeof result === 'number') {
    return result;
  }

  return 0;
};

export const formatCliError = (error: unknown): string => formatError(error);

const isBareInvocation = (argv: string[]): boolean =>
  argv.slice(2).length === 0;

const hasHelpFlag = (argv: string[]): boolean =>
  argv.includes('--help') || argv.includes('-h');

const formatDetailedUsageHint = (cli: CAC): string => {
  if (cli.matchedCommandName === 'skills') {
    return 'Run ai-pkgs skills -h for detailed usage.';
  }

  if (cli.matchedCommandName) {
    return `Run ai-pkgs ${cli.matchedCommandName} -h for detailed usage.`;
  }

  return 'Run ai-pkgs -h for detailed usage.';
};

const isPromiseLike = (value: unknown): value is Promise<unknown> =>
  typeof value === 'object' &&
  value !== null &&
  'then' in value &&
  typeof value.then === 'function';
