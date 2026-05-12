/**
 * Static definition for one supported AI agent. Maps the agent id to its
 * skill directory conventions, optional presence detector, and whether it
 * appears in the interactive agent picker.
 */
export type AgentConfig = {
  id: string;
  displayName: string;
  projectSkillsDir: string;
  globalSkillsDir?: string;
  detectInstalled?: (ctx: AgentDetectContext) => boolean | Promise<boolean>;
  showInPicker?: boolean;
};

/** Context passed to agent detection hooks during `--agent` auto-discovery. */
export type AgentDetectContext = {
  cwd: string;
  homeDir: string;
  env: NodeJS.ProcessEnv;
  pathExists: (path: string) => boolean;
};

/** Concrete agent target after resolving project vs global skill directory. */
export type ResolvedAgentTarget = {
  agentId: string;
  displayName: string;
  skillsDir: string;
};
