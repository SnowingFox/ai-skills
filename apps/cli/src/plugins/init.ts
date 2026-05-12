import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Options for scaffolding a new plugin. */
export type InitPluginOptions = {
  name: string;
  directory: string;
  agents: string[];
  components: string[];
};

/**
 * Scaffold a new plugin directory with vendor manifests and component stubs.
 */
export const initPlugin = async (
  options: InitPluginOptions
): Promise<string> => {
  const pluginDir = options.directory;
  await mkdir(pluginDir, { recursive: true });

  const manifest = {
    name: options.name,
    description: '',
    version: '0.0.1',
  };

  for (const agent of options.agents) {
    const vendorDir = agentToVendorDir(agent);
    if (vendorDir) {
      const dir = join(pluginDir, vendorDir);
      await mkdir(dir, { recursive: true });
      await writeFile(
        join(dir, 'plugin.json'),
        `${JSON.stringify(manifest, null, 2)}\n`
      );
    }
  }

  const marketplaceDir = join(pluginDir, '.agents', 'plugins');
  await mkdir(marketplaceDir, { recursive: true });
  await writeFile(
    join(marketplaceDir, 'marketplace.json'),
    `${JSON.stringify(
      {
        name: options.name,
        interface: {
          displayName:
            options.name.charAt(0).toUpperCase() + options.name.slice(1),
        },
        plugins: [
          {
            name: options.name,
            source: { source: 'local', path: './' },
            policy: {
              installation: 'AVAILABLE',
              authentication: 'ON_INSTALL',
            },
            category: 'Coding',
          },
        ],
      },
      null,
      2
    )}\n`
  );

  for (const component of options.components) {
    await generateComponentStub(pluginDir, options.name, component);
  }

  await writeFile(join(pluginDir, 'README.md'), generateReadme(options.name));

  return pluginDir;
};

const agentToVendorDir = (agent: string): string | null => {
  switch (agent) {
    case 'claude-code':
      return '.claude-plugin';
    case 'cursor':
      return '.cursor-plugin';
    case 'codex':
      return '.codex-plugin';
    default:
      return null;
  }
};

const generateComponentStub = async (
  pluginDir: string,
  pluginName: string,
  component: string
): Promise<void> => {
  switch (component) {
    case 'skills': {
      const dir = join(pluginDir, 'skills', 'example-skill');
      await mkdir(dir, { recursive: true });
      await writeFile(
        join(dir, 'SKILL.md'),
        [
          '---',
          'name: example-skill',
          `description: An example skill for ${pluginName}`,
          '---',
          '',
          'Example skill stub. Replace this with your skill content.',
          '',
        ].join('\n')
      );
      break;
    }
    case 'commands': {
      const dir = join(pluginDir, 'commands');
      await mkdir(dir, { recursive: true });
      await writeFile(
        join(dir, 'example-command.md'),
        [
          '---',
          'description: An example command',
          '---',
          '',
          'Example command stub. Replace this with your command content.',
          '',
        ].join('\n')
      );
      break;
    }
    case 'agents': {
      const dir = join(pluginDir, 'agents');
      await mkdir(dir, { recursive: true });
      await writeFile(
        join(dir, 'example-agent.md'),
        [
          '---',
          'name: example-agent',
          `description: An example agent for ${pluginName}`,
          '---',
          '',
          'Example agent stub. Replace this with your agent definition.',
          '',
        ].join('\n')
      );
      break;
    }
    case 'rules': {
      const dir = join(pluginDir, 'rules');
      await mkdir(dir, { recursive: true });
      await writeFile(
        join(dir, 'example-rule.mdc'),
        [
          '---',
          'description: An example rule',
          '---',
          '',
          'Example rule stub. Replace this with your rule content.',
          '',
        ].join('\n')
      );
      break;
    }
    case 'hooks': {
      const dir = join(pluginDir, 'hooks');
      await mkdir(dir, { recursive: true });
      await writeFile(
        join(dir, 'hooks.json'),
        `${JSON.stringify(
          {
            hooks: {
              PostToolUse: [
                {
                  matcher: '.*',
                  hooks: [
                    {
                      type: 'command',
                      command: 'echo "hello ai-pkgs"',
                    },
                  ],
                },
              ],
            },
          },
          null,
          2
        )}\n`
      );
      break;
    }
    case '.mcp.json': {
      await writeFile(
        join(pluginDir, '.mcp.json'),
        `${JSON.stringify({ mcpServers: {} }, null, 2)}\n`
      );
      break;
    }
  }
};

const generateReadme = (name: string): string =>
  [
    `# ${name}`,
    '',
    'A plugin for AI coding agents.',
    '',
    '## Installation',
    '',
    '```bash',
    `npx ai-pkgs plugins add ./${name}`,
    '```',
    '',
  ].join('\n');

/** All available component choices for the init prompt. */
export const INIT_COMPONENTS = [
  'skills',
  'commands',
  'agents',
  'rules',
  'hooks',
  '.mcp.json',
] as const;

/** Plugin-capable agents for the init prompt. */
export const INIT_AGENTS = [
  { id: 'claude-code', name: 'Claude Code' },
  { id: 'cursor', name: 'Cursor' },
  { id: 'codex', name: 'Codex' },
] as const;
