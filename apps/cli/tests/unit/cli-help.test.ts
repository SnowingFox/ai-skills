import { readFileSync } from 'node:fs';
import cac from 'cac';
import { describe, expect, it } from 'vitest';
import { renderHelp, renderTree, setupHelpOverride } from '../../src/cli/help';
import { GRAYS, renderLogo } from '../../src/ui/banner';

const ANSI_RE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
const stripAnsi = (value: string) => value.replace(ANSI_RE, '');
const packageVersion = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf-8')
) as { version: string };

describe('cli/help', () => {
  it('renders top-level help with logo, usage, commands, and global flags', () => {
    const cli = buildHelpCli();
    const output = stripAnsi(renderHelp(cli));

    expect(output).toContain('█████╗ ██╗');
    expect(output).toContain('╚═╝  ╚═╝╚═╝');
    expect(output).toContain('Skills and plugins for AI agents.');
    expect(output).toContain(`v${packageVersion.version}`);
    expect(output).toContain('Usage:');
    expect(output).toContain('ai-pkgs <command>');
    expect(output).toContain('Commands:');
    expect(output).toContain('install');
    expect(output).toContain('skills add');
    expect(output).toContain('cache clear');
    expect(output).toContain('help');
    expect(output).toContain('Global flags:');
    expect(output).toContain('--help');
    expect(output).toContain('--ai');
    expect(output).toContain('AI/automation');
    expect(output).toContain('Detailed help:');
    expect(output).toContain('ai-pkgs skills -h');
    expect(output).toContain('ai-pkgs help cache clear');
    expect(output).toContain('Show grouped AI/skills usage');
  });

  it('omits hidden and default commands from top-level help', () => {
    const cli = buildHelpCli();
    cli.command('', '').action(() => {});
    cli.command('hidden', '').action(() => {});

    const output = stripAnsi(renderHelp(cli));

    expect(output).not.toContain('hidden');
  });

  it('renders command detail with flags and usage', () => {
    const cli = buildHelpCli();
    const output = stripAnsi(renderHelp(cli, 'install'));

    expect(output).toContain('ai-pkgs install');
    expect(output).toContain('Install skills from ai-package.json');
    expect(output).toContain('Flags:');
    expect(output).toContain('--agent');
    expect(output).toContain('--verbose');
    expect(output).toContain('Global flags:');
    expect(output).toContain('--help');
    expect(output).toContain('Usage:');
    expect(output).toContain('install [options]');
  });

  it('renders nested command detail', () => {
    const cli = buildHelpCli();
    const output = stripAnsi(renderHelp(cli, 'skills add'));

    expect(output).toContain('ai-pkgs skills add');
    expect(output).toContain('Add skills from a source');
    expect(output).toContain('--registry');
    expect(output).toContain('--install-only');
    expect(output).toContain('--all');
    expect(output).toContain('--global');
    expect(output).toContain('--refresh');
    expect(output).toContain('--verbose');
    expect(output).toContain('--ai');
    expect(output).toContain('Global flags:');
    expect(output).toContain('--help');
    expect(output).toContain('skills add <source> [options]');
    expect(output).toContain('Examples:');
    expect(output).toContain('GitHub and GitLab sources');
    expect(output).toContain('Local file sources');
    expect(output).toContain('Install only (no ai-package.json)');
    expect(output).toContain('AI/automation mode');
    expect(output).toContain('Notes:');
    expect(output).toContain('ai-pkgs skills add vercel-labs/skills');
    expect(output).toContain(
      'ai-pkgs skills add ./local-skills --registry file --agent universal --link'
    );
    expect(output).toContain(
      'ai-pkgs skills add ./local-skills --registry file --install-only --agent universal --link'
    );
  });

  it('renders skills group help with concrete subcommand usages', () => {
    const cli = buildHelpCli();
    const output = stripAnsi(renderHelp(cli, 'skills'));

    expect(output).toContain('ai-pkgs skills');
    expect(output).toContain('Commands:');
    expect(output).toContain('skills add <source> [options]');
    expect(output).toContain('skills list [options]');
    expect(output).toContain('skills remove <skill...> [options]');
    expect(output).toContain('skills outdated [skill...] [options]');
    expect(output).toContain('skills update [skill...] [options]');
    expect(output).toContain('skills vercel-migrate [options]');
    expect(output).toContain('Examples:');
    expect(output).toContain('Source selection');
    expect(output).toContain('Install behavior');
    expect(output).toContain('--lockfile');
    expect(output).toContain('--install');
    expect(output).toContain('--remove-lock');
    expect(output).toContain('--install-only');
    expect(output).toContain('--json');
    expect(output).toContain('--all');
    expect(output).toContain('--project');
    expect(output).toContain('--global');
    expect(output).toContain('--verbose');
    expect(output).toContain('--ai');
    expect(output).toContain('Install only (no manifest writes)');
    expect(output).toContain('AI/automation mode');
    expect(output).toContain('ai-pkgs skills vercel-migrate --skip-existing');
    expect(output).toContain('ai-pkgs skills outdated tdd to-prd');
    expect(output).toContain('ai-pkgs skills add vercel-labs/skills');
    expect(output).toContain('ai-pkgs install --agent cursor --force');
  });

  it('renders skills outdated help', () => {
    const cli = buildHelpCli();
    const output = stripAnsi(renderHelp(cli, 'skills outdated'));

    expect(output).toContain('ai-pkgs skills outdated');
    expect(output).toContain('Check pinned skill versions');
    expect(output).toContain('skills outdated [skill...] [options]');
    expect(output).toContain('ai-pkgs skills outdated tdd to-prd');
    expect(output).toContain('Outdated skills still exit 0');
  });

  it('renders skills vercel-migrate help', () => {
    const cli = buildHelpCli();
    const output = stripAnsi(renderHelp(cli, 'skills vercel-migrate'));

    expect(output).toContain('ai-pkgs skills vercel-migrate');
    expect(output).toContain('Migrate Vercel skills-lock.json');
    expect(output).toContain('--lockfile');
    expect(output).toContain('--remove-lock');
    expect(output).toContain('--install');
    expect(output).toContain('--skip-existing');
    expect(output).toContain('Migrate legacy Vercel locks');
    expect(output).toContain(
      'ai-pkgs skills vercel-migrate --install --agent cursor --force --yes'
    );
    expect(output).toContain('Only legacy GitHub lock entries are supported.');
  });

  it('renders cache clear help', () => {
    const cli = buildHelpCli();
    const output = stripAnsi(renderHelp(cli, 'cache clear'));

    expect(output).toContain('ai-pkgs cache clear');
    expect(output).toContain('Clear cached Git repositories');
    expect(output).toContain('--provider');
    expect(output).toContain('--source');
    expect(output).toContain('ai-pkgs cache clear --provider github');
  });

  it('falls back to root help for unknown commands', () => {
    const cli = buildHelpCli();
    const output = stripAnsi(renderHelp(cli, 'bogus'));

    expect(output).toContain('█████╗ ██╗');
    expect(output).toContain('Commands:');
  });

  it('renders the submodule-style grayscale logo without runtime generation', () => {
    const rawOutput = renderLogo();
    const output = stripAnsi(rawOutput);

    expect(rawOutput).toContain(GRAYS[0]);
    expect(rawOutput).toContain(GRAYS[5]);
    expect(output.split('\n')).toHaveLength(6);
    expect(output).toContain('█████╗ ██╗');
    expect(output).toContain('█████╗██████╔╝');
    expect(output).toContain('╚═════╝ ╚══════╝');
  });

  it('renders tree output with visible commands', () => {
    const cli = buildHelpCli();
    const output = stripAnsi(renderTree(cli));

    expect(output).toContain('ai-pkgs');
    expect(output).toContain('install');
    expect(output).toContain('skills add');
    expect(output).toContain('cache clear');
    expect(output).not.toContain('Global flags:');
  });

  it('registers the custom help callback and tree option', () => {
    const cli = cac('ai-pkgs');
    expect(() => setupHelpOverride(cli)).not.toThrow();
    expect(cli.globalCommand.options.map((option) => option.name)).toContain(
      'ai'
    );
    expect(cli.globalCommand.options.map((option) => option.name)).toContain(
      'tree'
    );
  });
});

const buildHelpCli = () => {
  const cli = cac('ai-pkgs');
  setupHelpOverride(cli);
  cli
    .command('help [...command]', 'Show help for a command')
    .usage('help [command]');
  cli
    .command('cache [...args]', 'Manage ai-pkgs cache')
    .usage('cache <clear> [options]');
  cli
    .command('install', 'Install skills from ai-package.json')
    .usage('install [options]')
    .option('-a, --agent <agent>', 'Target agent')
    .option('--verbose', 'Show per-skill install progress and paths');
  cli
    .command('skills [...args]', 'Manage skills')
    .usage('skills <add|list|remove|update|search> [...args] [options]')
    .option('--registry <registry>', 'Source registry');
  return cli;
};
