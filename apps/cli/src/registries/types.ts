import type { MaterializedSource, RemoteProvider, SkillEntry } from '../types';
import type { GitProgressEvent } from '../git';

/** Registry discriminator including the local `file` provider. */
export type RegistryKind = RemoteProvider | 'file';

/** Normalized CLI/registry input for resolving a source before installation. */
export type AddSourceInput = {
  rawSource: string;
  registry: RegistryKind;
  ref?: string;
  refresh?: boolean;
  onProgress?: (event: GitProgressEvent) => void;
};

/**
 * A resolved package with all pins, manifest fields, and a materialized
 * root directory. Returned by {@link SourceRegistry.resolve}.
 */
export type ResolvedPackage = {
  provider: RegistryKind;
  source: string;
  packageId: string;
  version?: string;
  ref?: string;
  commitSha?: string;
  root: MaterializedSource;
};

/** Options for re-materializing an already-pinned skill entry. */
export type MaterializeOptions = {
  refresh?: boolean;
  onProgress?: (event: GitProgressEvent) => void;
};

/**
 * Provider boundary for one source kind (GitHub, GitLab, marketplace, file).
 *
 * - `resolve` — parse raw user input, resolve the remote ref, and materialize
 * - `materialize` — restore a previously pinned manifest entry to a local dir
 * - `update` — re-resolve a pinned entry to the latest ref (used by `skills update`)
 */
export type SourceRegistry = {
  kind: RegistryKind;
  resolve(input: AddSourceInput): Promise<ResolvedPackage>;
  materialize(
    entry: SkillEntry,
    options?: MaterializeOptions
  ): Promise<MaterializedSource>;
  update?(entry: SkillEntry): Promise<ResolvedPackage>;
};
