# ai-pkgs

Package manager for AI agent skills, plugins, and workspace iteration across
Cursor, Claude Code, Codex, and 47+ other agent runtimes.

## Quick start

```bash
npx ai-pkgs@latest --help
```

## Skills

Add skills from a GitHub repository:

```bash
ai-pkgs skills add vercel-labs/skills --skill tdd --agent cursor --project
```

Add from a local directory:

```bash
ai-pkgs skills add ./local-skills --registry file --skill to-prd --agent cursor --link
```

List, check, and update manifest skills:

```bash
ai-pkgs skills list
ai-pkgs skills outdated
ai-pkgs skills update --yes
```

## Plugins

Scaffold a new plugin:

```bash
ai-pkgs plugins init my-plugin
```

Add plugins from a source and select target agents:

```bash
ai-pkgs plugins add vercel/vercel-plugin --yes
```

Cursor plugin installs use Cursor's local plugin directory. Project installs
also enable the plugin in `.cursor/settings.json`; global installs only write
to `~/.cursor/plugins/local/<plugin>`.

Manage per-plugin targets:

```bash
ai-pkgs plugins targets add vercel-plugin cursor
ai-pkgs plugins targets list vercel-plugin
```

List, check, and update manifest plugins:

```bash
ai-pkgs plugins list
ai-pkgs plugins outdated
ai-pkgs plugins update --yes
```

## Workspace

Iterate on skills locally with Git push/pull. Move an installed skill into
workspace mode, edit it, then push your changes back to the remote:

```bash
ai-pkgs workspace link explain
# edit .cursor/skills/explain/SKILL.md
ai-pkgs workspace status
ai-pkgs workspace push explain -m "feat: improve examples"
ai-pkgs workspace pull explain
```

Remove a workspace skill (deletes local files):

```bash
ai-pkgs workspace remove explain --yes
```

Alias: `ws` (e.g. `ai-pkgs ws push explain`).

## Install / restore

Restore every skill and plugin from `ai-package.json`:

```bash
ai-pkgs install --agent cursor --force --yes
```

## Non-interactive mode

`--ai` disables prompts, spinners, and dynamic TUI. Anything that would prompt
fails with a clear next-step message. Pass explicit flags such as `--agent`,
`--skill`, `--force`, `--skip-existing`, or `--yes`:

```bash
ai-pkgs --ai skills add vercel-labs/skills --all --agent cursor --force --yes
```

## Manifest

`ai-package.json` is the declarative restore file:

```json
{
  "skills": {
    "tdd": {
      "source": "github:mattpocock/skills",
      "version": "main@b843cb5...",
      "path": "skills/engineering/tdd"
    }
  },
  "plugins": {
    "vercel-plugin": {
      "source": "github:vercel/vercel-plugin",
      "version": "main@abc1234...",
      "path": ".",
      "targets": ["claude-code", "cursor"]
    }
  },
  "workspace": {
    "skills": {
      "explain": {
        "local": ".cursor/skills/explain",
        "source": "github:entireio/skills",
        "path": "skills/explain",
        "version": "main@c376dc9..."
      }
    }
  }
}
```

A skill is in `skills` **or** `workspace.skills`, never both.

## Sources

GitHub is the default registry:

```bash
ai-pkgs skills add owner/repo
```

Explicit registries:

```bash
ai-pkgs skills add https://github.com/owner/repo --registry github
ai-pkgs skills add https://gitlab.example.com/group/repo.git --registry gitlab
ai-pkgs skills add ./local-skills --registry file
```

Git sources are pinned as `<ref>@<sha>` for reproducible installs.

## Agent targets

Common targets:

- `cursor` -> `.cursor/skills`
- `claude-code` -> `.claude/skills`
- `codex` -> `.codex/skills`
- `universal` -> `.agents/skills`

47+ agents are supported. Run `ai-pkgs skills add <source>` and pick from the
interactive selector, or pass `--agent <id>`.

## Plugin-capable agents

| Target | Cache | Settings |
|--------|-------|----------|
| `claude-code` | `~/.claude/plugins/cache/` | `~/.claude/settings.json` or `.claude/settings.json` |
| `cursor` | `~/.cursor/plugins/local/<plugin>` | project `.cursor/settings.json`; global installs do not write a Cursor settings file |
| `codex` | `~/.codex/plugins/cache/` | `~/.codex/config.toml` |

## Commands

```text
ai-pkgs
  install                  Restore from ai-package.json
  cache clear              Clear Git cache

  skills add               Add skills from a source
  skills list              List manifest skills
  skills remove            Remove skill entries
  skills outdated          Check for newer Git commits
  skills update            Refresh pinned Git SHAs
  skills vercel-migrate    Migrate legacy skills-lock.json

  plugins init             Scaffold a plugin template
  plugins add              Add plugins from a source
  plugins list             List manifest plugins
  plugins remove           Remove plugin entries
  plugins targets          Manage per-plugin agent targets
  plugins outdated         Check for newer Git commits
  plugins update           Refresh pinned Git SHAs

  workspace link           Move an installed skill to workspace
  workspace remove         Remove workspace entry and delete local files
  workspace push           Push local changes to remote
  workspace pull           Pull latest from remote into local
  workspace status         Show clean / modified / untracked state
  workspace list           List workspace skills
```

Run `ai-pkgs <command> -h` for detailed usage. `workspace` is aliased to `ws`.

## Architecture

```text
src/
  cli.ts                Bootstrap, Node.js version guard
  cli/
    app.ts              buildCli / runCli entrypoint
    help.ts             Custom help renderer
    help-data/          Static help content (skills, plugins, workspace, cache)
    ai-mode.ts          --ai / non-interactive helpers
    ai-output.ts        Deterministic text output
    clone-progress.ts   Shared clone progress renderer
  commands/
    skills/             skills add, list, remove, outdated, update, vercel-migrate
    plugins/            plugins init, add, list, remove, outdated, update, targets
    workspace/          workspace link, remove, push, pull, status, list
    cache.ts            cache clear
    install.ts          install (restore from manifest)
    help.ts             help <command>
  manifest/
    parse.ts            Validate and parse ai-package.json (skills, plugins, workspace)
    store.ts            CRUD API (add/remove skills/plugins/workspace + moveSkillToWorkspace)
  registries/           GitHub, GitLab, file, marketplace boundaries
  discovery/            SKILL.md discovery and selection
  plugins/
    discover.ts         Plugin discovery from source trees
    init.ts             Plugin template scaffolding
    targets.ts          Target detection, vendor dir detection, selector
    installer/          Per-target install/uninstall (Claude, Cursor, Codex)
  agents/               Agent registry (47+ agents) and target resolution
  git.ts                Git subprocess facade
  git-cache.ts          Global Git cache (provider + source + SHA)
  types.ts              SkillEntry, PluginEntry, WorkspaceSkillEntry, AiPackageManifest
```

## Development

```bash
bun install
bun run start           # run from source
bun run dev             # watch mode
bun run type-check      # tsc --noEmit
bun run test:unit       # vitest unit tests
bun run test:e2e        # vitest e2e tests
bun run lint            # biome check
bun run build           # tsup production build
bun run check           # type-check + unit + e2e + lint
```

## Release

```bash
bun run bump            # bump version, commit, tag
bun run pub             # build + bump + npm publish
```

The package `files` field publishes only `dist` and `README.md`.
