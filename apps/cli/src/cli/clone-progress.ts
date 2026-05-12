import * as p from '@clack/prompts';
import pc from 'picocolors';
import type { GitProgressEvent } from '../git';
import { renderAiDone, renderAiStep } from './ai-output';

/** Callbacks returned by {@link createCloneProgressRenderer}. */
export type CloneProgressRenderer = {
  onProgress?: (event: GitProgressEvent) => void;
  done: (ref?: string, commitSha?: string) => void;
  fail: (error: unknown) => void;
};

/**
 * Create a renderer that formats Git clone/cache progress events for
 * spinner, AI, or plain-text output modes.
 *
 * Shared between `skills add` and `plugins add` so both display consistent
 * clone feedback.
 *
 * @example
 * ```ts
 * const renderer = createCloneProgressRenderer({ aiMode: false, enabled: true, verbose: false });
 * const resolved = await registry.resolve({ onProgress: renderer.onProgress });
 * renderer.done(resolved.ref, resolved.commitSha);
 * ```
 */
export const createCloneProgressRenderer = ({
  aiMode,
  enabled,
  verbose,
}: {
  aiMode: boolean;
  enabled: boolean;
  verbose: boolean;
}): CloneProgressRenderer => {
  if (!enabled) {
    return {
      done: () => {},
      fail: () => {},
    };
  }

  if (aiMode) {
    let usedCache = false;
    return {
      onProgress: (event) => {
        if (event.status === 'cache-hit') {
          usedCache = true;
        }
        const message = formatCloneProgress(event);
        if (message) {
          process.stdout.write(renderAiStep(message));
        }
      },
      done: (ref, commitSha) => {
        if (usedCache) {
          return;
        }
        process.stdout.write(renderAiDone(formatCloneDone(ref, commitSha)));
      },
      fail: () => {},
    };
  }

  if (process.stdin.isTTY !== true) {
    return {
      done: () => {},
      fail: () => {},
    };
  }

  const spinner = p.spinner();
  let started = false;
  let completed = false;

  return {
    onProgress: (event) => {
      if (isCacheProgressEvent(event)) {
        const message = formatCloneProgress(event);
        if (started && event.status === 'cache-store') {
          started = false;
          completed = true;
          spinner.stop(formatCloneDone(event.ref, event.commitSha));
        }
        if (message) {
          p.note(message, 'Git cache');
        }
        return;
      }

      if (event.status === 'cloning') {
        started = true;
        spinner.start(`Cloning repository: ${event.cloneUrl}`);
        return;
      }

      const message = formatCloneProgress(event);
      if (message && started) {
        spinner.message(message);
      } else if (message && verbose) {
        p.log.info(message);
      }
    },
    done: (ref, commitSha) => {
      if (started && !completed) {
        spinner.stop(formatCloneDone(ref, commitSha));
      }
    },
    fail: () => {
      if (started) {
        spinner.stop(pc.red('Failed to clone repository'));
      }
    },
  };
};

/**
 * Check whether an event belongs to the Git-cache family
 * (`cache-hit`, `cache-refresh`, `cache-store`).
 */
export const isCacheProgressEvent = (
  event: GitProgressEvent
): event is Extract<
  GitProgressEvent,
  { status: 'cache-hit' | 'cache-refresh' | 'cache-store' }
> =>
  event.status === 'cache-hit' ||
  event.status === 'cache-refresh' ||
  event.status === 'cache-store';

/**
 * Format Git resolve, clone, and cache events for spinner/static output.
 */
export const formatCloneProgress = (event: GitProgressEvent): string => {
  if (event.status === 'resolving-remote') {
    return `resolving remote ref: ${event.ref ?? 'HEAD'}`;
  }
  if (event.status === 'cloning') {
    return `cloning repository: ${event.cloneUrl}`;
  }
  if (event.status === 'checking-out') {
    return event.commitSha
      ? `checking out commit: ${shortSha(event.commitSha)}`
      : `checking out ref: ${event.ref ?? 'HEAD'}`;
  }
  if (event.status === 'resolved') {
    return `resolving git pin: ${event.ref}@${shortSha(event.commitSha)}`;
  }
  if (event.status === 'cache-hit') {
    return [
      'reusing Git cache for verified remote ref',
      `source: ${event.provider}:${event.packageId}`,
      `ref: ${event.ref}@${shortSha(event.commitSha)}`,
      `cache: ${event.cachePath}`,
    ].join('\n');
  }
  if (event.status === 'cache-refresh') {
    return `refreshing Git cache: ${event.cachePath}`;
  }
  if (event.status === 'cache-store') {
    return `stored Git cache: ${event.cachePath}`;
  }
  return '';
};

/**
 * Format the terminal clone success message with the pinned Git version.
 */
export const formatCloneDone = (ref?: string, commitSha?: string): string => {
  if (!ref || !commitSha) {
    return 'Repository cloned';
  }
  return `Repository cloned (${ref}@${shortSha(commitSha)})`;
};

const shortSha = (sha: string): string => sha.slice(0, 7);
