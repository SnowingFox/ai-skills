import type { AiPackageManifest, SkillEntry } from '../types';

export type RawAiPackageManifest = {
  skills?: unknown;
  skill?: unknown;
};

export type RawSkillEntry = {
  source?: unknown;
  version?: unknown;
  path?: unknown;
};

export type ManifestSkillEntry = SkillEntry;

export type ManifestDocument = AiPackageManifest;
