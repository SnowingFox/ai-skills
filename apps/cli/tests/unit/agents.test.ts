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
});
