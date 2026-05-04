import type { SkillEntry, SkillProvider } from '../types';
import { fileRegistry } from './file';
import { githubRegistry } from './github';
import { gitlabRegistry } from './gitlab';
import { marketplaceRegistry } from './marketplace';
import type { RegistryKind, SourceRegistry } from './types';

export type RegistrySet = Record<RegistryKind, SourceRegistry>;

export const createRegistries = (cwd: string): RegistrySet => ({
  github: githubRegistry,
  gitlab: gitlabRegistry,
  marketplace: marketplaceRegistry,
  file: fileRegistry(cwd),
});

export const getRegistry = (
  registries: RegistrySet,
  provider: SkillProvider
): SourceRegistry => registries[provider];

export const registryForSource = (skill: SkillEntry): SkillProvider =>
  skill.provider;

export type { AddSourceInput, RegistryKind, ResolvedPackage } from './types';
