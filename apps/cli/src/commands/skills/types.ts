import type {
  InstallCommandOptions,
  InstallCommandRuntime,
} from '../../install-command';
import type { RegistryKind } from '../../registries';

export type SkillsCommandRuntime = InstallCommandRuntime;

export type SkillsAddOptions = InstallCommandOptions & {
  registry?: RegistryKind;
  ref?: string;
  path?: string;
  skill?: string | string[];
  installOnly?: boolean;
  project?: boolean;
  global?: boolean;
  all?: boolean;
  refresh?: boolean;
};

export type SkillsListOptions = InstallCommandOptions & {
  json?: boolean;
};
