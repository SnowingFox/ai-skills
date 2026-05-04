export type RemoteProvider = 'github' | 'gitlab' | 'marketplace';

export type SkillProvider = RemoteProvider | 'file';

export type InstallMode = 'copy' | 'link';

export type ConflictPolicy = 'prompt' | 'overwrite' | 'skip' | 'fail';

export type SkillEntry = {
  name: string;
  provider: SkillProvider;
  source?: string;
  packageId: string;
  cloneUrl?: string;
  version?: string;
  ref?: string;
  commitSha?: string;
  path: string;
  sourceRoot?: string;
};

export type RemoteSkillEntry = SkillEntry & {
  provider: RemoteProvider;
  version: string;
  ref: string;
  commitSha: string;
};

export type FileSkillEntry = SkillEntry & {
  provider: 'file';
  sourceRoot: string;
};

export type AiPackageManifest = {
  skills: SkillEntry[];
};

export type MaterializedSource = {
  rootDir: string;
  cleanup?: () => Promise<void>;
};

export type CloneRequest = {
  provider: Exclude<RemoteProvider, 'marketplace'>;
  packageId: string;
  cloneUrl: string;
  ref: string;
  commitSha: string;
};

export type ClonedSource = string | MaterializedSource;

export type CloneSource = (request: CloneRequest) => Promise<ClonedSource>;

export type AgentTarget = {
  agentId: string;
  displayName: string;
  skillsDir: string;
};

export type SelectedSkill = {
  name: string;
  sourceDir: string;
};

export type InstalledSkill = {
  name: string;
  targetDir: string;
  skipped?: boolean;
};

export type InstallProgress = {
  name: string;
  status:
    | 'resolving'
    | 'cloning'
    | 'discovering'
    | 'copying'
    | 'linking'
    | 'skipped'
    | 'installed';
};
