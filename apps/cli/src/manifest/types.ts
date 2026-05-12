import type { AiPackageManifest, SkillEntry } from '../types';
import type { PluginEntry } from '../plugins/types';

/** Loose JSON shape of `ai-package.json` before validation. */
export type RawAiPackageManifest = {
  skills?: unknown;
  skill?: unknown;
  plugins?: unknown;
};

/** Loose per-skill JSON fields before type-checking and normalization. */
export type RawSkillEntry = {
  source?: unknown;
  version?: unknown;
  path?: unknown;
};

/** Loose per-plugin JSON fields before type-checking and normalization. */
export type RawPluginEntry = {
  source?: unknown;
  version?: unknown;
  path?: unknown;
  targets?: unknown;
};

/** Alias for the validated skill entry type used in manifest operations. */
export type ManifestSkillEntry = SkillEntry;

/** Alias for the validated plugin entry type used in manifest operations. */
export type ManifestPluginEntry = PluginEntry;

/** Alias for the validated top-level manifest type used in manifest operations. */
export type ManifestDocument = AiPackageManifest;
