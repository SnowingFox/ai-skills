import type { MaterializedSource, RemoteProvider, SkillEntry } from '../types';

export type RegistryKind = RemoteProvider | 'file';

export type AddSourceInput = {
  rawSource: string;
  registry: RegistryKind;
  ref?: string;
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

export type SourceRegistry = {
  kind: RegistryKind;
  resolve(input: AddSourceInput): Promise<ResolvedPackage>;
  materialize(entry: SkillEntry): Promise<MaterializedSource>;
  update?(entry: SkillEntry): Promise<ResolvedPackage>;
};
