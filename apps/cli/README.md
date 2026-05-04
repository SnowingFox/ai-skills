# ai-pkgs

Package manager for installing and managing AI agent skills across Cursor,
Claude Code, Codex, and other agent runtimes.

## Usage

Show help:

```bash
ai-pkgs --help
ai-pkgs skills -h
```

Restore skills from `ai-package.json`:

```bash
ai-pkgs install --agent cursor --force --yes
```

Add skills from a GitHub repository, save them to `ai-package.json`, and
install them:

```bash
ai-pkgs skills add mattpocock/skills \
  --skill tdd \
  --agent cursor \
  --force \
  --yes
```

Add skills from a local directory:

```bash
ai-pkgs skills add ./local-skills \
  --registry file \
  --skill to-prd \
  --agent universal \
  --link \
  --yes
```

Add skills to the global ai-pkgs manifest and install them globally:

```bash
ai-pkgs skills add mattpocock/skills \
  --global \
  --skill tdd \
  --agent cursor \
  --force \
  --yes
```

Install directly without writing `ai-package.json`:

```bash
ai-pkgs skills add ./local-skills \
  --registry file \
  --install-only \
  --skill to-prd \
  --agent cursor \
  --force \
  --yes
```

Global one-off installs can also skip the global manifest:

```bash
ai-pkgs skills add mattpocock/skills \
  --global \
  --install-only \
  --skill tdd \
  --agent cursor \
  --force \
  --yes
```

Migrate a legacy Vercel `skills-lock.json` into `ai-package.json`:

```bash
ai-pkgs skills vercel-migrate --skip-existing
```

To migrate and then install the full manifest:

```bash
ai-pkgs skills vercel-migrate \
  --install \
  --agent cursor \
  --force \
  --yes
```

List declared skills as grouped text or JSON:

```bash
ai-pkgs skills list
ai-pkgs skills list --json
ai-pkgs skills list --global
```

Check and update Git-backed skill pins:

```bash
ai-pkgs skills outdated
ai-pkgs skills outdated tdd to-prd
ai-pkgs skills update --yes
ai-pkgs skills update tdd --yes
ai-pkgs skills update --global --yes
```

Run in strict AI/automation mode:

```bash
ai-pkgs --ai skills add mattpocock/skills \
  --install-only \
  --skill tdd \
  --agent cursor \
  --force \
  --yes
```

`--ai` disables prompts, spinners, and dynamic TUI behavior. Anything that would
prompt fails with a clear next-step message, so automation callers must pass
explicit flags such as `--agent`, `--skill`, `--force`, `--skip-existing`, or
`--yes`.

## Commands

`install` reads `ai-package.json` and installs every declared skill into the
selected agent targets. It does not mutate the manifest.

`skills add <source>` resolves a source, discovers skill folders, writes selected
entries to `ai-package.json`, then installs them. Add `--install-only` for
one-off installs that skip all manifest reads and writes.

`skills add -g, --global` writes selected entries to
`~/.ai-pkgs/ai-package.json` and installs them into global agent directories.
`--global --install-only` performs a one-off global install without writing the
global manifest. `--global` cannot be combined with `--manifest`.

`skills vercel-migrate` reads legacy Vercel `skills-lock.json` files and writes
their GitHub skills into `ai-package.json`. It keeps the lock file by default;
pass `--remove-lock` to delete it after a successful manifest write. Conflicts
prompt in TTY mode, or require `--force` / `--skip-existing` in non-interactive
mode.

`skills list` prints manifest skills grouped by source; pass `--json` for
machine-readable output. Add `--global` to read `~/.ai-pkgs/ai-package.json`.

`skills outdated [skill...]` checks every manifest skill, or only named skills,
by resolving each Git-backed entry's stored ref and comparing the latest SHA to
the manifest `commitSha`. It reports file and Marketplace sources as skipped,
exits 0 when skills are merely outdated, and exits 1 only when checks fail.

`skills update [skill...]` reuses the same outdated check and writes only entries
whose Git pin moved. TTY mode asks before writing with default Yes; non-TTY and
`--ai` require `--yes`. If any requested check fails, no partial manifest write
is performed. Add `--global` to update `~/.ai-pkgs/ai-package.json`.

`install -g, --global` restores `~/.ai-pkgs/ai-package.json` into global agent
skill directories. Without `--global`, `install` remains project-scoped.

`skills remove` edits manifest entries by name. Marketplace `skills search` is
reserved for the backend marketplace API.

## Sources

GitHub is the default registry for shorthand sources:

```bash
ai-pkgs skills add owner/repo
```

Explicit registries are supported:

```bash
ai-pkgs skills add https://github.com/owner/repo --registry github
ai-pkgs skills add https://gitlab.example.com/group/repo.git --registry gitlab
ai-pkgs skills add ./local-skills --registry file
```

Git sources are cloned and pinned as `<ref>@<sha>` in `ai-package.json`. Local
file sources preserve their local source root.

Legacy Vercel migrations support `sourceType: "github"` entries. The old
`computedHash` field is validated as legacy lock metadata, but the manifest uses
Git pins instead, so it is not written to `ai-package.json`.

## Agent Targets

Target agents must be selected explicitly with `--agent`, or through the TTY
picker when prompts are allowed.

Common targets:

- `cursor` -> `.cursor/skills`
- `claude-code` -> `.claude/skills`
- `codex` -> `.codex/skills`
- `universal` -> `.agents/skills`

Install mode defaults to `--copy`. Use `--link` for symlinks. Existing target
folders prompt in TTY mode, or require `--force` / `--skip-existing` in
non-interactive mode.

## Manifest

`ai-package.json` is the declarative restore file. A minimal file looks like:

```json
{
  "skills": {
    "tdd": {
      "source": "github:mattpocock/skills",
      "version": "main@<resolved-sha>",
      "path": "skills/engineering/tdd"
    }
  }
}
```

Use `ai-pkgs install` to restore from this file on another machine or project.

## Architecture

The CLI follows a small boundary-oriented architecture:

- `src/cli.ts` builds the `cac` parser, installs custom help, and delegates
execution to `src/cli/runtime.ts`.
- `src/commands/*` registers command surfaces. `skills [...args]` is a dispatcher
  for `add`, `list`, `remove`, `outdated`, `update`, `vercel-migrate`, and
  `search`; implementation files live under `src/commands/skills/`.
- `src/cli/help.ts` renders help only. Help content lives in
`src/cli/help-data/*`.
- `src/cli/ai-mode.ts` owns strict AI/non-interactive mode helpers.
- `src/registries/*` implements source providers for GitHub, GitLab, file, and
the deferred marketplace boundary.
- `src/git.ts` is the thin Git facade used by Git registries.
- `src/discovery/*` finds `SKILL.md` directories and handles skill selection.
- `src/agents/*` maps logical agent IDs to install directories.
- `src/manifest/*` parses, validates, and writes `ai-package.json`.
- `src/installer/*` materializes selected skills into target agent directories
with copy/link and conflict policies.

High-level data flow for `skills add`:

```text
source string
  -> registry.resolve()
  -> discoverSkills()
  -> selectDiscoveredSkills()
  -> ManifestStore.addSkills() unless --install-only
  -> resolveAgentTargets()
  -> installPlan()
```

High-level data flow for `install`:

```text
ai-package.json
  -> parseAiPackageManifest()
  -> resolveAgentTargets()
  -> installSkills()
  -> registry.materialize()
  -> installPlan()
```

High-level data flow for global manifest commands:

```text
-g / --global
  -> ~/.ai-pkgs/ai-package.json
  -> existing Git cache/ref resolution
  -> global agent skill directories
```

High-level data flow for `skills vercel-migrate`:

```text
skills-lock.json
  -> parse legacy GitHub entries
  -> resolve GitHub default-branch pins
  -> merge with ai-package.json
  -> optionally run install
```

High-level data flow for `skills outdated` and `skills update`:

```text
ai-package.json
  -> select all skills or requested names
  -> group Git checks by provider + packageId + ref
  -> resolve each remote ref once
  -> report outdated/up-to-date/skipped/failed
  -> update writes only if no checks failed and confirmation is explicit
```

## Development

Install dependencies:

```bash
bun install
```

Run from source:

```bash
bun run src/cli.ts --help
```

Useful scripts:

```bash
bun run start
bun run check
bun run build
bun run test:unit
bun run test:e2e
bun run type-check
```

## Release

Release scripts:

```bash
bun run bump
bun run release
bun run publish:dry
bun run release:publish
```

Do not add a script named `publish` that wraps `npm publish`. `npm publish`
executes the `publish` lifecycle script during publishing, which can trigger a
second publish attempt for the same version. Use `release:publish` instead.

The package `files` field intentionally publishes only:

- `dist`
- `README.md`