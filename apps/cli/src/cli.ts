import type { InstallCommandRuntimeOverrides } from './install-command';

/**
 * Minimum Node.js runtime supported by the published CLI dependency graph.
 * `cac@7` requires 20.19.0, which is stricter than Clack's 20.12.0 floor.
 */
export const MIN_NODE_VERSION = '20.19.0';

type NodeVersion = {
  major: number;
  minor: number;
  patch: number;
};

/**
 * CLI bootstrap entrypoint. Checks the Node.js runtime before loading the
 * command application so unsupported runtimes receive a clear upgrade message.
 *
 * @example
 * const exitCode = await runCli(process.argv);
 * process.exitCode = exitCode;
 */
export const runCli = async (
  argv = process.argv,
  cwd = process.cwd(),
  runtime: InstallCommandRuntimeOverrides = {},
  nodeVersion = process.versions.node
): Promise<number> => {
  if (!isSupportedNodeVersion(nodeVersion)) {
    process.stderr.write(formatUnsupportedNodeVersionMessage(nodeVersion));
    return 1;
  }

  const { runCli: runAppCli } = await import('./cli/app');
  return runAppCli(argv, cwd, runtime);
};

/**
 * Parse a Node.js semver string such as `20.19.0` or `v20.19.0`.
 */
export const parseNodeVersion = (version: string): NodeVersion | undefined => {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!match) {
    return undefined;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
};

/**
 * Return whether a Node.js version satisfies the CLI runtime floor.
 */
export const isSupportedNodeVersion = (version: string): boolean => {
  const current = parseNodeVersion(version);
  const minimum = parseNodeVersion(MIN_NODE_VERSION);

  if (!current || !minimum) {
    return false;
  }

  if (current.major !== minimum.major) {
    return current.major > minimum.major;
  }

  if (current.minor !== minimum.minor) {
    return current.minor > minimum.minor;
  }

  return current.patch >= minimum.patch;
};

/**
 * Format the unsupported runtime message without using Clack or color helpers.
 *
 * @example
 * formatUnsupportedNodeVersionMessage('18.19.1');
 * // Includes the current version and the minimum required version.
 */
export const formatUnsupportedNodeVersionMessage = (
  version: string
): string => [
  `ai-pkgs requires Node.js >= ${MIN_NODE_VERSION}.`,
  `Current Node.js version: ${version}.`,
  'Please upgrade Node.js and run ai-pkgs again.',
  '',
].join('\n');

const exitCode = await runCli();
process.exitCode = exitCode;
