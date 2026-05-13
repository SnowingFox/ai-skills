import type { HelpCommand, HelpExampleGroup } from './types';

const WORKSPACE_GROUP_EXAMPLES: HelpExampleGroup[] = [
  {
    title: 'Link an installed skill for iteration',
    examples: [
      [
        'ai-pkgs workspace link explain',
        'Move an installed skill to workspace for editing and pushing.',
      ],
      [
        'ai-pkgs workspace link explain --local .cursor/skills/explain',
        'Link with an explicit local path (required in --ai mode).',
      ],
    ],
  },
  {
    title: 'Add a new skill directly to workspace',
    examples: [
      [
        'ai-pkgs skills add entireio/skills --skill explain --workspace',
        'Install a skill directly into workspace (skip skills[]).',
      ],
    ],
  },
  {
    title: 'Push and pull changes',
    examples: [
      [
        'ai-pkgs workspace push explain',
        'Push local edits to the remote Git repository.',
      ],
      [
        'ai-pkgs workspace push explain -m "feat: improve examples"',
        'Push with a custom commit message.',
      ],
      [
        'ai-pkgs workspace push explain --accept-my-change',
        'Force push when remote has diverged (overwrite remote).',
      ],
      [
        'ai-pkgs workspace pull explain',
        'Pull the latest version from the remote into the local directory.',
      ],
    ],
  },
  {
    title: 'Inspect workspace state',
    examples: [
      ['ai-pkgs workspace list', 'List all workspace skills.'],
      [
        'ai-pkgs workspace status',
        'Show dirty/clean state for all workspace skills.',
      ],
      [
        'ai-pkgs workspace status explain',
        'Check if a specific skill has unpushed changes.',
      ],
    ],
  },
  {
    title: 'Remove a workspace skill',
    examples: [
      [
        'ai-pkgs workspace remove explain',
        'Remove workspace entry and delete local skill files.',
      ],
      [
        'ai-pkgs workspace remove explain --yes',
        'Remove without confirmation prompt.',
      ],
    ],
  },
];

/** Group-level `workspace -h` command with all examples and notes. */
export const WORKSPACE_GROUP_COMMAND: HelpCommand = {
  name: 'workspace',
  description: 'Iterate on skills locally with Git push/pull',
  usageText:
    'workspace <link|remove|push|pull|status|list> [...args] [options]',
  subcommands: [
    ['workspace link <name> [options]', 'Move an installed skill to workspace'],
    [
      'workspace remove <name> [options]',
      'Remove workspace entry and delete local files',
    ],
    ['workspace push <name> [options]', 'Push local changes to remote'],
    ['workspace pull <name> [options]', 'Pull latest from remote into local'],
    ['workspace status [name]', 'Show dirty/clean state vs last push'],
    ['workspace list [options]', 'List all workspace skills'],
  ],
  exampleGroups: WORKSPACE_GROUP_EXAMPLES,
  options: [
    ['--local <path>', 'Local skill path on disk (link)'],
    ['-m, --message <msg>', 'Commit message (push)'],
    ['--accept-my-change', 'Force push when remote has diverged (push)'],
    ['--force', 'Skip overwrite confirmation (pull)'],
    ['-y, --yes', 'Skip confirmation prompts'],
    ['--json', 'Print machine-readable output (list)'],
    ['-C, --dir <path>', 'Project directory'],
    ['--manifest <path>', 'Path to ai-package.json'],
  ],
  notes: [
    'Alias: "ws" (e.g. ai-pkgs ws push explain)',
    'A skill is in skills[] OR workspace.skills, never both.',
    'workspace link only works for skills already in skills[].',
    'For new skills, use: skills add <source> --workspace.',
    'workspace remove deletes the entry and local files.',
    'The branch is locked at link time. Push and pull always target it.',
  ],
};

/** Individual workspace commands shown in root help listing. */
export const WORKSPACE_COMMANDS: HelpCommand[] = [
  {
    name: 'workspace link',
    description: 'Move an installed skill to workspace',
    options: [],
  },
  {
    name: 'workspace remove',
    description: 'Remove workspace entry and delete local files',
    options: [],
  },
  {
    name: 'workspace push',
    description: 'Push local skill changes to remote',
    options: [],
  },
  {
    name: 'workspace pull',
    description: 'Pull latest from remote into local',
    options: [],
  },
  {
    name: 'workspace status',
    description: 'Show workspace skill sync state',
    options: [],
  },
  {
    name: 'workspace list',
    description: 'List workspace skills',
    options: [],
  },
];
