import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockHomeDir } = vi.hoisted(() => ({
  mockHomeDir: { current: '' },
}));

vi.mock('node:os', async (importOriginal) => {
  const mod = await importOriginal<typeof import('node:os')>();
  return {
    ...mod,
    homedir: () => mockHomeDir.current,
  };
});

import type { DiscoveredPlugin } from '../../src/plugins/types';
import {
  enableCursorPluginsForProject,
  installToCursor,
  installToCursorLocalPlugins,
} from '../../src/plugins/installer/cursor';

describe('cursor plugin installer', () => {
  let tempRoot = '';

  beforeEach(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'cursor-plugin-install-'));
    mockHomeDir.current = join(tempRoot, 'home');
    await mkdir(mockHomeDir.current, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  const samplePlugin = (name = 'story'): DiscoveredPlugin => ({
    name,
    path: join(tempRoot, 'source', name),
    skills: [],
    commands: [],
    agents: [],
    rules: [],
    hasHooks: false,
    hasMcp: false,
    hasLsp: false,
    manifest: null,
  });

  it('installs plugins globally without writing project settings', async () => {
    const sourceDir = join(tempRoot, 'source/story');
    await mkdir(join(sourceDir, '.cursor-plugin'), { recursive: true });
    await writeFile(
      join(sourceDir, '.cursor-plugin/plugin.json'),
      JSON.stringify({ name: 'story', version: '1.0.0' })
    );
    const projectDir = join(tempRoot, 'project');
    await mkdir(projectDir, { recursive: true });

    await installToCursor([samplePlugin()], 'user', sourceDir, sourceDir);

    await expect(
      readFile(
        join(
          mockHomeDir.current,
          '.cursor/plugins/local/story/.cursor-plugin/plugin.json'
        ),
        'utf-8'
      )
    ).resolves.toContain('"name":"story"');
    await expect(
      readFile(join(projectDir, '.cursor/settings.json'), 'utf-8')
    ).rejects.toThrow();
  });

  it('enables project settings when projectDir is provided', async () => {
    const sourceDir = join(tempRoot, 'source/story');
    await mkdir(join(sourceDir, '.cursor-plugin'), { recursive: true });
    await writeFile(
      join(sourceDir, '.cursor-plugin/plugin.json'),
      JSON.stringify({ name: 'story', version: '1.0.0' })
    );
    const projectDir = join(tempRoot, 'project');
    await mkdir(projectDir, { recursive: true });

    await installToCursor(
      [samplePlugin()],
      'user',
      sourceDir,
      sourceDir,
      false,
      projectDir
    );

    await expect(
      readFile(join(projectDir, '.cursor/settings.json'), 'utf-8')
    ).resolves.toContain('"story"');
  });

  it('merges existing project plugin settings', async () => {
    const projectDir = join(tempRoot, 'project');
    await mkdir(join(projectDir, '.cursor'), { recursive: true });
    await writeFile(
      join(projectDir, '.cursor/settings.json'),
      JSON.stringify({
        plugins: {
          cloudflare: { enabled: true },
        },
      })
    );

    await enableCursorPluginsForProject([samplePlugin()], projectDir);

    const settings = JSON.parse(
      await readFile(join(projectDir, '.cursor/settings.json'), 'utf-8')
    );
    expect(settings.plugins.cloudflare.enabled).toBe(true);
    expect(settings.plugins.story.enabled).toBe(true);
  });

  it('copies plugin files into the local plugins directory', async () => {
    const sourceDir = join(tempRoot, 'source/story');
    await mkdir(join(sourceDir, '.cursor-plugin'), { recursive: true });
    await writeFile(
      join(sourceDir, '.cursor-plugin/plugin.json'),
      JSON.stringify({ name: 'story', version: '1.0.0' })
    );

    await installToCursorLocalPlugins([samplePlugin()]);

    await expect(
      readFile(
        join(
          mockHomeDir.current,
          '.cursor/plugins/local/story/.cursor-plugin/plugin.json'
        ),
        'utf-8'
      )
    ).resolves.toContain('"name":"story"');
  });
});
