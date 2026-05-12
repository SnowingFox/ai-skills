import type {
  InstallCommandOptions,
  InstallCommandRuntime,
} from '../../install-command';
import type { RegistryKind } from '../../registries';

/** Runtime injection surface for plugin commands. */
export type PluginsCommandRuntime = InstallCommandRuntime;

/** CLI options for `plugins add`. */
export type PluginsAddOptions = InstallCommandOptions & {
  registry?: RegistryKind;
  ref?: string;
  path?: string;
  plugin?: string | string[];
  installOnly?: boolean;
  project?: boolean;
  global?: boolean;
  refresh?: boolean;
  scope?: string;
  verbose?: boolean;
};

/** CLI options for `plugins list`. */
export type PluginsListOptions = InstallCommandOptions & {
  json?: boolean;
};

/** CLI options for `plugins init`. */
export type PluginsInitOptions = {
  yes?: boolean;
  ai?: boolean;
  agent?: string | string[];
  force?: boolean;
};

/** CLI options for `plugins update`. */
export type PluginsUpdateOptions = {
  dir?: string;
  global?: boolean;
  manifest?: string;
  ai?: boolean;
  yes?: boolean;
};

/** CLI options for `plugins remove`. */
export type PluginsRemoveOptions = InstallCommandOptions & {
  uninstall?: boolean;
  agent?: string | string[];
};
