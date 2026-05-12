import type { HelpCommand, HelpExampleGroup } from './types';

const CACHE_CLEAR_EXAMPLES: HelpExampleGroup[] = [
  {
    title: 'Clear Git cache',
    examples: [
      [
        'ai-pkgs cache clear',
        'Clear all cached Git repositories used by skills add and install.',
      ],
      [
        'ai-pkgs cache clear --provider github',
        'Clear only GitHub-backed cache entries.',
      ],
      [
        'ai-pkgs cache clear --provider github --source vercel-labs/skills',
        'Clear cache entries for one source package.',
      ],
    ],
  },
];

/** Help metadata for the `cache` command group. */
export const CACHE_GROUP_COMMAND: HelpCommand = {
  name: 'cache',
  description: 'Manage ai-pkgs cache',
  usageText: 'cache <command> [options]',
  subcommands: [['cache clear [options]', 'Clear cached Git repositories']],
  optionGroups: [
    {
      title: 'Filters',
      options: [
        ['--provider <provider>', 'github or gitlab'],
        ['--source <source>', 'Package source such as owner/repo'],
      ],
    },
  ],
  exampleGroups: CACHE_CLEAR_EXAMPLES,
  notes: [
    'Git cache entries are keyed by provider, source, and resolved commit SHA.',
    '`skills add --refresh` bypasses a cache hit and stores a fresh copy.',
  ],
  options: [],
};

/** Per-subcommand help entries for `cache` subcommands. */
export const CACHE_COMMANDS: HelpCommand[] = [
  {
    name: 'cache clear',
    description: 'Clear cached Git repositories',
    usageText: 'cache clear [options]',
    options: [
      ['--provider <provider>', 'Filter by github or gitlab'],
      ['--source <source>', 'Filter by package source'],
    ],
    exampleGroups: CACHE_CLEAR_EXAMPLES,
  },
];
