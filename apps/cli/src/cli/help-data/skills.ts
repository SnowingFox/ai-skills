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
        'ai-pkgs skills add vercel-labs/skills --global --all --agent cursor --force',
        'Save discovered skills to ~/.ai-pkgs/ai-package.json and install them globally.',
      ],
      [
        'ai-pkgs skills add vercel-labs/skills --global --install-only --all --agent cursor --force',
        'One-off global install that skips the global manifest.',
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
        'ai-pkgs skills vercel-migrate --skip-existing',
        'Migrate legacy Vercel skills-lock.json entries into ai-package.json.',
      ],
      [
        'ai-pkgs skills list',
        'List skills currently declared in ai-package.json with readable grouping.',
      ],
      [
        'ai-pkgs skills list --global',
        'List skills declared in ~/.ai-pkgs/ai-package.json.',
      ],
      [
        'ai-pkgs skills outdated tdd to-prd',
        'Check selected Git-backed skills for newer commits without writing the manifest.',
      ],
      [
        'ai-pkgs skills update tdd --yes',
        'Refresh a selected skill pin after an explicit non-interactive confirmation.',
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
      [
        'ai-pkgs install --global --agent cursor --force',
        'Restore all skills declared in ~/.ai-pkgs/ai-package.json into global agent directories.',
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
        'ai-pkgs skills add https://git.example.com/team/skills.git --agent cursor',
        'Self-hosted GitLab source with the original clone URL preserved in the manifest.',
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
        'ai-pkgs skills add vercel-labs/skills --global --all --agent cursor --force',
        'Save to ~/.ai-pkgs/ai-package.json and install into global Cursor skills.',
      ],
      [
        'ai-pkgs skills add vercel-labs/skills --global --install-only --all --agent cursor --force',
        'One-off global install without writing the global manifest.',
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
        'Print declared skills grouped by source and pinned ref.',
      ],
      [
        'ai-pkgs skills list --json',
        'Print a machine-readable manifest skill list.',
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

const SKILLS_OUTDATED_EXAMPLES: HelpExampleGroup[] = [
  {
    title: 'Check pins',
    examples: [
      [
        'ai-pkgs skills outdated',
        'Check every Git-backed skill in ai-package.json and report without writing.',
      ],
      [
        'ai-pkgs skills outdated tdd to-prd',
        'Check only the named skills; unknown names fail and list available names.',
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
        'Show outdated Git-backed skills and ask before writing in TTY mode.',
      ],
      [
        'ai-pkgs skills update tdd --yes',
        'Update one selected skill pin without prompts for automation.',
      ],
    ],
  },
];

const SKILLS_VERCEL_MIGRATE_EXAMPLES: HelpExampleGroup[] = [
  {
    title: 'Migrate legacy Vercel locks',
    examples: [
      [
        'ai-pkgs skills vercel-migrate --skip-existing',
        'Read skills-lock.json, add missing GitHub skills to ai-package.json, and keep existing manifest entries.',
      ],
      [
        'ai-pkgs skills vercel-migrate --force --remove-lock',
        'Overwrite conflicting manifest entries and remove the old lock file after a successful write.',
      ],
      [
        'ai-pkgs skills vercel-migrate --install --agent cursor --force --yes',
        'Migrate, then install the full ai-package.json into Cursor without prompts.',
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
 * - `ai-pkgs install --global` restores `~/.ai-pkgs/ai-package.json`.
 * - `ai-pkgs skills add <source>` discovers skills from a source, saves them
 *   to `ai-package.json`, then installs them into selected agents.
 * - `ai-pkgs skills add <source> --install-only` uses the same discovery and
 *   install pipeline, but deliberately skips all manifest writes for one-off
 *   installs.
 * - `ai-pkgs skills outdated` reports movable Git pins without writing.
 * - `ai-pkgs skills update` writes only outdated Git pins after confirmation.
 * - `ai-pkgs skills vercel-migrate` migrates legacy Vercel
 *   `skills-lock.json` declarations into `ai-package.json`.
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
    ['skills outdated [skill...] [options]', 'Check for Git skill updates'],
    ['skills update [skill...] [options]', 'Update pinned Git skill versions'],
    [
      'skills vercel-migrate [options]',
      'Migrate Vercel skills-lock.json into ai-package.json',
    ],
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
        ['--refresh', 'Refresh Git cache before installing or migrating'],
        ['--json', 'Print machine-readable output when supported'],
        ['--lockfile <path>', 'Path to legacy skills-lock.json'],
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
        ['--install', 'Install ai-package.json after migrating'],
        ['--project', 'Install into project-local agent skill directories'],
        [
          '-g, --global',
          'Use ~/.ai-pkgs/ai-package.json and global agent directories',
        ],
        ['--verbose', 'Show per-skill install progress and paths'],
        ['-y, --yes', 'Skip confirmation prompts'],
        ['--ai', 'Strict non-interactive mode for AI/automation'],
      ],
    },
    {
      title: 'Project files',
      options: [
        ['-C, --dir <path>', 'Project directory'],
        ['-m, --manifest <path>', 'Path to ai-package.json'],
        ['--remove-lock', 'Remove skills-lock.json after migration'],
      ],
    },
  ],
  exampleGroups: SKILLS_GROUP_EXAMPLES,
  notes: [
    '`skills add` saves to ai-package.json by default; add `--install-only` for direct one-off installs.',
    '`--install-only` cannot be combined with `--manifest` because no manifest is read or written.',
    '`-g, --global` uses the fixed ~/.ai-pkgs/ai-package.json manifest and cannot be combined with `--manifest`.',
    '`skills add --global --install-only` installs globally without writing the global manifest.',
    '`skills add` prompts for project/global scope in TTY; non-TTY and `--ai` default to project unless `--global` is passed.',
    '`skills list --json` prints machine-readable manifest skill entries.',
    '`skills outdated [skill...]` reports all or selected Git-backed skills and never writes ai-package.json.',
    '`skills update [skill...]` reuses outdated results and requires `--yes` in non-TTY or `--ai` mode before writing.',
    '`--all` selects every discovered skill and cannot be combined with `--skill`.',
    '`skills vercel-migrate` supports legacy GitHub lock entries only; use `--force` or `--skip-existing` for non-interactive conflicts.',
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
          [
            '-g, --global',
            'Use ~/.ai-pkgs/ai-package.json and global agent directories',
          ],
          ['--verbose', 'Show per-skill install progress and paths'],
          ['-y, --yes', 'Skip confirmation prompts'],
          ['--ai', 'Strict non-interactive mode for AI/automation'],
        ],
      },
    ],
    exampleGroups: SKILLS_ADD_EXAMPLES,
    notes: [
      'Default behavior writes selected skills to ai-package.json before installing.',
      'Full non-GitHub HTTPS or SSH clone URLs are treated as GitLab sources.',
      '`--install-only` skips manifest writes and conflicts with `--manifest`.',
      '`--project` and `--global` are mutually exclusive; omit both in TTY to choose interactively.',
      '`--global --install-only` installs globally without writing ~/.ai-pkgs/ai-package.json.',
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
      ['-g, --global', 'Read ~/.ai-pkgs/ai-package.json'],
      ['--json', 'Print machine-readable manifest skill entries'],
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
      ['-g, --global', 'Edit ~/.ai-pkgs/ai-package.json'],
    ],
    exampleGroups: SKILLS_REMOVE_EXAMPLES,
  },
  {
    name: 'skills outdated',
    description: 'Check pinned skill versions',
    usageText: 'skills outdated [skill...] [options]',
    options: [
      ['-C, --dir <path>', 'Project directory'],
      ['-m, --manifest <path>', 'Path to ai-package.json'],
      ['-g, --global', 'Check ~/.ai-pkgs/ai-package.json'],
      ['--ai', 'Strict non-interactive mode for AI/automation'],
    ],
    exampleGroups: SKILLS_OUTDATED_EXAMPLES,
    notes: [
      'No skill names means every manifest skill; positional names filter the check.',
      'File sources and marketplace entries are reported as skipped.',
      'Outdated skills still exit 0; failed remote checks exit 1.',
    ],
  },
  {
    name: 'skills update',
    description: 'Update pinned skill versions',
    usageText: 'skills update [skill...] [options]',
    options: [
      ['-C, --dir <path>', 'Project directory'],
      ['-m, --manifest <path>', 'Path to ai-package.json'],
      ['-g, --global', 'Update ~/.ai-pkgs/ai-package.json'],
      ['-y, --yes', 'Confirm writes without prompting'],
      ['--ai', 'Strict non-interactive mode for AI/automation'],
    ],
    exampleGroups: SKILLS_UPDATE_EXAMPLES,
    notes: [
      'No skill names means every manifest skill; positional names filter the update.',
      'The command checks all requested skills first and will not write a partial manifest when any check fails.',
      'TTY mode asks before writing. Non-TTY and `--ai` require `--yes`.',
    ],
  },
  {
    name: 'skills vercel-migrate',
    description: 'Migrate Vercel skills-lock.json into ai-package.json',
    usageText: 'skills vercel-migrate [options]',
    optionGroups: [
      {
        title: 'Migration files',
        options: [
          ['--lockfile <path>', 'Path to legacy skills-lock.json'],
          ['-m, --manifest <path>', 'Path to ai-package.json'],
          ['-C, --dir <path>', 'Project directory'],
          ['--remove-lock', 'Remove skills-lock.json after migration'],
        ],
      },
      {
        title: 'Conflict behavior',
        options: [
          ['--force', 'Overwrite existing manifest entries'],
          ['--skip-existing', 'Keep existing manifest entries'],
          ['--refresh', 'Refresh Git cache while resolving GitHub pins'],
          ['--ai', 'Strict non-interactive mode for AI/automation'],
        ],
      },
      {
        title: 'Optional install',
        options: [
          ['--install', 'Install ai-package.json after migrating'],
          ['-a, --agent <agent>', 'Target agent (repeatable)'],
          ['--copy', 'Copy skill directories (default)'],
          ['--link', 'Symlink skill directories'],
          ['--project', 'Install into project-local agent skill directories'],
          ['--verbose', 'Show per-skill install progress and paths'],
          ['-y, --yes', 'Skip confirmation prompts'],
        ],
      },
    ],
    exampleGroups: SKILLS_VERCEL_MIGRATE_EXAMPLES,
    notes: [
      'Only legacy GitHub lock entries are supported.',
      '`computedHash` is legacy integrity data and is not written to ai-package.json.',
      'Non-interactive conflicts require `--force` or `--skip-existing`.',
      '`--install` runs the normal install flow for the full migrated ai-package.json.',
    ],
    options: [],
  },
  {
    name: 'skills search',
    description: 'Search marketplace skills',
    usageText: 'skills search [query]',
    options: [],
    exampleGroups: SKILLS_SEARCH_EXAMPLES,
  },
];
