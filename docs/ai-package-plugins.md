# Plugin Package Management Technical Plan

This document defines the design for `ai-pkgs` plugin package management.
Plugins extend the existing skills infrastructure with richer, multi-artifact
bundles that include skills, commands, agents, rules, hooks, MCP configs, and
LSP configs. The manifest, source resolution, and Git cache layers are shared
with skills; installation requires new vendor-specific strategies.

The reference implementation lives in `submodule/plugins/index.ts`. Its
discovery, installation, and env-var translation logic is ported into the
`ai-pkgs` CLI architecture rather than consumed as a dependency.

## Plugin vs Skill

A **skill** is a single `SKILL.md` plus supporting files, installed into an
agent's skill directory.

A **plugin** is a bundle that may contain any combination of:

- `skills/` — one or more skill directories
- `commands/` — markdown command definitions
- `agents/` — agent persona definitions
- `rules/` — rule files (`.mdc`, `.md`)
- `hooks/hooks.json` — lifecycle hooks
- `.mcp.json` — MCP server configuration
- `.lsp.json` — LSP server configuration
- `.plugin/plugin.json` — plugin manifest (vendor-neutral)
- `.claude-plugin/plugin.json` — Claude Code plugin manifest
- `.cursor-plugin/plugin.json` — Cursor plugin manifest
- `.codex-plugin/plugin.json` — Codex plugin manifest

Skills are copied into agent skill directories. Plugins require vendor-specific
installation: cache directories, JSON/TOML config mutations, marketplace
registration, and env-var translation.

## Manifest Shape

Plugins live in the same `ai-package.json` alongside skills under a new
top-level `plugins` key. One manifest, two resource types.

```json
{
  "skills": {
    "find-skills": {
      "source": "github:vercel-labs/skills",
      "version": "main@df0579f85cb8a360473c921e1343359006100d3c",
      "path": "skills/find-skills"
    }
  },
  "plugins": {
    "vercel-plugin": {
      "source": "github:vercel/vercel-plugin",
      "version": "main@abc123def456789012345678901234567890abcd",
      "path": "."
    },
    "my-local-plugin": {
      "source": "file:./plugins/my-plugin",
      "path": "."
    }
  }
}
```

### Field Rules

`plugins` is a top-level object keyed by installed plugin name. The key can
differ from the source directory name.

`source` uses `<provider>:<package-id>`, identical to skills:

- `github:owner/repo`
- `gitlab:https://host/group/repo.git`
- `marketplace:owner/package`
- `file:relative-or-absolute-path`

`version` is required for remote sources. Git-backed sources use
`<ref>@<commitSha>`, identical to skills. The same version tracking, resolution,
and update logic applies.

`path` is required. It points to the plugin directory inside the resolved
source. Defaults to `.` when the entire repo is the plugin. Must stay inside
the source root.

### Scope

Project-local `ai-package.json` by default. `--global` writes to
`~/.ai-pkgs/ai-package.json`. Install targets are always global agent
directories regardless of manifest scope (unlike skills which can install
locally).

## Commands

### `ai-pkgs plugins init [name]`

Scaffold a new plugin template with interactive prompts.

```bash
ai-pkgs plugins init
ai-pkgs plugins init my-plugin
ai-pkgs plugins init --yes
```

Interactive flow:

```
◇  Plugin name?
│  my-plugin

◇  Where to create?  (default: ./my-plugin)
│  _

◇  Target agents?  (space to toggle, enter to confirm)
│  ● Claude Code
│  ● Cursor
│  ● Codex

◇  Components to include?  (all selected by default)
│  ● skills/
│  ● commands/
│  ● agents/
│  ● rules/
│  ● hooks/
│  ● .mcp.json
```

Behavior:

- Prompts for plugin name, target directory (default `./<name>`), target agents,
  and components to include.
- All components are pre-selected in the multi-select; users deselect what they
  don't need.
- Generates vendor-specific plugin directories (`.claude-plugin/`,
  `.cursor-plugin/`, `.codex-plugin/`) based on selected agents, each with a
  minimal `plugin.json`.
- Generates stub files for selected components. Hook stubs use simple
  `echo hello ai-pkgs` commands rather than env-var-dependent paths.
- `--yes` uses defaults: all agents, all components, directory `./<name>`.
- Non-interactive mode (`--ai`) requires `--yes` and uses all defaults.

Generated structure (all agents, all components selected):

```
my-plugin/
  .claude-plugin/
    plugin.json
  .cursor-plugin/
    plugin.json
  .codex-plugin/
    plugin.json
  skills/
    example-skill/
      SKILL.md
  commands/
    example-command.md
  agents/
    example-agent.md
  rules/
    example-rule.mdc
  hooks/
    hooks.json
  .mcp.json
  README.md
```

### `ai-pkgs plugins add <source>`

Resolve a source, discover plugins, let the user choose, write manifest
entries, and install to detected agents.

```bash
ai-pkgs plugins add vercel/vercel-plugin
ai-pkgs plugins add owner/repo --registry github
ai-pkgs plugins add ./local-plugin
ai-pkgs plugins add owner/repo --plugin my-plugin --agent cursor --yes
```

Flags:

- `--registry github|gitlab|marketplace` — source interpretation (default:
  `github`).
- `--plugin <name>` — filter by plugin name. Multiple `--plugin` flags allowed.
- `--agent <id>` — target agent(s). Prompts when omitted in TTY.
- `--ref <branch|tag>` — Git ref to pin (default: repository default branch).
- `--global` — write to `~/.ai-pkgs/ai-package.json`.
- `--install-only` — install without writing manifest.
- `--refresh` — re-clone ignoring Git cache.
- `--yes` / `-y` — skip confirmation prompts.

Flow:

1. Resolve source via existing `SourceRegistry` (reuses `src/registries/`).
2. Discover plugins in the materialized tree (see Discovery below).
3. If multiple plugins found and no `--plugin` filter: prompt with searchable
   multi-select in TTY, fail in non-TTY.
4. Resolve agent targets via existing `resolveAgentTargets` (reuses
   `src/agents/`).
5. Install selected plugins to each target agent (vendor-specific, see
   Installation below).
6. Write manifest entries to `ai-package.json` unless `--install-only`.

### `ai-pkgs plugins list`

List plugins declared in `ai-package.json`.

```bash
ai-pkgs plugins list
ai-pkgs plugins list --json
ai-pkgs plugins list --global
```

Output format matches `skills list`: ASCII Clack output in TTY, stable plain
text in non-TTY/`--ai`, `--json` for machine output.

### `ai-pkgs plugins outdated [plugin...]`

Check for available updates. Report-only, does not modify anything.

```bash
ai-pkgs plugins outdated
ai-pkgs plugins outdated vercel-plugin
```

Reuses the same Git-based version tracking as `skills outdated`: checks if the
tracked branch now points to a newer commit SHA. No arguments checks all
manifest plugins; positional names filter.

Exit codes: 0 when outdated results found, 1 when checks fail.

### `ai-pkgs plugins update [plugin...]`

Update plugins to latest versions.

```bash
ai-pkgs plugins update
ai-pkgs plugins update vercel-plugin --yes
```

Reuses the `outdated` check result, then re-resolves, re-installs, and rewrites
manifest entries. Requires `--yes` in non-TTY/`--ai`.

Groups work by `provider + packageId + ref` and reuses the existing
ref-resolution/cache boundaries, identical to `skills update`.

### `ai-pkgs plugins remove <plugin...>`

Remove plugins from the manifest.

```bash
ai-pkgs plugins remove vercel-plugin
ai-pkgs plugins remove vercel-plugin --uninstall
ai-pkgs plugins remove vercel-plugin --uninstall --agent cursor
```

Default behavior removes the entry from `ai-package.json` only. The installed
files in agent cache directories remain.

`--uninstall` also cleans agent directories:

- Claude Code: removes from `~/.claude/plugins/cache/`, updates
  `installed_plugins.json`, removes from `settings.json` `enabledPlugins`.
- Cursor (non-Windows): removes from Claude plugin cache.
- Cursor (Windows): removes from `~/.cursor/extensions/`, updates
  `extensions.json`.
- Codex: removes from `~/.codex/plugins/cache/`, updates `config.toml`,
  updates `~/.agents/plugins/marketplace.json`.

`--agent` scopes the uninstall to specific agents.

### `ai-pkgs install` (Unified Restore)

The existing `install` command restores both skills and plugins from
`ai-package.json`. It reads the manifest, processes the `skills` section
through the existing skill installer, and processes the `plugins` section
through the plugin installer.

```bash
ai-pkgs install --agent cursor --yes
ai-pkgs install --global
```

No changes to the `install` command surface. It gains plugin support by reading
the `plugins` key from the same manifest.

## Plugin Discovery

During `plugins add`, discovery identifies plugins in a materialized source
tree. The logic is ported from `submodule/plugins/index.ts`.

### Discovery Priority

1. **Marketplace manifest**: look for `marketplace.json` in the repo root,
   `.plugin/`, `.claude-plugin/`, `.cursor-plugin/`, `.codex-plugin/`. If found,
   read the explicit plugin listing with source paths and metadata.

2. **Root-is-plugin**: check if the repo root itself is a plugin directory
   (has `.plugin/plugin.json`, `.claude-plugin/plugin.json`, `skills/`,
   `commands/`, `agents/`, or `SKILL.md`).

3. **Recursive scan**: scan subdirectories up to depth 2 for plugin directories.

### Plugin Directory Detection

A directory is considered a plugin if it contains any of:

- `.plugin/plugin.json`
- `.claude-plugin/plugin.json`
- `.cursor-plugin/plugin.json`
- `.codex-plugin/plugin.json`
- `skills/` directory
- `commands/` directory
- `agents/` directory
- `SKILL.md` file

### Plugin Inspection

For each discovered plugin directory, inspect and collect:

- `name` — from plugin manifest or directory name
- `version` — from plugin manifest
- `description` — from plugin manifest
- `skills[]` — discovered from `skills/` subdirectories via `SKILL.md`
- `commands[]` — discovered from `commands/` directory (`.md`, `.mdc` files)
- `agents[]` — discovered from `agents/` directory
- `rules[]` — discovered from `rules/` directory
- `hasHooks` — `hooks/hooks.json` exists
- `hasMcp` — `.mcp.json` exists
- `hasLsp` — `.lsp.json` exists

### Marketplace JSON Format

The `marketplace.json` file in plugin source repos follows this schema:

```json
{
  "name": "my-marketplace",
  "metadata": {
    "pluginRoot": "."
  },
  "plugins": [
    {
      "name": "my-plugin",
      "source": "./plugins/my-plugin",
      "description": "A plugin that does things",
      "version": "1.0.0",
      "skills": ["./skills/skill-a", "./skills/skill-b"]
    }
  ]
}
```

Remote-source plugins (where `source` is not a string path) are listed
separately and excluded from local installation.

## Installation Architecture

Plugin installation uses a new module (`src/plugins/installer/`) with
per-target strategies. It does NOT reuse the skill installer.

### Reused Layers

| Layer | Module | How |
|-------|--------|-----|
| Source resolution | `src/registries/` | Same `SourceRegistry.resolve` and `materialize` |
| Git cache | `src/git-cache.ts` | Same `materializeCachedGitSource` |
| Agent detection | `src/agents/` | Same `resolveAgentTargets` and target picker |
| Manifest store | `src/manifest/` | Extended with `plugins` key parsing and serialization |
| Command framework | `src/commands/` | Same `cac` registration pattern |

### New Modules

| Module | Purpose |
|--------|---------|
| `src/plugins/discover.ts` | Plugin discovery ported from `submodule/plugins/index.ts` |
| `src/plugins/installer/index.ts` | Dispatcher to per-target strategies |
| `src/plugins/installer/claude.ts` | Claude Code installation strategy |
| `src/plugins/installer/cursor.ts` | Cursor installation strategy |
| `src/plugins/installer/codex.ts` | Codex installation strategy |
| `src/plugins/init.ts` | Template scaffold generator |
| `src/plugins/types.ts` | Plugin-specific types |
| `src/commands/plugins/` | Command registrations |

### Per-Target Installation

#### Claude Code

1. Stage a working copy of the plugin via `stageInstallWorkspace`.
2. Prepare vendor directory: if `.plugin/` exists but `.claude-plugin/` does
   not, copy `.plugin/` to `.claude-plugin/`. If neither exists, generate a
   minimal `.claude-plugin/plugin.json`.
3. Translate env vars: rewrite `${PLUGIN_ROOT}`, `${CURSOR_PLUGIN_ROOT}`,
   `${CODEX_PLUGIN_ROOT}` to `${CLAUDE_PLUGIN_ROOT}` in `hooks/hooks.json`,
   `.mcp.json`, `.lsp.json`.
4. Generate `.claude-plugin/marketplace.json` for the staged repo.
5. Copy staged repo to `~/.claude/plugins/marketplaces/<marketplace-name>/`.
6. Copy each plugin to `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`.
7. Update `~/.claude/plugins/installed_plugins.json` with install entries.
8. Update `~/.claude/settings.json` `enabledPlugins`.
9. Register marketplace in `~/.claude/plugins/known_marketplaces.json`.

Official Anthropic plugins (e.g., `vercel/vercel-plugin`) attempt installation
via `claude plugin install` CLI first, falling back to direct file-based
install.

#### Cursor

- **Non-Windows**: reuses the Claude Code plugin cache path
  (`~/.claude/plugins/cache/`). Runs the same preparation and cache steps as
  Claude Code. Skips if Claude Code installation already populated the cache.
- **Windows**: installs to `~/.cursor/extensions/`. Updates
  `~/.cursor/extensions/extensions.json` with extension entries including
  identifier, version, location URI, and metadata.

#### Codex

1. Prepare vendor directory: copy `.plugin/` to `.codex-plugin/` if needed.
2. Enrich `.codex-plugin/plugin.json` with `interface` metadata (displayName,
   shortDescription, capabilities, logo) if not already present.
3. Translate env vars to `${CODEX_PLUGIN_ROOT}`.
4. Copy each plugin to `~/.codex/plugins/cache/<marketplace>/<plugin>/<version>/`.
5. Update `~/.agents/plugins/marketplace.json` with local source entries.
6. Update `~/.codex/config.toml` with `[plugins."<name>@<marketplace>"]`
   sections.

### Env Var Translation

Plugin config files (`hooks/hooks.json`, `.mcp.json`, `.lsp.json`) use env vars
to reference the plugin's install root. Each agent sets its own at runtime:

| Env Var | Set By |
|---------|--------|
| `${PLUGIN_ROOT}` | Vendor-neutral authoring convention (not set by any agent) |
| `${CLAUDE_PLUGIN_ROOT}` | Claude Code |
| `${CURSOR_PLUGIN_ROOT}` | Cursor |
| `${CODEX_PLUGIN_ROOT}` | Codex |

During installation, the installer rewrites all known plugin root vars to the
target agent's var. For example, installing to Claude Code rewrites
`${PLUGIN_ROOT}`, `${CURSOR_PLUGIN_ROOT}`, and `${CODEX_PLUGIN_ROOT}` to
`${CLAUDE_PLUGIN_ROOT}` in all config files.

## Plugin Types

```typescript
export interface DiscoveredPlugin {
  name: string;
  version?: string;
  description?: string;
  path: string;
  marketplace?: string;
  skills: PluginSkill[];
  commands: PluginCommand[];
  agents: PluginAgent[];
  rules: PluginRule[];
  hasHooks: boolean;
  hasMcp: boolean;
  hasLsp: boolean;
  manifest: Record<string, unknown> | null;
  explicitSkillPaths?: string[];
  marketplaceEntry?: Record<string, unknown>;
}

export interface PluginSkill {
  name: string;
  description: string;
}

export interface PluginCommand {
  name: string;
  description: string;
}

export interface PluginAgent {
  name: string;
  description: string;
}

export interface PluginRule {
  name: string;
  description: string;
}

export interface PluginManifestEntry {
  source: string;
  version?: string;
  path: string;
}

export interface PluginInstallPlan {
  plugins: SelectedPlugin[];
  targets: ResolvedAgentTarget[];
  scope: 'user' | 'project' | 'local';
  source: string;
  marketplace: string;
}

export interface SelectedPlugin {
  name: string;
  path: string;
  plugin: DiscoveredPlugin;
}
```

## CLI Architecture

The plugin command group mirrors the skills command group:

```text
src/
  commands/
    plugins/
      index.ts          # registerPluginsCommand, runPluginsCommand dispatcher
      init.ts           # plugins init
      add.ts            # plugins add
      list.ts           # plugins list
      outdated.ts       # plugins outdated
      update.ts         # plugins update
      remove.ts         # plugins remove
      types.ts          # command-specific option types
  plugins/
    discover.ts         # plugin discovery from materialized sources
    init.ts             # template scaffold generator
    types.ts            # DiscoveredPlugin, PluginManifestEntry, etc.
    installer/
      index.ts          # installPlugins dispatcher
      claude.ts         # installToClaudeCode
      cursor.ts         # installToCursor
      codex.ts          # installToCodex
      staging.ts        # stageInstallWorkspace
      vendor.ts         # preparePluginDirForVendor, translateEnvVars
```

`registerPluginsCommand` registers a single `plugins [...args]` command with
shared flags, dispatching subcommands (`init`, `add`, `list`, `outdated`,
`update`, `remove`) via `runPluginsCommand`, identical to how `skills` dispatch
works.

### Manifest Extension

`parseAiPackageManifest` is extended to accept an optional `plugins` key.
Missing `plugins` is valid (empty). Missing `skills` is also valid when
`plugins` exists. At least one of `skills` or `plugins` must be present.

`serializeManifest` writes both sections when present, preserving key order:
`skills` first, `plugins` second.

`ManifestStore.addPlugins` and `ManifestStore.removePlugins` mirror the
existing `addSkills` and `removeSkills` methods.

### Unified Install Extension

`runInstallCommand` reads the manifest and runs:

1. Skill installation (existing flow, unchanged).
2. Plugin installation (new flow, via `installPlugins`).

Both share agent target resolution. If neither `skills` nor `plugins` exist in
the manifest, the command reports an empty manifest and exits.

## Implementation Slices

1. **Plugin types and manifest extension**
   - Define `PluginManifestEntry`, `DiscoveredPlugin`, etc. in
     `src/plugins/types.ts`.
   - Extend `parseAiPackageManifest` to parse `plugins` section.
   - Extend `ManifestStore` with `addPlugins` / `removePlugins`.
   - Extend `serializeManifest` to round-trip plugins.

2. **Plugin discovery**
   - Port `discover`, `isPluginDir`, `inspectPlugin`, `discoverSkills`,
     `discoverCommands`, `discoverAgents`, `discoverRules`, and
     `discoverFromMarketplace` from `submodule/plugins/index.ts` into
     `src/plugins/discover.ts`.
   - Adapt to use existing `readFile` / `readdir` helpers.

3. **Plugin installer**
   - Port `installToClaudeCode`, `installToCursor`, `installToCodex` into
     per-target modules under `src/plugins/installer/`.
   - Port `stageInstallWorkspace`, `preparePluginDirForVendor`,
     `translateEnvVars`, `prepareForClaudeCode`, `enrichForCodex`.
   - Port `deriveMarketplaceName`, `extractGitHubRepo`, env-var translation.

4. **`plugins init` command**
   - Interactive prompts for name, directory, agents, components.
   - Template generation for vendor-specific plugin manifests and component
     stubs.

5. **`plugins add` command**
   - Source resolution via existing registries.
   - Plugin discovery and selection.
   - Agent target resolution.
   - Plugin installation.
   - Manifest write.

6. **`plugins list` command**
   - Read manifest, format plugin entries with component summary.
   - TTY, plain text, and JSON output modes.

7. **`plugins outdated` and `plugins update` commands**
   - Reuse Git-based version checking from skills.
   - Group by provider + packageId + ref.

8. **`plugins remove` command**
   - Manifest entry removal.
   - Optional `--uninstall` agent directory cleanup.

9. **Unified `install` extension**
   - Extend `runInstallCommand` to process `plugins` section.

## Validation Strategy

Unit tests:

- Manifest parse/write with `plugins` section, mixed skills + plugins,
  plugins-only, and empty-plugins edge cases.
- Plugin discovery: marketplace.json repos, single-plugin repos, multi-plugin
  repos, nested directories.
- Vendor directory preparation and env-var translation.
- Plugin manifest entry serialization.
- Init template generation for all agent combinations.

Integration tests:

- `ai-pkgs plugins add owner/repo --agent cursor --plugin foo --yes`.
- `ai-pkgs install` with both skills and plugins in manifest.
- `ai-pkgs plugins remove foo --uninstall --agent cursor`.

E2E tests:

- Add from a repo with multiple plugins and interactive selection.
- Init a plugin template and verify structure.
- Full add → list → outdated → update → remove lifecycle.

Verification commands:

```bash
bun run type-check:cli
bun run --cwd apps/cli test:unit
bun run --cwd apps/cli test:e2e
bun run lint
bun run build:cli
```

## Deferred Work

- Marketplace zip download and search backend integration.
- Plugin dependency resolution (plugin A depends on plugin B).
- Plugin versioning beyond Git SHA pinning.
- Auto-update scheduling (the `setAutoUpdate` mechanism from
  `submodule/plugins/index.ts` is acknowledged but deferred).
- Telemetry integration.
- `plugins search` command (requires backend).
