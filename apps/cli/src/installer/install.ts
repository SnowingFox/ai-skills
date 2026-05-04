import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { buildSkillTargetPath } from '../agents/targets';
import { resolveConflict } from './conflicts';
import { linkDirectory } from './link';
import type { InstallPlan, InstallPlanResult } from './types';

export const installPlan = async ({
  skills,
  targets,
  mode,
  conflict,
  canPrompt,
  onProgress,
}: InstallPlan): Promise<InstallPlanResult> => {
  const installed = [];

  for (const skill of skills) {
    for (const target of targets) {
      const targetDir = buildSkillTargetPath(target, skill.name);
      assertInsideTarget(target.skillsDir, targetDir);
      const resolution = await resolveConflict(targetDir, conflict, canPrompt);
      if (resolution === 'skip') {
        onProgress?.({ name: skill.name, status: 'skipped' });
        installed.push({ name: skill.name, targetDir, skipped: true });
        continue;
      }

      onProgress?.({
        name: skill.name,
        status: mode === 'link' ? 'linking' : 'copying',
      });
      if (mode === 'link') {
        await linkDirectory(skill.sourceDir, targetDir);
      } else {
        await rm(targetDir, { force: true, recursive: true });
        await mkdir(dirname(targetDir), { recursive: true });
        await cp(skill.sourceDir, targetDir, {
          recursive: true,
          verbatimSymlinks: false,
        });
      }

      onProgress?.({ name: skill.name, status: 'installed' });
      installed.push({ name: skill.name, targetDir });
    }
  }

  return { installed };
};

const assertInsideTarget = (targetRoot: string, targetDir: string) => {
  const root = resolve(targetRoot);
  const target = resolve(targetDir);
  const rel = relative(root, target);
  if (rel.startsWith('..') || rel === '..' || rel.includes(`..${sep}`)) {
    throw new Error(
      `Target path "${targetDir}" must stay inside "${targetRoot}"`
    );
  }
};
