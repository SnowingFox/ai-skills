import * as p from '@clack/prompts';
import { SilentError } from '../errors';

export type InstallScopeOptions = {
  project?: boolean;
  global?: boolean;
};

/**
 * Resolve whether an add command should use the global ai-pkgs manifest.
 *
 * In non-interactive mode, callers must pass `--project` or `--global`.
 * In TTY mode, prompts when neither flag is set.
 *
 * @example
 * ```ts
 * await resolveInstallScope({ global: true }, false); // true
 * await resolveInstallScope({ project: true }, false); // false
 * ```
 */
export const resolveInstallScope = async (
  options: InstallScopeOptions,
  canPromptForScope: boolean
): Promise<boolean> => {
  if (options.project === true && options.global === true) {
    throw new SilentError('--project and --global are mutually exclusive');
  }
  if (options.global === true) {
    return true;
  }
  if (options.project === true) {
    return false;
  }
  if (!canPromptForScope) {
    throw new SilentError(
      'Install scope not specified. Use --project or --global.'
    );
  }

  const selected = await p.select({
    message: 'Install scope',
    options: [
      {
        label: 'Project',
        value: 'project',
        hint: 'Write ai-package.json in this repository',
      },
      {
        label: 'Global',
        value: 'global',
        hint: 'Write ~/.ai-pkgs/ai-package.json',
      },
    ],
    initialValue: 'project',
  });

  if (p.isCancel(selected)) {
    throw new SilentError('Install scope selection cancelled');
  }

  return selected === 'global';
};
