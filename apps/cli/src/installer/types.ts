import type {
  ConflictPolicy,
  InstallMode,
  InstalledSkill,
  InstallProgress,
  SelectedSkill,
} from '../types';
import type { ResolvedAgentTarget } from '../agents/types';

/**
 * Inputs for {@link installPlan}: a list of selected skills, target agent
 * directories, install mode (copy/link), conflict policy, and optional
 * progress hooks.
 */
export type InstallPlan = {
  skills: SelectedSkill[];
  targets: ResolvedAgentTarget[];
  mode: InstallMode;
  conflict: ConflictPolicy;
  canPrompt?: boolean;
  onProgress?: (progress: InstallProgress) => void;
};

/** Output of {@link installPlan}: the list of skills that were installed. */
export type InstallPlanResult = {
  installed: InstalledSkill[];
};
