import type {
  ConflictPolicy,
  InstallMode,
  InstalledSkill,
  InstallProgress,
  SelectedSkill,
} from '../types';
import type { ResolvedAgentTarget } from '../agents/types';

export type InstallPlan = {
  skills: SelectedSkill[];
  targets: ResolvedAgentTarget[];
  mode: InstallMode;
  conflict: ConflictPolicy;
  canPrompt?: boolean;
  onProgress?: (progress: InstallProgress) => void;
};

export type InstallPlanResult = {
  installed: InstalledSkill[];
};
