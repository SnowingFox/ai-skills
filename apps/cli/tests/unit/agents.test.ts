import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listAgents } from '../../src/agents/registry';
import { resolveAgentTargets } from '../../src/agents/targets';

describe('agents', () => {
  it('resolves Cursor to .cursor/skills', async () => {
    const projectDir = '/repo/project';
    const targets = await resolveAgentTargets({
      agentIds: ['cursor'],
      cwd: projectDir,
      canPrompt: false,
    });

    expect(targets).toEqual([
      {
        agentId: 'cursor',
        displayName: 'Cursor',
        skillsDir: join(projectDir, '.cursor/skills'),
      },
    ]);
  });

  it('keeps .agents/skills as an explicit universal target', async () => {
    const projectDir = '/repo/project';
    const targets = await resolveAgentTargets({
      agentIds: ['universal'],
      cwd: projectDir,
      canPrompt: false,
    });

    expect(targets).toEqual([
      {
        agentId: 'universal',
        displayName: 'Universal',
        skillsDir: join(projectDir, '.agents/skills'),
      },
    ]);
    expect(listAgents().map((agent) => agent.id)).toContain('universal');
  });

  it('resolves universal global installs to ~/.agents/skills', async () => {
    const targets = await resolveAgentTargets({
      agentIds: ['universal'],
      cwd: '/repo/project',
      global: true,
      canPrompt: false,
    });

    expect(targets).toEqual([
      {
        agentId: 'universal',
        displayName: 'Universal',
        skillsDir: join(homedir(), '.agents/skills'),
      },
    ]);
  });

  it('keeps amp global installs on ~/.config/agents/skills', async () => {
    const configHome = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
    const targets = await resolveAgentTargets({
      agentIds: ['amp'],
      cwd: '/repo/project',
      global: true,
      canPrompt: false,
    });

    expect(targets).toEqual([
      {
        agentId: 'amp',
        displayName: 'Amp',
        skillsDir: join(configHome, 'agents/skills'),
      },
    ]);
  });
});
