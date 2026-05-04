export type AgentConfig = {
  id: string;
  displayName: string;
  projectSkillsDir: string;
  globalSkillsDir?: string;
  detectInstalled?: (ctx: AgentDetectContext) => boolean | Promise<boolean>;
  showInPicker?: boolean;
};

export type AgentDetectContext = {
  cwd: string;
  homeDir: string;
  env: NodeJS.ProcessEnv;
  pathExists: (path: string) => boolean;
};

export type ResolvedAgentTarget = {
  agentId: string;
  displayName: string;
  skillsDir: string;
};
