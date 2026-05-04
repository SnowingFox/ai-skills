import type { MaterializedSource, RemoteProvider, SkillEntry } from '../types';
import type { GitProgressEvent } from '../git';

export type RegistryKind = RemoteProvider | 'file';

export type AddSourceInput = {
  rawSource: string;
  registry: RegistryKind;
  ref?: string;
  refresh?: boolean;
  onProgress?: (event: GitProgressEvent) => void;
};

export type ResolvedPackage = {
  provider: RegistryKind;
  source: string;
  packageId: string;
  version?: string;
  ref?: string;
  commitSha?: string;
  root: MaterializedSource;
};

export type MaterializeOptions = {
  refresh?: boolean;
  onProgress?: (event: GitProgressEvent) => void;
};

export type SourceRegistry = {
  kind: RegistryKind;
  resolve(input: AddSourceInput): Promise<ResolvedPackage>;
  materialize(
    entry: SkillEntry,
    options?: MaterializeOptions
  ): Promise<MaterializedSource>;
  update?(entry: SkillEntry): Promise<ResolvedPackage>;
};
