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
import { installToPluginCache } from '../../src/plugins/installer/claude';

describe('claude plugin installer', () => {
  let tempRoot = '';

  beforeEach(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'claude-plugin-install-'));
    mockHomeDir.current = join(tempRoot, 'home');
    await mkdir(mockHomeDir.current, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  const samplePlugin = (name = 'marketing-agent'): DiscoveredPlugin => ({
    name,
    version: '1.0.0',
    path: join(tempRoot, 'source'),
    skills: [],
    commands: [],
    agents: [],
    rules: [],
    hasHooks: false,
    hasMcp: false,
    hasLsp: false,
    manifest: null,
  });

  const prepareSource = async () => {
    const sourceDir = join(tempRoot, 'source');
    await mkdir(join(sourceDir, '.claude-plugin'), { recursive: true });
    await writeFile(
      join(sourceDir, '.claude-plugin/plugin.json'),
      JSON.stringify({ name: 'marketing-agent', version: '1.0.0' })
    );
    return sourceDir;
  };

  it('enables plugins when project .claude/settings.json is empty', async () => {
    const sourceDir = await prepareSource();
    const projectDir = join(tempRoot, 'project');
    await mkdir(join(projectDir, '.claude'), { recursive: true });
    await writeFile(join(projectDir, '.claude/settings.json'), '');

    await installToPluginCache(
      [samplePlugin()],
      'user',
      sourceDir,
      './local-plugin',
      projectDir
    );

    const settings = JSON.parse(
      await readFile(join(projectDir, '.claude/settings.json'), 'utf-8')
    );
    expect(settings.enabledPlugins['marketing-agent@local-plugin']).toBe(true);
  });

  it('recovers invalid project .claude/settings.json and enables plugins', async () => {
    const sourceDir = await prepareSource();
    const projectDir = join(tempRoot, 'project');
    await mkdir(join(projectDir, '.claude'), { recursive: true });
    await writeFile(join(projectDir, '.claude/settings.json'), '{not json');

    await installToPluginCache(
      [samplePlugin()],
      'user',
      sourceDir,
      './local-plugin',
      projectDir
    );

    const settings = JSON.parse(
      await readFile(join(projectDir, '.claude/settings.json'), 'utf-8')
    );
    expect(settings.enabledPlugins['marketing-agent@local-plugin']).toBe(true);
  });

  it('merges enabledPlugins into existing project settings', async () => {
    const sourceDir = await prepareSource();
    const projectDir = join(tempRoot, 'project');
    await mkdir(join(projectDir, '.claude'), { recursive: true });
    await writeFile(
      join(projectDir, '.claude/settings.json'),
      JSON.stringify({
        someKey: true,
        enabledPlugins: {
          'old-plugin@old-marketplace': true,
        },
      })
    );

    await installToPluginCache(
      [samplePlugin()],
      'user',
      sourceDir,
      './local-plugin',
      projectDir
    );

    const settings = JSON.parse(
      await readFile(join(projectDir, '.claude/settings.json'), 'utf-8')
    );
    expect(settings.someKey).toBe(true);
    expect(settings.enabledPlugins['old-plugin@old-marketplace']).toBe(true);
    expect(settings.enabledPlugins['marketing-agent@local-plugin']).toBe(true);
  });
});
