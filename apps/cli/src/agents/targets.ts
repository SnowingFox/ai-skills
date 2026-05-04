import { join, resolve } from 'node:path';
import pc from 'picocolors';
import { SilentError } from '../errors';
import { cancelSymbol, searchMultiselect } from '../prompts/search-multiselect';
import { renderLogo } from '../ui/banner';
import { getAgent, listAgents } from './registry';
import type { ResolvedAgentTarget } from './types';

export type ResolveAgentTargetsOptions = {
  agentIds?: string[];
  cwd: string;
  global?: boolean;
  yes?: boolean;
  canPrompt?: boolean;
};

/**
 * Convert `--agent` flags or an interactive selection into concrete skill
 * directories. Agents sharing the same directory, such as the universal
 * `.agents/skills` target, are deduped before install work begins.
 */
export const resolveAgentTargets = async ({
  agentIds = [],
  cwd,
  global = false,
  yes = false,
  canPrompt = process.stdin.isTTY === true,
}: ResolveAgentTargetsOptions): Promise<ResolvedAgentTarget[]> => {
  const selected =
    agentIds.length > 0 ? agentIds : await promptForAgents({ canPrompt, yes });

  const targets = selected.map((id) => {
    const agent = getAgent(id);
    const skillsDir = global
      ? agent.globalSkillsDir
      : resolve(cwd, agent.projectSkillsDir);
    if (!skillsDir) {
      throw new SilentError(
        `${agent.displayName} does not support global install`
      );
    }
    return {
      agentId: agent.id,
      displayName: agent.displayName,
      skillsDir,
    };
  });

  const byPath = new Map<string, ResolvedAgentTarget>();
  for (const target of targets) {
    byPath.set(resolve(target.skillsDir), target);
  }

  return [...byPath.values()];
};

const promptForAgents = async ({
  canPrompt,
  yes,
}: {
  canPrompt: boolean;
  yes: boolean;
}): Promise<string[]> => {
  if (!canPrompt) {
    throw new SilentError(
      'No agents specified. Pass --agent in non-interactive mode.'
    );
  }

  process.stdout.write(`${renderLogo()}\n\n`);

  const choices = listAgents().map((agent) => ({
    label: agent.displayName,
    value: agent.id,
    hint: agent.projectSkillsDir,
  }));
  const initialSelected = yes ? ['universal'] : undefined;
  const selected = await searchMultiselect({
    message: 'Select target agents',
    items: choices,
    initialSelected,
    maxVisible: 10,
    required: true,
  });

  if (selected === cancelSymbol) {
    throw new SilentError('Agent selection cancelled');
  }

  process.stdout.write(
    `${pc.dim('Install targets:')} ${selected
      .map((id) => getAgent(id).projectSkillsDir)
      .join(', ')}\n`
  );
  return selected;
};

export const buildSkillTargetPath = (
  target: ResolvedAgentTarget,
  skillName: string
): string => join(target.skillsDir, sanitizeInstallName(skillName));

export const sanitizeInstallName = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 255) || 'unnamed-skill';
