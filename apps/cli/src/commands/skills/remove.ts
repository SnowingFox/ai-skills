import { SilentError } from '../../errors';
import { createManifestStore, resolveManifestScope } from '../../manifest';
import type { InstallCommandOptions } from '../../install-command';
import type { SkillsCommandRuntime } from './types';

/**
 * Remove manifest entries by name without deleting installed target folders.
 */
export const runSkillsRemoveCommand = async (
  skills: string[],
  options: InstallCommandOptions,
  runtime: SkillsCommandRuntime
): Promise<number> => {
  if (skills.length === 0) {
    throw new SilentError('Pass at least one skill to remove');
  }

  const manifestScope = resolveManifestScope(runtime.cwd, options);
  const store = createManifestStore(
    manifestScope.projectDir,
    manifestScope.manifestPath
  );
  await store.removeSkills(skills);
  return 0;
};
