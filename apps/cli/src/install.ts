import { join } from 'node:path';
import { assertSkillDirectory, resolveInside } from './discovery/discover';
import type { GitProgressEvent } from './git';
import { installPlan } from './installer/install';
import { createRegistries, getRegistry } from './registries';
import type {
  AgentTarget,
  AiPackageManifest,
  CloneSource,
  ConflictPolicy,
  InstallMode,
  InstallProgress,
  InstalledSkill,
  MaterializedSource,
  SelectedSkill,
} from './types';

type InstallSkillsOptions = {
  manifest: AiPackageManifest;
  projectDir: string;
  targetDir?: string;
  targets?: AgentTarget[];
  mode?: InstallMode;
  conflict?: ConflictPolicy;
  canPrompt?: boolean;
  cloneSource?: CloneSource;
  refresh?: boolean;
  onProgress?: (progress: InstallProgress) => void;
  onGitProgress?: (progress: GitProgressEvent) => void;
};

type InstallSkillsResult = {
  installed: InstalledSkill[];
};

/**
 * Restore manifest skills into the selected agent target directories.
 *
 * This is the command-independent install boundary: callers hand in an
 * already parsed manifest plus resolved targets, and this function owns
 * source materialization, `SKILL.md` validation, clone reuse, and cleanup.
 *
 * @example
 * await installSkills({
 *   manifest,
 *   projectDir,
 *   targets: [{ agentId: 'cursor', displayName: 'Cursor', skillsDir }],
 *   mode: 'copy',
 *   conflict: 'fail',
 * });
 */
export const installSkills = async ({
  manifest,
  projectDir,
  targetDir = join(projectDir, '.agents/skills'),
  targets = [
    { agentId: 'default', displayName: 'Default', skillsDir: targetDir },
  ],
  mode = 'copy',
  conflict = 'overwrite',
  canPrompt = false,
  cloneSource,
  refresh = false,
  onProgress,
  onGitProgress,
}: InstallSkillsOptions): Promise<InstallSkillsResult> => {
  const selectedSkills: SelectedSkill[] = [];
  const materializedSources: MaterializedSource[] = [];
  const materializedCache = new Map<string, Promise<MaterializedSource>>();
  const registries = createRegistries(projectDir);

  try {
    for (const skill of manifest.skills) {
      const registry = getRegistry(registries, skill.provider);
      const cacheKey = [
        skill.provider,
        skill.packageId,
        skill.commitSha ?? skill.version ?? skill.sourceRoot ?? '',
      ].join(':');
      let materialized = materializedCache.get(cacheKey);
      const isNewMaterialization = !materialized;
      if (!materialized) {
        materialized =
          cloneSource &&
          skill.provider !== 'file' &&
          skill.provider !== 'marketplace'
            ? cloneSource({
                provider: skill.provider,
                packageId: skill.packageId,
                cloneUrl:
                  'cloneUrl' in skill && typeof skill.cloneUrl === 'string'
                    ? skill.cloneUrl
                    : skill.packageId,
                ref: skill.ref ?? '',
                commitSha: skill.commitSha ?? '',
              }).then((cloned) =>
                typeof cloned === 'string' ? { rootDir: cloned } : cloned
              )
            : registry.materialize(skill, {
                refresh,
                onProgress: onGitProgress,
              });
        materializedCache.set(cacheKey, materialized);
      }
      const source = await materialized;
      if (isNewMaterialization) {
        materializedSources.push(source);
      }
      const sourceSkillDir = resolveInside(source.rootDir, skill.path);
      await assertSkillDirectory(sourceSkillDir, skill.name);
      selectedSkills.push({ name: skill.name, sourceDir: sourceSkillDir });
    }

    const result = await installPlan({
      skills: selectedSkills,
      targets,
      mode,
      conflict,
      canPrompt,
      onProgress,
    });
    return result;
  } finally {
    await Promise.all(
      materializedSources.map(async (source) => {
        await source.cleanup?.();
      })
    );
  }
};
