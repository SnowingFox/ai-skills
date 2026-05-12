# Plugin Package Management Technical Plan (v2)

This document defines the updated design for `ai-pkgs` plugin package
management. It supersedes the v1 design with target persistence, project-scope
enablement, `.agents/plugins/` as the universal format, and the `plugins
targets` subcommand.

## Issues Resolved

1. `plugins add` wrote to `ai-package.json` then exited without selecting
   agents or calling `installPlugins`.
2. No target agent selector — never prompted for Claude Code / Cursor / Codex.
3. No target persistence — manifest entries lacked a `targets` field, so
   `ai-pkgs install` could not know which agents to install each plugin to.
4. No target management — no way to add/remove targets for an already-added
   plugin.
5. `.plugin/` is not a real standard — replaced with
   `.agents/plugins/marketplace.json` (Codex/AWS format used by
   `awslabs/agent-plugins`).
6. Wrong scope for Claude Code enablement — project-scope installs must write
   `enabledPlugins` to `.claude/settings.json` in the project root, not the
   global `~/.claude/settings.json`.
7. `ai-pkgs install` did not install plugins — just printed a message.

## Manifest Shape

Plugins live in the same `ai-package.json` alongside skills under a `plugins`
key. Each entry includes a `targets` array recording which agents to install to.

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
      "path": ".",
      "targets": ["claude-code", "cursor"]
    },
    "entire": {
      "source": "github:entireio/skills",
      "version": "main@def456abc789012345678901234567890abcdef12",
      "path": ".",
      "targets": ["claude-code", "codex"]
    },
    "my-local-plugin": {
      "source": "file:./plugins/my-plugin",
      "path": ".",
      "targets": ["claude-code"]
    }
  }
}
```

### Field Rules

`plugins` is a top-level object keyed by installed plugin name.

`source` uses `<provider>:<package-id>`, identical to skills:

- `github:owner/repo`
- `gitlab:https://host/group/repo.git`
- `marketplace:owner/package`
- `file:relative-or-absolute-path`

`version` is required for remote sources. Git-backed sources use
`<ref>@<commitSha>`, identical to skills.

`path` is required. Points to the plugin directory inside the resolved source.
Defaults to `.` when the entire repo is the plugin.

`targets` is required. An array of agent IDs that this plugin should be
installed to. Allowed values: `claude-code`, `cursor`, `codex`.

### Scope

Project-local `ai-package.json` by default. `--global` writes to
`~/.ai-pkgs/ai-package.json`.

Scope determines enablement:

- **Project scope** (default): installs to global agent caches, enables in
  project-level settings. For Claude Code, writes `enabledPlugins` to
  `.claude/settings.json` in the project root.
- **Global scope** (`--global`): installs to global agent caches, enables in
  global settings. For Claude Code, writes to `~/.claude/settings.json`.

Codex and Cursor do not yet support project-scoped plugin enablement natively.
The manifest still records them in project-scope `ai-package.json`, and
installation targets their global caches.

## Commands

### `ai-pkgs plugins init [name]`

Scaffold a new plugin template with interactive prompts.

```
$ ai-pkgs plugins init

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

◆  Plugin scaffolded at ./my-plugin
```

Generated structure (all agents, all components):

```
my-plugin/
  .agents/
    plugins/
      marketplace.json         # universal marketplace manifest
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

The `.agents/plugins/marketplace.json` follows the Codex/AWS schema:

```json
{
  "name": "my-plugin",
  "interface": { "displayName": "My Plugin" },
  "plugins": [
    {
      "name": "my-plugin",
      "source": { "source": "local", "path": "./" },
      "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" },
      "category": "Coding"
    }
  ]
}
```

Flags:

- `-a, --agent <agent>` — pre-select target agents, skip prompt.
- `-y, --yes` — use all defaults (all agents, all components).

### `ai-pkgs plugins add <source>`

Resolve a source, discover plugins, select targets, install, and write manifest.

```
$ ai-pkgs plugins add vercel/vercel-plugin

◇  Repository cloned (main@abc1234)

◇  Found 1 plugin(s)
│
│  vercel-plugin  3 skills, hooks, mcp

◇  Target agents?
│  ● Claude Code       (.claude-plugin/ found)
│  ● Cursor            (will translate from .claude-plugin/)
│  ○ Codex (disabled)  (no .codex-plugin/ or .agents/plugins/)

◇  Installing vercel-plugin...
│  ◇  Staged workspace for claude-code
│  ◆  Installed vercel-plugin to Claude Code cache
│  ◇  Staged workspace for cursor
│  ◆  Installed vercel-plugin to Cursor cache
│
◆  Wrote 1 plugin(s) to ai-package.json
◆  Enabled vercel-plugin in .claude/settings.json
```

Target selector behavior:

- Shows 3 options: Claude Code, Cursor, Codex.
- Detects which vendor dirs exist in the plugin source:
  - `.claude-plugin/` found → Claude Code enabled.
  - `.cursor-plugin/` found → Cursor enabled.
  - `.codex-plugin/` found → Codex enabled.
  - `.agents/plugins/marketplace.json` found → all targets enabled.
  - No vendor dir but has `skills/`, `commands/`, etc. → all enabled (installer
    generates vendor dirs on the fly).
- Targets without a matching vendor dir and without `.agents/plugins/` are
  disabled with a reason hint.
- `--agent <id>` skips the selector.

Flags:

- `--registry github|gitlab|marketplace` — source interpretation.
- `--plugin <name>` — filter by plugin name. Repeatable.
- `-a, --agent <id>` — target agent(s). Skips selector.
- `--ref <branch|tag>` — Git ref to pin.
- `-g, --global` — write to `~/.ai-pkgs/ai-package.json` and enable globally.
- `--install-only` — install without writing manifest.
- `--refresh` — re-clone ignoring Git cache.
- `-y, --yes` — skip confirmation prompts.

### `ai-pkgs plugins list`

List plugins declared in `ai-package.json`.

```
$ ai-pkgs plugins list

◇  AI package plugins

◇  Manifest plugins (2) ──────────────────────────╮
│                                                  │
│    vercel-plugin                                 │
│      source: github:vercel/vercel-plugin         │
│      path: .                                     │
│      version: main@abc1234                       │
│      targets: claude-code, cursor                │
│                                                  │
│    entire                                        │
│      source: github:entireio/skills              │
│      path: .                                     │
│      version: main@def4567                       │
│      targets: claude-code, codex                 │
│                                                  │
├──────────────────────────────────────────────────╯
◆  Done.
```

Flags: `--json`, `--global`, `-C, --dir`, `-m, --manifest`.

### `ai-pkgs plugins targets <add|remove|list> <plugin> [agent...]`

Manage per-plugin target agents in the manifest.

```
$ ai-pkgs plugins targets add vercel-plugin cursor

◇  Updated targets for vercel-plugin: [claude-code, cursor]

◆  Install cursor now?
│  ● Yes
│  ○ No (run ai-pkgs install later)

◇  Staged workspace for cursor
◆  Installed vercel-plugin to Cursor cache
```

```
$ ai-pkgs plugins targets remove vercel-plugin codex

◇  Updated targets for vercel-plugin: [claude-code]

◆  Uninstall from codex now?
│  ● Yes
│  ○ No

◇  Cleaned vercel-plugin from Codex cache
◆  Removed from config.toml
```

```
$ ai-pkgs plugins targets list vercel-plugin

  vercel-plugin: claude-code, cursor
```

Flags:

- `-y, --yes` — auto-confirm install/uninstall.
- `--no-install` — skip the install/uninstall prompt entirely.

### `ai-pkgs plugins outdated [plugin...]`

Check for available updates. Report-only.

```
$ ai-pkgs plugins outdated

◇  Plugin updates ─────────────────────────────────╮
│                                                   │
│  outdated: 1                                      │
│  - vercel-plugin main@abc1234 -> main@def5678     │
│  up-to-date: 1                                    │
│  - entire main@def4567                            │
│  skipped: 0                                       │
│  failed: 0                                        │
│                                                   │
├───────────────────────────────────────────────────╯
```

### `ai-pkgs plugins update [plugin...]`

Update plugins to latest versions.

```
$ ai-pkgs plugins update --yes

  updated: 1
  - vercel-plugin main@abc1234 -> main@def5678
  skipped: 0
```

Requires `--yes` in non-TTY/`--ai`.

### `ai-pkgs plugins remove <plugin...>`

Remove plugins from the manifest.

```
$ ai-pkgs plugins remove vercel-plugin

◆  Removed vercel-plugin from ai-package.json
```

```
$ ai-pkgs plugins remove vercel-plugin --uninstall

◆  Removed vercel-plugin from ai-package.json
◇  Cleaning agent caches...
│  ◆  Removed from Claude Code cache
│  ◆  Removed from installed_plugins.json
│  ◆  Removed from .claude/settings.json enabledPlugins
│  ◆  Removed from Cursor cache
◆  Uninstalled vercel-plugin from 2 agent(s)
```

Flags: `--uninstall`, `--agent <id>`.

### `ai-pkgs install` (Unified Restore)

Restores both skills and plugins from `ai-package.json`.

```
$ ai-pkgs install --yes

┌  AI package installer
│
◇  Install plan ──────────────────────────────────────╮
│                                                      │
│  find-skills                                         │
│    github:vercel-labs/skills@main                    │
│    skills/find-skills                                │
│                                                      │
│  [plugin] vercel-plugin                              │
│    github:vercel/vercel-plugin@main                  │
│    .                                                 │
│    targets: claude-code, cursor                      │
│                                                      │
├──────────────────────────────────────────────────────╯
│
◇  Materializing sources
│  ◆  Installed 1 skill(s) to Cursor
│
◇  Installing plugins
│  ◆  Installed vercel-plugin to Claude Code
│  ◆  Installed vercel-plugin to Cursor
│  ◆  Enabled vercel-plugin in .claude/settings.json
│
└  Install complete
```

Plugins are installed to the targets listed in each entry's `targets` array.
No agent picker is shown — targets are already persisted.

## Plugin Discovery

### Discovery Priority

1. **Marketplace manifest**: look for `marketplace.json` in:
   - `.agents/plugins/marketplace.json` (universal, preferred)
   - `.claude-plugin/marketplace.json`
   - `.cursor-plugin/marketplace.json`
   - `.codex-plugin/marketplace.json`
   - `marketplace.json` (repo root)

2. **Root-is-plugin**: check if the repo root is a plugin directory.

3. **Recursive scan**: scan subdirectories up to depth 2.

### Plugin Directory Detection

A directory is considered a plugin if it contains any of:

- `.agents/plugins/marketplace.json`
- `.claude-plugin/plugin.json`
- `.cursor-plugin/plugin.json`
- `.codex-plugin/plugin.json`
- `skills/` directory
- `commands/` directory
- `agents/` directory
- `SKILL.md` file

### Vendor Dir Detection (for target selector)

During `plugins add`, the installer inspects each selected plugin for vendor
directories to determine which targets are compatible:

| Found in plugin | Targets enabled |
|-----------------|-----------------|
| `.agents/plugins/marketplace.json` | All (claude-code, cursor, codex) |
| `.claude-plugin/` only | claude-code, cursor (cursor translates) |
| `.cursor-plugin/` only | cursor |
| `.codex-plugin/` only | codex |
| `.claude-plugin/` + `.codex-plugin/` | claude-code, cursor, codex |
| No vendor dir, but has `skills/` etc. | All (installer generates vendor dirs) |

Targets without vendor support are shown as disabled in the selector with a
reason hint.

## Installation Architecture

### Plugin Targets

Only 3 agents support plugins:

| Target | Binary | Cache Directory |
|--------|--------|-----------------|
| `claude-code` | `claude` | `~/.claude/plugins/cache/` |
| `cursor` | `cursor` | Shares Claude cache (non-Windows) or `~/.cursor/extensions/` (Windows) |
| `codex` | `codex` | `~/.codex/plugins/cache/` |

Target detection uses `which <binary>` to check installed agents.

### Per-Target Installation

#### Claude Code

1. Stage a working copy via `stageInstallWorkspace`.
2. Prepare `.claude-plugin/` vendor directory (generate if missing).
3. Translate env vars to `${CLAUDE_PLUGIN_ROOT}`.
4. Generate `.claude-plugin/marketplace.json` for the staged repo.
5. Copy to `~/.claude/plugins/marketplaces/<marketplace>/`.
6. Copy to `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`.
7. Update `~/.claude/plugins/installed_plugins.json`.
8. Enable in settings:
   - Project scope: write to `.claude/settings.json` (project root).
   - Global scope: write to `~/.claude/settings.json`.
9. Register marketplace in `~/.claude/plugins/known_marketplaces.json`.

#### Cursor

- **Non-Windows**: reuses Claude Code plugin cache. Skips if Claude Code
  already populated the cache.
- **Windows**: installs to `~/.cursor/extensions/`, updates `extensions.json`.

#### Codex

1. Prepare `.codex-plugin/` vendor directory.
2. Enrich with `interface` metadata if missing.
3. Translate env vars to `${CODEX_PLUGIN_ROOT}`.
4. Copy to `~/.codex/plugins/cache/<marketplace>/<plugin>/<version>/`.
5. Update `~/.agents/plugins/marketplace.json`.
6. Update `~/.codex/config.toml`.

### Env Var Translation

| Env Var | Set By |
|---------|--------|
| `${CLAUDE_PLUGIN_ROOT}` | Claude Code |
| `${CURSOR_PLUGIN_ROOT}` | Cursor |
| `${CODEX_PLUGIN_ROOT}` | Codex |

During installation, the installer rewrites all known plugin root vars to the
target agent's var in `hooks/hooks.json`, `.mcp.json`, and `.lsp.json`.

## CLI Architecture

```text
src/
  commands/
    plugins/
      index.ts          # registerPluginsCommand, dispatch
      init.ts           # plugins init
      add.ts            # plugins add (discover + select targets + install + manifest)
      list.ts           # plugins list
      outdated.ts       # plugins outdated
      update.ts         # plugins update
      remove.ts         # plugins remove
      targets.ts        # plugins targets add/remove/list
      types.ts          # command option types
  plugins/
    discover.ts         # plugin discovery from materialized sources
    init.ts             # template scaffold generator
    targets.ts          # target detection, vendor dir detection, selector
    types.ts            # DiscoveredPlugin, PluginEntry, etc.
    installer/
      index.ts          # installPlugins dispatcher
      claude.ts         # installToClaudeCode
      cursor.ts         # installToCursor
      codex.ts          # installToCodex
      staging.ts        # stageInstallWorkspace
      vendor.ts         # preparePluginDirForVendor, translateEnvVars
```

### Manifest Extension

`PluginEntry` includes `targets?: string[]`. The parser validates target values
against `claude-code`, `cursor`, `codex`. Serialization includes `targets` when
present.

### Unified Install

`ai-pkgs install` reads `plugins` from the manifest, resolves each entry via
registries, and calls `installPlugins` per target listed in `targets`. No agent
picker is shown — targets are already persisted.

## Implementation Slices

1. **`targets` field** — add to `PluginEntry`, manifest parse, serialize.
2. **Target detection** — `detectPluginTargets()`, `detectPluginVendorDirs()`.
3. **Target selector** — multi-select with vendor-dir-aware enable/disable.
4. **Wire `plugins add`** — discovery → target selector → install → manifest.
5. **Project-scope enablement** — Claude Code `.claude/settings.json`.
6. **Replace `.plugin/`** — use `.agents/plugins/` in discovery, init, vendor
   prep.
7. **`plugins targets` subcommand** — add/remove/list with install/uninstall
   prompt.
8. **Wire `ai-pkgs install`** — iterate plugin entries, install per persisted
   target.
9. **Update docs/help/llms.txt** — terminal UI mockups, updated design.

## Deferred Work

- Marketplace zip download and search backend integration.
- Plugin dependency resolution.
- Auto-update scheduling.
- Telemetry integration.
- `plugins search` command (requires backend).
- Project-scoped plugin enablement for Codex and Cursor (blocked on upstream).
