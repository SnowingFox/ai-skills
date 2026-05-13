import type {
  InstallCommandOptions,
  InstallCommandRuntime,
} from '../../install-command';

/** Runtime injection surface for workspace commands. */
export type WorkspaceCommandRuntime = InstallCommandRuntime;

/** CLI options for `workspace link`. */
export type WorkspaceLinkOptions = InstallCommandOptions & {
  local?: string;
};

/** CLI options for `workspace remove`. */
export type WorkspaceRemoveOptions = InstallCommandOptions;

/** CLI options for `workspace push`. */
export type WorkspacePushOptions = InstallCommandOptions & {
  message?: string;
  acceptMyChange?: boolean;
};

/** CLI options for `workspace pull`. */
export type WorkspacePullOptions = InstallCommandOptions;

/** CLI options for `workspace status`. */
export type WorkspaceStatusOptions = InstallCommandOptions & {
  json?: boolean;
};

/** CLI options for `workspace list`. */
export type WorkspaceListOptions = InstallCommandOptions & {
  json?: boolean;
};
