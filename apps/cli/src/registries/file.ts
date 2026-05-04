import { isAbsolute, resolve } from 'node:path';
import type { SkillEntry } from '../types';
import type { AddSourceInput, SourceRegistry } from './types';

export const fileRegistry = (cwd: string): SourceRegistry => ({
  kind: 'file',
  resolve: async (input: AddSourceInput) => {
    const path = input.rawSource.replace(/^file:/, '');
    const rootDir = isAbsolute(path) ? path : resolve(cwd, path);
    return {
      provider: 'file',
      source: `file:${path}`,
      packageId: path,
      root: { rootDir },
    };
  },
  materialize: async (entry: SkillEntry) => {
    if (entry.sourceRoot) {
      return { rootDir: entry.sourceRoot };
    }

    const packageId = (entry.source ?? entry.packageId).replace(/^file:/, '');
    const rootDir = isAbsolute(packageId) ? packageId : resolve(cwd, packageId);
    return { rootDir };
  },
});
