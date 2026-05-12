import { mkdir, rm, symlink } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { platform } from 'node:os';

/**
 * Replace `targetDir` with a relative directory symlink pointing at `sourceDir`.
 * Uses `junction` on Windows for non-elevated symlink support.
 *
 * @example
 * await linkDirectory('/src/skills/caveman', '/repo/.cursor/skills/caveman');
 * // Side effects:
 * //   /repo/.cursor/skills/caveman  → ../../src/skills/caveman  (symlink)
 */
export const linkDirectory = async (sourceDir: string, targetDir: string) => {
  await rm(targetDir, { force: true, recursive: true });
  await mkdir(dirname(targetDir), { recursive: true });
  const relativeTarget = relative(dirname(targetDir), resolve(sourceDir));
  await symlink(
    relativeTarget,
    targetDir,
    platform() === 'win32' ? 'junction' : 'dir'
  );
};
