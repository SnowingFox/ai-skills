import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Short product tagline shown in root help output. */
export const TAGLINE = 'Skills and plugins for AI agents.';

/**
 * Read the package version from the nearest ai-pkgs package.json.
 *
 * The CLI may run from TypeScript source, bundled `dist/cli.js`, or a globally
 * installed npm package. Walking upward from the current module keeps help
 * output tied to the packaged metadata instead of a manually updated constant.
 *
 * @example
 * ```ts
 * getCliVersion(); // '0.0.7'
 * ```
 */
export const getCliVersion = (): string => {
  let current = dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 6; depth += 1) {
    const packagePath = join(current, 'package.json');
    if (existsSync(packagePath)) {
      const pkg = JSON.parse(readFileSync(packagePath, 'utf-8')) as {
        name?: string;
        version?: string;
      };
      if (pkg.name === 'ai-pkgs' && pkg.version) {
        return pkg.version;
      }
    }

    const next = dirname(current);
    if (next === current) {
      break;
    }
    current = next;
  }

  return '0.0.0';
};

/** Static hints pointing users to deeper help commands from root help. */
export const DETAILED_HELP: [command: string, description: string][] = [
  [
    'ai-pkgs skills -h',
    'Show grouped AI/skills usage, install-only flows, and notes',
  ],
  ['ai-pkgs help skills add', 'Show detailed usage for adding skills'],
  [
    'ai-pkgs plugins -h',
    'Show grouped plugin management, init, and install flows',
  ],
  ['ai-pkgs help plugins add', 'Show detailed usage for adding plugins'],
  ['ai-pkgs help cache clear', 'Show cache cleanup options'],
];
