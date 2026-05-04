import * as p from '@clack/prompts';
import { canPrompt, isAICommand } from '../../cli/ai-mode';
import { SilentError } from '../../errors';
import { createManifestStore, resolveManifestScope } from '../../manifest';
import type { AiPackageManifest, SkillEntry } from '../../types';
import {
  checkSkillUpdates,
  formatUpdateCheckResult,
  writeUpdateCheckResult,
  type SkillUpdateCheckResult,
} from './outdated';
import type { SkillsCommandRuntime } from './types';

export type SkillsUpdateOptions = {
  dir?: string;
  global?: boolean;
  manifest?: string;
  ai?: boolean;
  yes?: boolean;
};

/**
 * Execute `ai-pkgs skills update` by reusing the shared outdated check result.
 */
export const runSkillsUpdateCommand = async (
  skills: string[],
  options: SkillsUpdateOptions,
  runtime: SkillsCommandRuntime
): Promise<number> => {
  const manifestScope = resolveManifestScope(runtime.cwd, options);
  const store = createManifestStore(
    manifestScope.projectDir,
    manifestScope.manifestPath
  );
  const manifest = await store.read();
  const result = await checkSkillUpdates(manifest, skills);

  if (result.failed.length > 0) {
    writeUpdateCheckResult(result, {
      title: 'Skill updates failed',
      aiMode: isAICommand(options),
    });
    return 1;
  }

  if (result.outdated.length === 0) {
    writeUpdateResult(result);
    return 0;
  }

  if (options.yes !== true) {
    if (!canPrompt(options)) {
      throw new SilentError(
        'Pass --yes to update skills in non-interactive or --ai mode.'
      );
    }

    writeUpdateCheckResult(result, {
      title: 'Skill updates',
      aiMode: false,
      includeUpToDate: false,
    });
    const confirmed = await runtime.confirm({
      message: `Update ${result.outdated.length} skill${result.outdated.length === 1 ? '' : 's'} in ai-package.json?`,
      initialValue: true,
    });

    if (confirmed !== true) {
      p.cancel('Skill update cancelled');
      return 1;
    }
  }

  const updatedManifest = applySkillUpdates(manifest, result);
  await store.write(updatedManifest);
  writeUpdateResult(result);
  return 0;
};

/**
 * Apply outdated Git pins to a manifest without changing skipped entries.
 */
export const applySkillUpdates = (
  manifest: AiPackageManifest,
  result: SkillUpdateCheckResult
): AiPackageManifest => {
  const updatesByName = new Map(
    result.outdated.map((item) => [item.skill.name, item])
  );

  return {
    skills: manifest.skills.map((skill): SkillEntry => {
      const update = updatesByName.get(skill.name);
      if (!update) {
        return skill;
      }
      return {
        ...skill,
        version: `${update.ref}@${update.latestSha}`,
        ref: update.ref,
        commitSha: update.latestSha,
      };
    }),
  };
};

const writeUpdateResult = (result: SkillUpdateCheckResult) => {
  process.stdout.write(
    formatUpdateCheckResult(
      {
        ...result,
        upToDate: [],
      },
      { includeUpToDate: false }
    ).replace(/^outdated:/, 'updated:')
  );
};
