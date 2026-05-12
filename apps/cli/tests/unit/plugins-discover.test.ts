import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { discoverPlugins, isPluginDir } from '../../src/plugins/discover';

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'ai-pkgs-discover-'));
});

afterEach(async () => {
  await rm(root, { recursive: true });
});

const writeJson = async (path: string, data: unknown) => {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2));
};

const writeText = async (path: string, text: string) => {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, text);
};

describe('discoverPlugins', () => {
  it('discovers from .claude-plugin/marketplace.json even when .agents/plugins exists (entireio shape)', async () => {
    await writeJson(join(root, '.agents', 'plugins', 'marketplace.json'), {
      name: 'skills',
      interface: { displayName: 'Skills' },
      plugins: [
        {
          name: 'entire',
          source: { source: 'local', path: './' },
          policy: { installation: 'AVAILABLE' },
          category: 'Development',
        },
      ],
    });

    await writeJson(join(root, '.claude-plugin', 'marketplace.json'), {
      name: 'entire-skills',
      owner: { name: 'Entire Inc' },
      plugins: [
        {
          name: 'entire',
          description: 'Cross-agent skills',
          version: '0.3.0',
          source: './',
          category: 'development',
        },
      ],
    });

    await writeJson(join(root, '.claude-plugin', 'plugin.json'), {
      name: 'entire',
      version: '0.3.0',
    });

    await writeText(
      join(root, 'skills', 'explain', 'SKILL.md'),
      '---\nname: explain\ndescription: Explain code\n---\nExplains.'
    );

    const result = await discoverPlugins(root);

    expect(result.plugins).toHaveLength(1);
    expect(result.plugins[0]!.name).toBe('entire');
    expect(result.plugins[0]!.skills.length).toBeGreaterThanOrEqual(1);
    expect(result.remotePlugins).toHaveLength(0);
  });

  it('discovers a scaffolded plugin via isPluginDir when only vendor dirs exist', async () => {
    await writeJson(join(root, '.claude-plugin', 'plugin.json'), {
      name: 'my-plugin',
      version: '0.0.1',
    });

    await writeJson(join(root, '.codex-plugin', 'plugin.json'), {
      name: 'my-plugin',
      version: '0.0.1',
    });

    await writeJson(join(root, '.agents', 'plugins', 'marketplace.json'), {
      name: 'my-plugin',
      plugins: [
        {
          name: 'my-plugin',
          source: { source: 'local', path: './' },
          category: 'Coding',
        },
      ],
    });

    await writeText(
      join(root, 'skills', 'example-skill', 'SKILL.md'),
      '---\nname: example-skill\ndescription: An example\n---\nStub.'
    );

    const result = await discoverPlugins(root);

    expect(result.plugins).toHaveLength(1);
    expect(result.plugins[0]!.name).toBe('my-plugin');
    expect(result.plugins[0]!.skills).toHaveLength(1);
  });

  it('discovers a codex-only repo via isPluginDir hint from .agents/plugins/marketplace.json', async () => {
    await writeJson(join(root, '.agents', 'plugins', 'marketplace.json'), {
      name: 'codex-only',
      plugins: [
        {
          name: 'codex-only',
          source: { source: 'local', path: './' },
          category: 'Coding',
        },
      ],
    });

    await writeText(
      join(root, 'skills', 'foo', 'SKILL.md'),
      '---\nname: foo\ndescription: A skill\n---\nFoo.'
    );

    const result = await discoverPlugins(root);

    expect(result.plugins).toHaveLength(1);
    expect(result.plugins[0]!.skills).toHaveLength(1);
    expect(result.plugins[0]!.skills[0]!.name).toBe('foo');
  });
});

describe('isPluginDir', () => {
  it('returns true for a dir with .agents/plugins/marketplace.json', async () => {
    await writeJson(join(root, '.agents', 'plugins', 'marketplace.json'), {
      plugins: [],
    });

    expect(await isPluginDir(root)).toBe(true);
  });

  it('returns true for a dir with .claude-plugin/plugin.json', async () => {
    await writeJson(join(root, '.claude-plugin', 'plugin.json'), {
      name: 'test',
    });

    expect(await isPluginDir(root)).toBe(true);
  });

  it('returns true for a dir with a skills/ subdirectory', async () => {
    await mkdir(join(root, 'skills'), { recursive: true });

    expect(await isPluginDir(root)).toBe(true);
  });

  it('returns false for an empty dir', async () => {
    expect(await isPluginDir(root)).toBe(false);
  });
});
