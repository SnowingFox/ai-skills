import { describe, expect, it } from 'vitest';
import { selectDiscoveredSkills } from '../../src/discovery/select';

describe('selectDiscoveredSkills', () => {
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
