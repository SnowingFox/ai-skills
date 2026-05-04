import type { HelpCommand, HelpExampleGroup } from './types';

const SKILLS_GROUP_EXAMPLES: HelpExampleGroup[] = [
  {
    title: 'Add and save to ai-package.json',
    examples: [
      [
        'ai-pkgs skills add vercel-labs/skills --all --agent cursor --project',
        'Use the default GitHub registry, save all discovered skills, then install to project Cursor.',
      ],
      [
        'ai-pkgs skills add https://github.com/mattpocock/skills --path skills --skill tdd',
        'Add a specific skill from an explicit GitHub URL and source subdirectory.',
      ],
      [
        'ai-pkgs skills add ./local-skills --registry file --agent universal --link',
        'Add local file-system skills, save them to the manifest, and link into .agents/skills.',
      ],
    ],
  },
  {
    title: 'Install only (no manifest writes)',
    examples: [
      [
        'ai-pkgs skills add ./local-skills --registry file --install-only --agent universal --link',
        'Directly install local skills without creating or updating ai-package.json.',
      ],
      [
        'ai-pkgs skills add vercel-labs/skills --install-only --global --agent cursor --force',
        'One-off global install from GitHub into Cursor, overwriting existing target folders.',
      ],
    ],
  },
  {
    title: 'AI/automation mode',
    examples: [
      [
        'ai-pkgs --ai skills add vercel-labs/skills --install-only --all --agent cursor --force --yes',
        'Run without prompts; every decision that could require interaction is passed explicitly.',
      ],
    ],
  },
  {
    title: 'Inspect and maintain the manifest',
    examples: [
      [
        'ai-pkgs skills list',
        'List skills currently declared in ai-package.json.',
      ],
      [
        'ai-pkgs skills update tdd --agent cursor --force',
        'Refresh pinned Git SHA for a declared skill, then reinstall if requested.',
      ],
      [
        'ai-pkgs skills remove tdd reviewer',
        'Remove skill entries from ai-package.json without deleting installed folders.',
      ],
    ],
  },
  {
    title: 'Restore from ai-package.json',
    examples: [
      [
        'ai-pkgs install --agent cursor --force',
        'Install all skills declared in ai-package.json; this command does not accept a source.',
      ],
    ],
  },
];

const SKILLS_ADD_EXAMPLES: HelpExampleGroup[] = [
  {
    title: 'GitHub and GitLab sources',
    examples: [
      [
        'ai-pkgs skills add vercel-labs/skills --all --agent cursor --project',
        'Default GitHub shorthand. Saves every discovered skill and installs to project Cursor.',
      ],
      [
        'ai-pkgs skills add https://github.com/mattpocock/skills --path skills --skill tdd --global',
        'Explicit GitHub URL with a source subdirectory and selected skill.',
      ],
      [
        'ai-pkgs skills add https://gitlab.example.com/group/repo.git --registry gitlab --agent cursor',
        'GitLab source with the original clone URL preserved in the manifest.',
      ],
    ],
  },
  {
    title: 'Local file sources',
    examples: [
      [
        'ai-pkgs skills add ./local-skills --registry file --agent universal --link',
        'Save local skills to ai-package.json and link them into .agents/skills.',
      ],
      [
        'ai-pkgs skills add ./local-skills --registry file --skill tdd --agent cursor',
        'Install one local skill into Cursor while preserving manifest state.',
      ],
    ],
  },
  {
    title: 'Install only (no ai-package.json)',
    examples: [
      [
        'ai-pkgs skills add ./local-skills --registry file --install-only --agent universal --link',
        'Direct local install without creating or updating ai-package.json.',
      ],
      [
        'ai-pkgs skills add vercel-labs/skills --install-only --all --agent cursor --force',
        'One-off GitHub install into Cursor, overwriting existing targets.',
      ],
    ],
  },
  {
    title: 'AI/automation mode',
    examples: [
      [
        'ai-pkgs --ai skills add ./local-skills --registry file --all --install-only --agent cursor --skip-existing --yes',
        'Strict non-interactive install where source, skill, target, and conflict policy are all explicit.',
      ],
    ],
  },
];

const SKILLS_LIST_EXAMPLES: HelpExampleGroup[] = [
  {
    title: 'Inspect manifest',
    examples: [
      [
        'ai-pkgs skills list',
        'Print each declared skill with source and path.',
      ],
      [
        'ai-pkgs skills list --manifest config/ai-package.json',
        'Read a non-default manifest path.',
      ],
    ],
  },
];

const SKILLS_REMOVE_EXAMPLES: HelpExampleGroup[] = [
  {
    title: 'Edit manifest',
    examples: [
      [
        'ai-pkgs skills remove tdd reviewer',
        'Remove entries from ai-package.json; installed folders are left untouched.',
      ],
    ],
  },
];

const SKILLS_UPDATE_EXAMPLES: HelpExampleGroup[] = [
  {
    title: 'Refresh pins',
    examples: [
      [
        'ai-pkgs skills update',
        'Update all Git-backed skills in ai-package.json.',
      ],
      [
        'ai-pkgs skills update tdd --agent cursor --force',
        'Update one skill pin and reinstall it into Cursor if needed.',
      ],
    ],
  },
];

const SKILLS_SEARCH_EXAMPLES: HelpExampleGroup[] = [
  {
    title: 'Marketplace discovery',
    examples: [
      [
        'ai-pkgs skills search testing',
        'Search marketplace skills by keyword once marketplace search is available.',
      ],
    ],
  },
];

/**
 * `ai-pkgs skills` is the package-management command group.
 *
 * Usage model:
 * - `ai-pkgs install` restores everything declared in `ai-package.json`.
 * - `ai-pkgs skills add <source>` discovers skills from a source, saves them
 *   to `ai-package.json`, then installs them into selected agents.
 * - `ai-pkgs skills add <source> --install-only` uses the same discovery and
 *   install pipeline, but deliberately skips all manifest writes for one-off
 *   installs.
 *
 * The group help intentionally repeats important add/install flags so users do
 * not have to jump between `skills --help` and `skills add --help` to discover
 * direct-install, local-file, link/copy, and conflict-resolution flows.
 */
export const SKILLS_GROUP_COMMAND: HelpCommand = {
  name: 'skills',
  description: 'Manage skills declared in ai-package.json',
  usageText: 'skills <command> [...args] [options]',
  subcommands: [
    [
      'skills add <source> [options]',
      'Discover skills from GitHub, GitLab, file, or marketplace source',
    ],
    ['skills list [options]', 'List manifest skills'],
    ['skills remove <skill...> [options]', 'Remove skills from the manifest'],
    ['skills update [skill...] [options]', 'Update pinned Git skill versions'],
    ['skills search [query]', 'Search marketplace skills'],
  ],
  optionGroups: [
    {
      title: 'Source selection',
      options: [
        ['--registry <registry>', 'github, gitlab, marketplace, or file'],
        ['--ref <ref>', 'Git ref to pin when adding from Git'],
        ['--path <path>', 'Path to scan inside the source'],
        ['-s, --skill <skill>', 'Skill name to add (repeatable)'],
        ['--all', 'Select all discovered skills'],
        ['--refresh', 'Refresh Git cache before installing'],
      ],
    },
    {
      title: 'Install behavior',
      options: [
        ['-a, --agent <agent>', 'Target agent (repeatable)'],
        ['--copy', 'Copy skill directories (default)'],
        ['--link', 'Symlink skill directories'],
        ['--force', 'Overwrite existing skill directories'],
        ['--skip-existing', 'Skip existing skill directories'],
        ['--install-only', 'Install without writing ai-package.json'],
        ['--project', 'Install into project-local agent skill directories'],
        ['--global', 'Install into global agent skill directories'],
        ['-y, --yes', 'Skip confirmation prompts'],
        ['--ai', 'Strict non-interactive mode for AI/automation'],
      ],
    },
    {
      title: 'Project files',
      options: [
        ['-C, --dir <path>', 'Project directory'],
        ['-m, --manifest <path>', 'Path to ai-package.json'],
      ],
    },
  ],
  exampleGroups: SKILLS_GROUP_EXAMPLES,
  notes: [
    '`skills add` saves to ai-package.json by default; add `--install-only` for direct one-off installs.',
    '`--install-only` cannot be combined with `--manifest` because no manifest is read or written.',
    '`skills add` prompts for project/global scope in TTY; non-TTY and `--ai` default to project unless `--global` is passed.',
    '`--all` selects every discovered skill and cannot be combined with `--skill`.',
    '`--ai` disables all prompts; pass `--agent`, `--skill`, `--force`, `--skip-existing`, or `--yes` explicitly when needed.',
  ],
  options: [],
};

/**
 * Command-specific help records. Each entry documents:
 * - `usageText`: the literal command syntax shown in help output.
 * - `optionGroups`: related flags grouped by user intent.
 * - `exampleGroups`: scenario-based examples with a short explanation.
 * - `notes`: special cases that change persistence or install behavior.
 */
export const SKILLS_COMMANDS: HelpCommand[] = [
  {
    name: 'skills add',
    description: 'Add skills from a source',
    usageText: 'skills add <source> [options]',
    optionGroups: [
      {
        title: 'Source selection',
        options: [
          ['--registry <registry>', 'github, gitlab, marketplace, or file'],
          ['--ref <ref>', 'Git ref to pin'],
          ['--path <path>', 'Path to scan inside the source'],
          ['-s, --skill <skill>', 'Skill name to add (repeatable)'],
          ['--all', 'Select all discovered skills'],
          ['--refresh', 'Refresh Git cache before installing'],
        ],
      },
      {
        title: 'Install behavior',
        options: [
          ['-a, --agent <agent>', 'Target agent (repeatable)'],
          ['--copy', 'Copy skill directories (default)'],
          ['--link', 'Symlink skill directories'],
          ['--force', 'Overwrite existing skill directories'],
          ['--skip-existing', 'Skip existing skill directories'],
          ['--install-only', 'Install without writing ai-package.json'],
          ['--project', 'Install into project-local agent skill directories'],
          ['--global', 'Install into global agent skill directories'],
          ['-y, --yes', 'Skip confirmation prompts'],
          ['--ai', 'Strict non-interactive mode for AI/automation'],
        ],
      },
    ],
    exampleGroups: SKILLS_ADD_EXAMPLES,
    notes: [
      'Default behavior writes selected skills to ai-package.json before installing.',
      '`--install-only` skips manifest writes and conflicts with `--manifest`.',
      '`--project` and `--global` are mutually exclusive; omit both in TTY to choose interactively.',
      '`--all` and `--skill` are mutually exclusive.',
      '`--ai` disables prompts; pass `--agent`, `--skill`, and conflict flags explicitly.',
    ],
    options: [],
  },
  {
    name: 'skills list',
    description: 'List skills declared in ai-package.json',
    usageText: 'skills list [options]',
    options: [
      ['-C, --dir <path>', 'Project directory'],
      ['-m, --manifest <path>', 'Path to ai-package.json'],
    ],
    exampleGroups: SKILLS_LIST_EXAMPLES,
  },
  {
    name: 'skills remove',
    description: 'Remove skills from ai-package.json',
    usageText: 'skills remove <skill...> [options]',
    options: [
      ['-C, --dir <path>', 'Project directory'],
      ['-m, --manifest <path>', 'Path to ai-package.json'],
    ],
    exampleGroups: SKILLS_REMOVE_EXAMPLES,
  },
  {
    name: 'skills update',
    description: 'Update pinned skill versions',
    usageText: 'skills update [skill...] [options]',
    options: [
      ['-C, --dir <path>', 'Project directory'],
      ['-m, --manifest <path>', 'Path to ai-package.json'],
    ],
    exampleGroups: SKILLS_UPDATE_EXAMPLES,
  },
  {
    name: 'skills search',
    description: 'Search marketplace skills',
    usageText: 'skills search [query]',
    options: [],
    exampleGroups: SKILLS_SEARCH_EXAMPLES,
  },
];
