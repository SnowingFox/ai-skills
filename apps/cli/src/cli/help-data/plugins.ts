import type { HelpCommand, HelpExampleGroup } from './types';

const PLUGINS_GROUP_EXAMPLES: HelpExampleGroup[] = [
  {
    title: 'Scaffold a new plugin',
    examples: [
      [
        'ai-pkgs plugins init my-plugin',
        'Create a new plugin directory with vendor manifests and component stubs.',
      ],
      [
        'ai-pkgs plugins init --yes',
        'Scaffold with all defaults (all agents, all components).',
      ],
    ],
  },
  {
    title: 'Add plugins from a source',
    examples: [
      [
        'ai-pkgs plugins add vercel/vercel-plugin --yes',
        'Discover and add all plugins from a GitHub repository.',
      ],
      [
        'ai-pkgs plugins add ./my-plugin --plugin my-plugin',
        'Add a specific plugin from a local directory.',
      ],
    ],
  },
  {
    title: 'Inspect and maintain the manifest',
    examples: [
      [
        'ai-pkgs plugins list',
        'List plugins declared in ai-package.json.',
      ],
      [
        'ai-pkgs plugins outdated',
        'Check all Git-backed plugins for newer commits.',
      ],
      [
        'ai-pkgs plugins update --yes',
        'Refresh all outdated plugin Git pins.',
      ],
      [
        'ai-pkgs plugins remove vercel-plugin',
        'Remove a plugin entry from ai-package.json.',
      ],
    ],
  },
];

const PLUGINS_INIT_EXAMPLES: HelpExampleGroup[] = [
  {
    title: 'Interactive scaffold',
    examples: [
      [
        'ai-pkgs plugins init',
        'Prompt for name, directory, target agents, and components.',
      ],
      [
        'ai-pkgs plugins init my-plugin',
        'Create ./my-plugin with interactive agent and component selection.',
      ],
      [
        'ai-pkgs plugins init my-plugin --agent claude-code --yes',
        'Non-interactive scaffold targeting Claude Code with all components.',
      ],
    ],
  },
];

const PLUGINS_ADD_EXAMPLES: HelpExampleGroup[] = [
  {
    title: 'GitHub sources',
    examples: [
      [
        'ai-pkgs plugins add vercel/vercel-plugin --yes',
        'Discover plugins in a GitHub repo, save to ai-package.json.',
      ],
      [
        'ai-pkgs plugins add owner/repo --plugin my-plugin --ref main',
        'Add a specific plugin pinned to the main branch.',
      ],
    ],
  },
  {
    title: 'Local sources',
    examples: [
      [
        'ai-pkgs plugins add ./my-plugin',
        'Add a local plugin directory to the manifest.',
      ],
      [
        'ai-pkgs plugins add ./plugins --install-only',
        'Install plugins without writing ai-package.json.',
      ],
    ],
  },
  {
    title: 'Global manifest',
    examples: [
      [
        'ai-pkgs plugins add vercel/vercel-plugin --global --yes',
        'Save plugin to ~/.ai-pkgs/ai-package.json.',
      ],
    ],
  },
];

const PLUGINS_LIST_EXAMPLES: HelpExampleGroup[] = [
  {
    title: 'Inspect manifest',
    examples: [
      [
        'ai-pkgs plugins list',
        'Print declared plugins with source and version info.',
      ],
      [
        'ai-pkgs plugins list --json',
        'Print a machine-readable plugin list.',
      ],
      [
        'ai-pkgs plugins list --global',
        'List plugins in ~/.ai-pkgs/ai-package.json.',
      ],
    ],
  },
];

const PLUGINS_REMOVE_EXAMPLES: HelpExampleGroup[] = [
  {
    title: 'Edit manifest',
    examples: [
      [
        'ai-pkgs plugins remove vercel-plugin',
        'Remove from ai-package.json; installed cache directories are left untouched.',
      ],
      [
        'ai-pkgs plugins remove vercel-plugin --uninstall',
        'Remove from manifest and clean agent cache directories.',
      ],
    ],
  },
];

const PLUGINS_OUTDATED_EXAMPLES: HelpExampleGroup[] = [
  {
    title: 'Check pins',
    examples: [
      [
        'ai-pkgs plugins outdated',
        'Check every Git-backed plugin for newer commits without writing.',
      ],
      [
        'ai-pkgs plugins outdated vercel-plugin',
        'Check only the named plugin.',
      ],
    ],
  },
];

const PLUGINS_UPDATE_EXAMPLES: HelpExampleGroup[] = [
  {
    title: 'Refresh pins',
    examples: [
      [
        'ai-pkgs plugins update --yes',
        'Update all outdated Git-backed plugins without prompts.',
      ],
      [
        'ai-pkgs plugins update vercel-plugin --yes',
        'Update one plugin pin.',
      ],
    ],
  },
];

/**
 * `ai-pkgs plugins` is the plugin management command group.
 *
 * Plugins are multi-artifact bundles containing skills, commands, agents,
 * rules, hooks, MCP configs, and LSP configs. They are installed into
 * vendor-specific agent plugin caches rather than skill directories.
 */
export const PLUGINS_GROUP_COMMAND: HelpCommand = {
  name: 'plugins',
  description: 'Manage plugins declared in ai-package.json',
  usageText: 'plugins <command> [...args] [options]',
  subcommands: [
    ['plugins init [name]', 'Scaffold a new plugin template'],
    [
      'plugins add <source> [options]',
      'Discover plugins from GitHub, GitLab, or local source',
    ],
    ['plugins list [options]', 'List manifest plugins'],
    [
      'plugins remove <plugin...> [options]',
      'Remove plugins from the manifest',
    ],
    [
      'plugins outdated [plugin...] [options]',
      'Check for Git plugin updates',
    ],
    [
      'plugins update [plugin...] [options]',
      'Update pinned Git plugin versions',
    ],
  ],
  optionGroups: [
    {
      title: 'Source selection',
      options: [
        ['--registry <registry>', 'github, gitlab, marketplace, or file'],
        ['--ref <ref>', 'Git ref to pin when adding from Git'],
        ['--path <path>', 'Path to scan inside the source'],
        ['-p, --plugin <plugin>', 'Plugin name to add (repeatable)'],
        ['--refresh', 'Refresh Git cache before installing'],
        ['--json', 'Print machine-readable output when supported'],
      ],
    },
    {
      title: 'Install behavior',
      options: [
        ['-a, --agent <agent>', 'Target agent (repeatable)'],
        ['--scope <scope>', 'Install scope: user, project, local'],
        ['--install-only', 'Install without writing ai-package.json'],
        [
          '-g, --global',
          'Use ~/.ai-pkgs/ai-package.json',
        ],
        ['--uninstall', 'Also clean agent directories on remove'],
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
  exampleGroups: PLUGINS_GROUP_EXAMPLES,
  notes: [
    'Plugins are installed into agent plugin caches, not skill directories.',
    'Claude Code: ~/.claude/plugins/cache/, Cursor: shares Claude cache (non-Windows) or ~/.cursor/extensions/ (Windows), Codex: ~/.codex/plugins/cache/.',
    '`plugins init` scaffolds vendor-specific manifests (.claude-plugin/, .cursor-plugin/, .codex-plugin/) based on selected agents.',
    '`plugins add` writes to the `plugins` key in ai-package.json alongside existing skills.',
    '`plugins remove` only removes manifest entries by default; add `--uninstall` to also clean agent directories.',
    '`plugins outdated` and `plugins update` use the same Git ref tracking as skills.',
  ],
  options: [],
};

/**
 * Command-specific help records for each plugins subcommand.
 */
export const PLUGINS_COMMANDS: HelpCommand[] = [
  {
    name: 'plugins init',
    description: 'Scaffold a new plugin template',
    usageText: 'plugins init [name] [options]',
    options: [
      ['-a, --agent <agent>', 'Target agent (repeatable)'],
      ['-y, --yes', 'Use all defaults without prompts'],
      ['--ai', 'Strict non-interactive mode'],
    ],
    exampleGroups: PLUGINS_INIT_EXAMPLES,
    notes: [
      'Prompts for plugin name, directory, target agents, and components.',
      'All components (skills, commands, agents, rules, hooks, .mcp.json) are pre-selected.',
      'Generates vendor-specific directories based on selected agents.',
    ],
  },
  {
    name: 'plugins add',
    description: 'Add plugins from a source',
    usageText: 'plugins add <source> [options]',
    optionGroups: [
      {
        title: 'Source selection',
        options: [
          ['--registry <registry>', 'github, gitlab, marketplace, or file'],
          ['--ref <ref>', 'Git ref to pin'],
          ['--path <path>', 'Path to scan inside the source'],
          ['-p, --plugin <plugin>', 'Plugin name to add (repeatable)'],
          ['--refresh', 'Refresh Git cache before installing'],
        ],
      },
      {
        title: 'Install behavior',
        options: [
          ['-a, --agent <agent>', 'Target agent (repeatable)'],
          ['--scope <scope>', 'Install scope: user, project, local'],
          ['--install-only', 'Install without writing ai-package.json'],
          [
            '-g, --global',
            'Use ~/.ai-pkgs/ai-package.json',
          ],
          ['-y, --yes', 'Skip confirmation prompts'],
          ['--ai', 'Strict non-interactive mode'],
        ],
      },
    ],
    exampleGroups: PLUGINS_ADD_EXAMPLES,
    notes: [
      'Discovers plugins via marketplace.json or directory scanning.',
      'Multiple plugins in a source are presented for selection in TTY mode.',
      '`--install-only` skips manifest writes.',
      '`--global` writes to ~/.ai-pkgs/ai-package.json.',
    ],
    options: [],
  },
  {
    name: 'plugins list',
    description: 'List plugins declared in ai-package.json',
    usageText: 'plugins list [options]',
    options: [
      ['-C, --dir <path>', 'Project directory'],
      ['-m, --manifest <path>', 'Path to ai-package.json'],
      ['-g, --global', 'Read ~/.ai-pkgs/ai-package.json'],
      ['--json', 'Print machine-readable manifest plugin entries'],
    ],
    exampleGroups: PLUGINS_LIST_EXAMPLES,
  },
  {
    name: 'plugins remove',
    description: 'Remove plugins from ai-package.json',
    usageText: 'plugins remove <plugin...> [options]',
    options: [
      ['-C, --dir <path>', 'Project directory'],
      ['-m, --manifest <path>', 'Path to ai-package.json'],
      ['-g, --global', 'Edit ~/.ai-pkgs/ai-package.json'],
      ['--uninstall', 'Also clean agent cache directories'],
      ['-a, --agent <agent>', 'Scope uninstall to specific agents'],
    ],
    exampleGroups: PLUGINS_REMOVE_EXAMPLES,
    notes: [
      'Default behavior removes manifest entries only.',
      '`--uninstall` cleans Claude/Cursor/Codex plugin caches and config files.',
    ],
  },
  {
    name: 'plugins outdated',
    description: 'Check pinned plugin versions',
    usageText: 'plugins outdated [plugin...] [options]',
    options: [
      ['-C, --dir <path>', 'Project directory'],
      ['-m, --manifest <path>', 'Path to ai-package.json'],
      ['-g, --global', 'Check ~/.ai-pkgs/ai-package.json'],
      ['--ai', 'Strict non-interactive mode'],
    ],
    exampleGroups: PLUGINS_OUTDATED_EXAMPLES,
    notes: [
      'No plugin names means every manifest plugin; positional names filter.',
      'Outdated plugins exit 0; failed remote checks exit 1.',
    ],
  },
  {
    name: 'plugins update',
    description: 'Update pinned plugin versions',
    usageText: 'plugins update [plugin...] [options]',
    options: [
      ['-C, --dir <path>', 'Project directory'],
      ['-m, --manifest <path>', 'Path to ai-package.json'],
      ['-g, --global', 'Update ~/.ai-pkgs/ai-package.json'],
      ['-y, --yes', 'Confirm writes without prompting'],
      ['--ai', 'Strict non-interactive mode'],
    ],
    exampleGroups: PLUGINS_UPDATE_EXAMPLES,
    notes: [
      'Checks all requested plugins first and will not write a partial manifest when any check fails.',
      'TTY mode asks before writing. Non-TTY and `--ai` require `--yes`.',
    ],
  },
];
