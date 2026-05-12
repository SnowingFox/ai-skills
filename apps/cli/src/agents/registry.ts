import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { AgentConfig, AgentDetectContext } from './types';

const home = homedir();
const configHome = process.env.XDG_CONFIG_HOME || join(home, '.config');
const codexHome = process.env.CODEX_HOME?.trim() || join(home, '.codex');
const claudeHome =
  process.env.CLAUDE_CONFIG_DIR?.trim() || join(home, '.claude');
const vibeHome = process.env.VIBE_HOME?.trim() || join(home, '.vibe');

const homePath = (path: string) => join(home, path);
const configPath = (path: string) => join(configHome, path);

/**
 * Registry of all supported AI agent targets. Each entry maps an agent id
 * to its skill directory conventions (project-local and global). New agents
 * are added here; the picker, detection, and install paths all read from
 * this registry.
 */
export const agents: Record<string, AgentConfig> = {
  universal: agent(
    'universal',
    'Universal',
    '.agents/skills',
    configPath('agents/skills')
  ),
  adal: agent('adal', 'AdaL', '.adal/skills'),
  'aider-desk': agent('aider-desk', 'AiderDesk', '.aider-desk/skills'),
  amp: agent('amp', 'Amp', '.agents/skills', configPath('agents/skills')),
  antigravity: agent(
    'antigravity',
    'Antigravity',
    '.agents/skills',
    homePath('.gemini/antigravity/skills')
  ),
  augment: agent('augment', 'Augment', '.augment/skills'),
  bob: agent('bob', 'IBM Bob', '.bob/skills'),
  'claude-code': agent(
    'claude-code',
    'Claude Code',
    '.claude/skills',
    join(claudeHome, 'skills')
  ),
  cline: agent('cline', 'Cline', '.agents/skills', homePath('.agents/skills')),
  'codearts-agent': agent(
    'codearts-agent',
    'CodeArts Agent',
    '.codeartsdoer/skills'
  ),
  codebuddy: agent('codebuddy', 'CodeBuddy', '.codebuddy/skills'),
  codemaker: agent('codemaker', 'Codemaker', '.codemaker/skills'),
  codestudio: agent('codestudio', 'Code Studio', '.codestudio/skills'),
  codex: agent('codex', 'Codex', '.codex/skills', join(codexHome, 'skills')),
  'command-code': agent('command-code', 'Command Code', '.commandcode/skills'),
  continue: agent('continue', 'Continue', '.continue/skills'),
  cortex: agent(
    'cortex',
    'Cortex Code',
    '.cortex/skills',
    homePath('.snowflake/cortex/skills')
  ),
  crush: agent('crush', 'Crush', '.crush/skills', configPath('crush/skills')),
  cursor: agent(
    'cursor',
    'Cursor',
    '.cursor/skills',
    homePath('.cursor/skills')
  ),
  deepagents: agent(
    'deepagents',
    'Deep Agents',
    '.agents/skills',
    homePath('.deepagents/agent/skills')
  ),
  devin: agent(
    'devin',
    'Devin for Terminal',
    '.devin/skills',
    configPath('devin/skills')
  ),
  dexto: agent('dexto', 'Dexto', '.agents/skills', homePath('.agents/skills')),
  droid: agent('droid', 'Droid', '.factory/skills'),
  firebender: agent('firebender', 'Firebender', '.agents/skills'),
  forgecode: agent('forgecode', 'ForgeCode', '.forge/skills'),
  'gemini-cli': agent(
    'gemini-cli',
    'Gemini CLI',
    '.agents/skills',
    homePath('.gemini/skills')
  ),
  'github-copilot': agent(
    'github-copilot',
    'GitHub Copilot',
    '.agents/skills',
    homePath('.copilot/skills')
  ),
  goose: agent('goose', 'Goose', '.goose/skills', configPath('goose/skills')),
  'iflow-cli': agent('iflow-cli', 'iFlow CLI', '.iflow/skills'),
  junie: agent('junie', 'Junie', '.junie/skills'),
  kilo: agent('kilo', 'Kilo Code', '.kilocode/skills'),
  'kimi-cli': agent(
    'kimi-cli',
    'Kimi Code CLI',
    '.agents/skills',
    configPath('agents/skills')
  ),
  'kiro-cli': agent('kiro-cli', 'Kiro CLI', '.kiro/skills'),
  kode: agent('kode', 'Kode', '.kode/skills'),
  mcpjam: agent('mcpjam', 'MCPJam', '.mcpjam/skills'),
  'mistral-vibe': agent(
    'mistral-vibe',
    'Mistral Vibe',
    '.vibe/skills',
    join(vibeHome, 'skills')
  ),
  mux: agent('mux', 'Mux', '.mux/skills'),
  neovate: agent('neovate', 'Neovate', '.neovate/skills'),
  openclaw: agent(
    'openclaw',
    'OpenClaw',
    'skills',
    homePath('.openclaw/skills')
  ),
  opencode: agent(
    'opencode',
    'OpenCode',
    '.agents/skills',
    configPath('opencode/skills')
  ),
  openhands: agent('openhands', 'OpenHands', '.openhands/skills'),
  pi: agent('pi', 'Pi', '.pi/skills', homePath('.pi/agent/skills')),
  pochi: agent('pochi', 'Pochi', '.pochi/skills'),
  qoder: agent('qoder', 'Qoder', '.qoder/skills'),
  'qwen-code': agent('qwen-code', 'Qwen Code', '.qwen/skills'),
  replit: {
    ...agent('replit', 'Replit', '.agents/skills', configPath('agents/skills')),
    showInPicker: false,
  },
  roo: agent('roo', 'Roo Code', '.roo/skills'),
  rovodev: agent('rovodev', 'Rovo Dev', '.rovodev/skills'),
  'tabnine-cli': agent('tabnine-cli', 'Tabnine CLI', '.tabnine/agent/skills'),
  trae: agent('trae', 'Trae', '.trae/skills'),
  'trae-cn': agent(
    'trae-cn',
    'Trae CN',
    '.trae/skills',
    homePath('.trae-cn/skills')
  ),
  warp: agent('warp', 'Warp', '.agents/skills', homePath('.agents/skills')),
  windsurf: agent(
    'windsurf',
    'Windsurf',
    '.windsurf/skills',
    homePath('.codeium/windsurf/skills')
  ),
  zencoder: agent('zencoder', 'Zencoder', '.zencoder/skills'),
};

/**
 * Look up an agent by id. Throws when the id is not in the registry.
 *
 * @throws Error when `id` is not a known agent.
 */
export const getAgent = (id: string): AgentConfig => {
  const found = agents[id];
  if (!found) {
    throw new Error(`Unknown agent "${id}"`);
  }

  return found;
};

/** Return all agents eligible for the interactive picker (`showInPicker !== false`). */
export const listAgents = (): AgentConfig[] =>
  Object.values(agents).filter((agent) => agent.showInPicker !== false);

/**
 * Detect which agents are installed on the current system. Uses custom
 * `detectInstalled` hooks when provided, otherwise falls back to checking
 * for `~/.{agentId}` directory existence.
 *
 * @example
 * const installed = await detectInstalledAgents({ cwd: '/repo' });
 * // returns: [cursorAgent, claudeCodeAgent]  (both ~/.cursor and ~/.claude exist)
 */
export const detectInstalledAgents = async (
  ctx: Partial<AgentDetectContext> = {}
): Promise<AgentConfig[]> => {
  const fullCtx: AgentDetectContext = {
    cwd: process.cwd(),
    homeDir: home,
    env: process.env,
    pathExists: existsSync,
    ...ctx,
  };
  const results = await Promise.all(
    listAgents().map(async (candidate) => ({
      candidate,
      installed:
        candidate.detectInstalled?.(fullCtx) ??
        fullCtx.pathExists(join(fullCtx.homeDir, `.${candidate.id}`)),
    }))
  );

  return results
    .filter((result) => result.installed)
    .map((result) => result.candidate);
};

function agent(
  id: string,
  displayName: string,
  projectSkillsDir: string,
  globalSkillsDir = homePath(projectSkillsDir)
): AgentConfig {
  return {
    id,
    displayName,
    projectSkillsDir,
    globalSkillsDir,
  };
}
