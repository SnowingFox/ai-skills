import type {
  InstallCommandOptions,
  InstallCommandRuntime,
} from '../../install-command';
import type { RegistryKind } from '../../registries';

/** Runtime injection surface for skills commands (same as install runtime). */
export type SkillsCommandRuntime = InstallCommandRuntime;

/** Extended CLI options for `skills add`. */
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

/** Extended CLI options for `skills list` with `--json` support. */
export type SkillsListOptions = InstallCommandOptions & {
  json?: boolean;
};
