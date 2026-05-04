import { describe, expect, it } from 'vitest';
import { selectDiscoveredSkills } from '../../src/discovery/select';

describe('selectDiscoveredSkills', () => {
  it('selects all discovered skills with the all option', async () => {
    await expect(
      selectDiscoveredSkills({
        skills: [
          skill('create-prd', 'skills/create-prd'),
          skill('execute-prd', 'skills/execute-prd'),
        ],
        all: true,
        canPrompt: false,
      })
    ).resolves.toEqual([
      skill('create-prd', 'skills/create-prd'),
      skill('execute-prd', 'skills/execute-prd'),
    ]);
  });

  it('rejects combining all and requested skill names', async () => {
    await expect(
      selectDiscoveredSkills({
        skills: [skill('create-prd', 'skills/create-prd')],
        all: true,
        requestedNames: ['create-prd'],
        canPrompt: false,
      })
    ).rejects.toThrow('--all cannot be used with --skill');
  });

  it('lists available skills when requested names do not match', async () => {
    await expect(
      selectDiscoveredSkills({
        skills: [
          skill('create-prd', 'skills/create-prd'),
          skill('execute-prd', 'skills/execute-prd'),
        ],
        requestedNames: ['write-a-prd'],
        canPrompt: false,
      })
    ).rejects.toThrow(
      [
        'No matching skills found for: write-a-prd',
        '',
        'Available skills:',
        '  - create-prd (skills/create-prd)',
        '  - execute-prd (skills/execute-prd)',
      ].join('\n')
    );
  });
});

const skill = (name: string, path: string) => ({
  name,
  path,
  absolutePath: `/repo/${path}`,
  rawSkillMd: `# ${name}`,
});
