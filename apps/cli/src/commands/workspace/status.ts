import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve as resolvePath } from 'node:path';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { canPrompt, isAICommand } from '../../cli/ai-mode';
import { SilentError } from '../../errors';
import { execGit } from '../../git';
import { createManifestStore, resolveManifestScope } from '../../manifest';
import type { WorkspaceSkillEntry } from '../../types';
import { resolveCloneUrl } from './git-ops';
import type { WorkspaceCommandRuntime, WorkspaceStatusOptions } from './types';

/** Per-skill sync state reported by `workspace status`. */
export type WorkspaceStatus = 'clean' | 'modified' | 'untracked';

/** A row in the status output: one workspace entry plus its classified state. */
export type WorkspaceStatusRow = {
  entry: WorkspaceSkillEntry;
  status: WorkspaceStatus;
};

/**
 * Classify a workspace skill's state given whether its local directory
 * differs from the pinned commit on disk.
 *
 * - `untracked` when the entry has not been pushed yet (`commitSha` is
 *   the all-zero sentinel set at link time)
 * - `modified` when local content differs from the pinned commit
 * - `clean` otherwise
 */
export const classifyWorkspaceStatus = (
  entry: WorkspaceSkillEntry,
  localHasChanges: boolean
): WorkspaceStatus => {
  if (/^0+$/.test(entry.commitSha)) return 'untracked';
  return localHasChanges ? 'modified' : 'clean';
};

/**
 * Format status rows as stable plain text: `name: status ref@shortSha`.
 *
 * @example
 * formatWorkspaceStatus([{ entry: { name: 'explain', ref: 'main', commitSha: 'c376dc9...' }, status: 'modified' }]);
 * // 'explain: modified main@c376dc9\n'
 */
export const formatWorkspaceStatus = (rows: WorkspaceStatusRow[]): string => {
  if (rows.length === 0) return '';
  return `${rows
    .map(
      ({ entry, status }) =>
        `${entry.name}: ${status} ${entry.ref}@${entry.commitSha.slice(0, 7)}`
    )
    .join('\n')}\n`;
};

/**
 * Run `ai-pkgs workspace status [name]`.
 *
 * Clones the remote at the pinned `commitSha` for each workspace skill and
 * diffs against the local directory. Reports `clean`, `modified`, or
 * `untracked` for each.
 *
 * @example
 * await runWorkspaceStatusCommand(undefined, { json: true }, runtime);
 * // Side effects:
 * //   /tmp/ai-pkgs-ws-status-XXXXX/           ← shallow clones (cleaned up)
 * //   spawns `git clone --filter=blob:none`  for each workspace skill
 * //   spawns `git diff --no-index`           to detect modifications
 * //   writes JSON / plain text / Clack note  to process.stdout
 * // Returns: 0 always
 */
export const runWorkspaceStatusCommand = async (
  name: string | undefined,
  options: WorkspaceStatusOptions,
  runtime: WorkspaceCommandRuntime
): Promise<number> => {
  const aiMode = isAICommand(options);
  const manifestScope = resolveManifestScope(runtime.cwd, options);
  const store = createManifestStore(
    manifestScope.projectDir,
    manifestScope.manifestPath
  );
  const manifest = await store.read();
  const entries = name
    ? [
        manifest.workspace.skills.find((skill) => skill.name === name) ??
          throwNotFound(name, manifest.workspace.skills),
      ]
    : manifest.workspace.skills;

  const rows: WorkspaceStatusRow[] = [];
  for (const entry of entries) {
    const status = await computeStatus(entry, manifestScope.projectDir);
    rows.push({ entry, status });
  }

  if (options.json === true) {
    process.stdout.write(
      `${JSON.stringify(
        rows.map((row) => ({
          name: row.entry.name,
          status: row.status,
          local: row.entry.local,
          version: row.entry.version,
        })),
        null,
        2
      )}\n`
    );
    return 0;
  }

  if (!aiMode && process.stdin.isTTY === true && canPrompt(options)) {
    p.intro(pc.bold('Workspace status'));
    if (rows.length === 0) {
      p.log.info('No workspace skills.');
    } else {
      p.note(
        rows
          .map(
            (row) =>
              `${row.entry.name}\n  status:  ${row.status}\n  version: ${row.entry.version}`
          )
          .join('\n\n'),
        rows.length === 1
          ? `Workspace skill: ${rows[0]!.entry.name}`
          : `Workspace skills (${rows.length})`
      );
    }
    p.outro('Done.');
    return 0;
  }

  process.stdout.write(formatWorkspaceStatus(rows));
  return 0;
};

const computeStatus = async (
  entry: WorkspaceSkillEntry,
  projectDir: string
): Promise<WorkspaceStatus> => {
  if (/^0+$/.test(entry.commitSha)) return 'untracked';

  const absoluteLocal = resolvePath(projectDir, entry.local);
  if (!existsSync(absoluteLocal)) return 'modified';

  const cloneUrl = resolveCloneUrl(entry);
  const tempDir = await mkdtemp(join(tmpdir(), 'ai-pkgs-ws-status-'));
  try {
    await execGit([
      'clone',
      '--no-checkout',
      '--filter=blob:none',
      cloneUrl,
      tempDir,
    ]);
    await execGit(['checkout', '--detach', entry.commitSha], tempDir);

    try {
      await execGit(
        [
          'diff',
          '--no-index',
          '--quiet',
          join(tempDir, entry.path),
          absoluteLocal,
        ],
        tempDir
      );
      return 'clean';
    } catch {
      return 'modified';
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};

const throwNotFound = (
  name: string,
  available: WorkspaceSkillEntry[]
): never => {
  const list = available
    .map((skill) => skill.name)
    .sort()
    .join(', ');
  throw new SilentError(
    `"${name}" is not a workspace skill. Available: ${list || '(none)'}`
  );
};
