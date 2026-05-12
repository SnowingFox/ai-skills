import type { SkillEntry, SkillProvider } from '../types';
import { fileRegistry } from './file';
import { githubRegistry } from './github';
import { gitlabRegistry } from './gitlab';
import { marketplaceRegistry } from './marketplace';
import type { RegistryKind, SourceRegistry } from './types';

/** One {@link SourceRegistry} instance per provider kind. */
export type RegistrySet = Record<RegistryKind, SourceRegistry>;

/**
 * Build a complete set of source registries for the given project directory.
 * The file registry is cwd-relative; Git registries are stateless singletons.
 */
export const createRegistries = (cwd: string): RegistrySet => ({
  github: githubRegistry,
  gitlab: gitlabRegistry,
  marketplace: marketplaceRegistry,
  file: fileRegistry(cwd),
});

/** Look up the registry for a given provider kind. */
export const getRegistry = (
  registries: RegistrySet,
  provider: SkillProvider
): SourceRegistry => registries[provider];

/** Return the provider kind for a skill entry (identity helper for type narrowing). */
export const registryForSource = (skill: SkillEntry): SkillProvider =>
  skill.provider;

export type { AddSourceInput, RegistryKind, ResolvedPackage } from './types';
