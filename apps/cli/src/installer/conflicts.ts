import { stat } from 'node:fs/promises';
import * as p from '@clack/prompts';
import { SilentError } from '../errors';
import type { ConflictPolicy } from '../types';

export type ConflictResolution = 'overwrite' | 'skip';

export const resolveConflict = async (
  targetDir: string,
  policy: ConflictPolicy,
  canPrompt = process.stdin.isTTY === true
): Promise<ConflictResolution> => {
  const exists = await stat(targetDir).then(
    () => true,
    () => false
  );
  if (!exists) {
    return 'overwrite';
  }

  if (policy === 'overwrite') {
    return 'overwrite';
  }
  if (policy === 'skip') {
    return 'skip';
  }
  if (policy === 'fail' || !canPrompt) {
    throw new SilentError(
      `Target already exists: ${targetDir}. Pass --force or --skip-existing.`
    );
  }

  const answer = await p.select({
    message: `Target already exists: ${targetDir}`,
    options: [
      { label: 'Overwrite', value: 'overwrite' },
      { label: 'Skip', value: 'skip' },
    ],
  });

  if (p.isCancel(answer)) {
    throw new SilentError('Install cancelled');
  }

  return answer;
};
