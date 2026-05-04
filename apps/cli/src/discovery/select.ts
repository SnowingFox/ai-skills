import * as p from '@clack/prompts';
import { SilentError } from '../errors';
import type { DiscoveredSkill } from './discover';

export type SelectSkillsOptions = {
  skills: DiscoveredSkill[];
  requestedNames?: string[];
  yes?: boolean;
  canPrompt?: boolean;
};

export const selectDiscoveredSkills = async ({
  skills,
  requestedNames = [],
  yes = false,
  canPrompt = process.stdin.isTTY === true,
}: SelectSkillsOptions): Promise<DiscoveredSkill[]> => {
  if (requestedNames.length > 0) {
    const requested = new Set(requestedNames.map((name) => name.toLowerCase()));
    const selected = skills.filter((skill) =>
      requested.has(skill.name.toLowerCase())
    );
    if (selected.length !== requested.size) {
      throw new SilentError(formatNoMatchingSkills(requestedNames, skills));
    }
    return selected;
  }

  if (skills.length <= 1 || yes) {
    if (skills.length === 0) {
      throw new SilentError(formatNoMatchingSkills([], skills));
    }
    return skills;
  }

  if (!canPrompt) {
    throw new SilentError(
      'Multiple skills found. Pass --skill to select skills in non-interactive mode.'
    );
  }

  const selected = await p.multiselect({
    message: 'Select skills to add',
    options: skills.map((skill) => ({
      label: skill.name,
      value: skill.name,
      hint: skill.description,
    })),
    required: true,
  });

  if (p.isCancel(selected)) {
    throw new SilentError('Skill selection cancelled');
  }

  const names = new Set(selected);
  return skills.filter((skill) => names.has(skill.name));
};

export const formatNoMatchingSkills = (
  requestedNames: string[],
  skills: DiscoveredSkill[]
): string => {
  const lines = [
    requestedNames.length > 0
      ? `No matching skills found for: ${requestedNames.join(', ')}`
      : 'No matching skills found',
  ];

  if (skills.length > 0) {
    lines.push('', 'Available skills:');
    for (const skill of skills) {
      lines.push(`  - ${skill.name} (${skill.path})`);
    }
  }

  return lines.join('\n');
};
