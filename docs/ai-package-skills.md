# Skills Package Management Technical Plan

This document defines the v1 design for `ai-pkgs` skills package management.
The manifest remains small and reproducible, while CLI commands own source
resolution, skill discovery, agent target selection, and installation UX.

Plugins are intentionally out of scope for this round. Marketplace zip
distribution is designed at the interface boundary only and is tracked as a
follow-up in `TODO.md`.

## Current Implementation Gaps

The current uncommitted CLI slice proves a few useful pieces, but it should not
be treated as the target architecture:

- `marketplace:` sources are listed in this document but currently fail during
manifest parsing in `apps/cli/src/manifest.ts`.
- GitHub and GitLab are parsed inline in the manifest parser. There is no
`SourceRegistry` or provider interface that can isolate GitHub, GitLab,
Marketplace, and local file behavior.
- GitHub and GitLab share one temporary clone helper. It can checkout a pinned
SHA, but it does not resolve default branches, write pinned versions for
`skills add`, preserve self-hosted GitLab source URLs, or model update
behavior.
- Installation always targets `.agents/skills`. There is no agent selection,
agent path registry, copy/link mode, or conflict handling.
- The CLI only supports `install`. It does not support `skills add`, `skills search`, `skills list`, `skills remove`, or `skills update`.
- The installer discovers nothing when adding from a repo. The desired `add`
flow should inspect common skill directories and let the user choose skills.

## Product Semantics

### Commands

`ai-pkgs install` restores skills declared in `ai-package.json`. It reads the
manifest, asks for agent targets when needed, and installs the declared skills.
It must not mutate `ai-package.json`.

`ai-pkgs skills add <source>` resolves a source, discovers available skills,
lets the user choose one or more skills, writes the selected entries to
`ai-package.json`, and installs them for the selected agents.

`ai-pkgs skills search [query]` searches available skills. The first
implementation can search Marketplace once the backend endpoint exists. Before
that, it can be a documented command shell with a clear "not implemented"
message.

`ai-pkgs skills list` lists skills declared in `ai-package.json` and can later
include installed state per agent.

`ai-pkgs skills remove <skill...>` removes entries from `ai-package.json` and
optionally removes installed directories from selected agents.

`ai-pkgs skills update [skill...]` resolves latest versions for manifest
entries. Git providers update by ref and rewrite `<ref>@<sha>`. Marketplace
updates through the Marketplace API.

### Source Input

`--registry github|gitlab|marketplace` controls how bare source strings are
interpreted. The default registry is `github`.

Examples:

```bash
ai-pkgs skills add vercel-labs/skills
ai-pkgs skills add owner/repo --registry github
ai-pkgs skills add https://gitlab.example.com/group/repo.git --registry gitlab
ai-pkgs skills add owner/package --registry marketplace
ai-pkgs skills add owner/repo --path plugins/skills --skill my-skill
ai-pkgs skills add https://github.com/vercel-labs/skills/tree/main/skills/find-skills
ai-pkgs skills add ./local-skills --skill my-skill
```

URL and local path inputs can be auto-detected and should override the default
registry. Explicit provider locators like `github:owner/repo` can be accepted
internally and in the manifest, but user-facing `skills add` should optimize
for bare `owner/repo` plus `--registry`.

GitLab differs from GitHub because GitLab may be self-hosted. `skills add` may
accept `group/repo --registry gitlab` as shorthand for `gitlab.com`, but the
manifest must record the resolved clone URL so the original host is preserved.

### Agent Selection

Agent targets are runtime choices, not manifest state. `ai-package.json`
records what to install, not where it was installed.

`install` and `skills add` support repeated `--agent` flags:

```bash
ai-pkgs install --agent cursor --agent codex
ai-pkgs skills add owner/repo --agent cursor
```

When `--agent` is omitted in a TTY, the CLI prompts with `@clack/prompts`.
When `--agent` is omitted outside a TTY, the command fails and asks the user to
pass `--agent`. It must not silently install to `.agents/skills`.

### Install Mode and Conflicts

The default mode is copy:

```bash
ai-pkgs install --copy
ai-pkgs install --link
```

If a target skill directory already exists:

- TTY mode prompts whether to overwrite or skip.
- `--force` overwrites without prompting.
- `--skip-existing` skips without prompting.
- Non-TTY mode without `--force` or `--skip-existing` fails.

`--force` and `--skip-existing` are mutually exclusive.

## Manifest Shape

`ai-package.json` is the user-editable source of truth. It intentionally does
not store selected agents or install mode.

```json
{
  "skills": {
    "find-skills": {
      "source": "github:vercel-labs/skills",
      "version": "main@df0579f85cb8a360473c921e1343359006100d3c",
      "path": "skills/find-skills"
    },
    "reviewer": {
      "source": "gitlab:https://gitlab.example.com/platform/ai/agent-skills.git",
      "version": "release@abcdef1234567890abcdef1234567890abcdef12",
      "path": "packages/reviewer"
    },
    "local-grill-me": {
      "source": "file:.",
      "path": ".agents/skills/grille-me"
    },
    "marketplace-skill": {
      "source": "marketplace:owner/package",
      "version": "2026-05-04T09:00:00Z@sha256:abc123",
      "path": "skills/marketplace-skill"
    }
  }
}
```

### Field Rules

`skills` is a top-level object keyed by installed skill name. The key can
differ from the source directory name. The singular `skill` key is invalid.

`source` uses `<provider>:<package-id>`.

Supported providers:

- `github:owner/repo`
- `gitlab:https://host/group/repo.git`
- `marketplace:owner/package`
- `file:relative-or-absolute-path`

`version` is required for remote sources.

Git-backed sources use `<ref>@<commitSha>`. Installation uses the commit SHA as
the source of truth. The ref exists for readable updates. GitHub sources can be
stored as `github:owner/repo`; GitLab sources must be stored as a full clone URL
inside the provider locator, for example
`gitlab:https://gitlab.example.com/group/repo.git`.

Marketplace sources use the opaque version returned by the backend. The exact
format can be `channel@sha256:<digest>` or another backend-owned stable value,
but the CLI treats it as an opaque string.

`file:` sources may omit `version`.

`path` is required. It points to the selected skill directory inside the
resolved source. The target directory must contain `SKILL.md`. `path` must stay
inside the source root.

## Source and Package Interfaces

The manifest parser should not construct clone URLs or make network decisions.
Those concerns belong to source registries.

```typescript
export type RegistryKind = 'github' | 'gitlab' | 'marketplace' | 'file';

export interface SourceRegistry {
  kind: RegistryKind;
  resolve(input: AddSourceInput): Promise<ResolvedPackage>;
  update?(entry: ManifestSkillEntry): Promise<ResolvedPackage>;
}

export interface AddSourceInput {
  rawSource: string;
  registry: RegistryKind;
  ref?: string;
  path?: string;
  requestedSkills: string[];
}

export interface ResolvedPackage {
  source: string;
  version?: string;
  root: MaterializedPackage;
  defaultPath?: string;
  metadata?: Record<string, unknown>;
}

export type MaterializedPackage =
  | { kind: 'directory'; rootDir: string; cleanup?: () => Promise<void> }
  | { kind: 'zip'; files: PackageFile[] };

export interface PackageFile {
  path: string;
  contents: Uint8Array;
}
```

GitHub and GitLab can share a `GitSourceRegistry` implementation with provider
configuration, but their manifest locators differ: GitHub stores `owner/repo`,
while GitLab stores the canonical clone URL.

```typescript
export interface GitProviderConfig {
  kind: 'github' | 'gitlab';
  defaultHost: string;
  buildCloneUrl(packageId: string): string;
  parseUrl(input: string): ParsedGitSource | null;
  toManifestSource(source: ParsedGitSource): string;
}
```

The Git registry resolves default branch and HEAD SHA during `skills add`.
When no `--ref` is passed, it writes `<defaultBranch>@<sha>`. When `--ref` is
passed, it writes `<ref>@<sha>`. For GitLab, `toManifestSource` must preserve
the resolved host and clone URL instead of normalizing everything to
`gitlab.com`.

The Marketplace registry is a TODO for implementation. Its interface should
resolve `marketplace:owner/package` by calling the backend and receiving a zip
package plus metadata. It should not leak Marketplace storage internals into
the installer.

## Skill Discovery

`skills add` discovers skills from a materialized package before writing the
manifest.

Discovery rules should follow the useful parts of `submodule/skills`:

- If `--path` points directly at a directory with `SKILL.md`, use it.
- Otherwise scan priority locations first:
  - repository root
  - `skills/`
  - `skills/.curated/`
  - `skills/.experimental/`
  - `skills/.system/`
  - `.agents/skills/`
  - common agent-specific skill folders from the agent registry
- If priority locations find nothing, recursively search for `SKILL.md` up to a
bounded depth.
- `--skill <name>` filters by skill name. Multiple `--skill` flags are allowed.
- If no `--skill` is passed and multiple skills are found in a TTY, use a
searchable Clack multiselect. In non-TTY mode, fail and ask for `--skill`.

The discovery output becomes manifest entries:

```typescript
export interface DiscoveredSkill {
  name: string;
  description?: string;
  path: string;
  rawSkillMd: string;
  metadata?: Record<string, unknown>;
}
```

## Agent Target Registry

The agent mapping should be migrated from `submodule/skills` instead of
invented from scratch. The first full implementation should include the
complete supported agent list from that project.

```typescript
export interface AgentInstallTarget {
  id: string;
  displayName: string;
  projectSkillsDir: string;
  globalSkillsDir?: string;
  detectInstalled(ctx: AgentDetectContext): Promise<boolean>;
}

export interface AgentDetectContext {
  cwd: string;
  homeDir: string;
  env: NodeJS.ProcessEnv;
  pathExists(path: string): boolean;
}
```

The registry returns install directories for selected agents. If two selected
agents map to the same directory, the installer deduplicates the target path.

Special examples from the referenced mapping:

- `cursor` project installs to `.agents/skills`, global installs to
`~/.cursor/skills`.
- `codex` project installs to `.agents/skills`, global installs to
`$CODEX_HOME/skills` or `~/.codex/skills`.
- `claude-code` project installs to `.claude/skills`, global installs to
`$CLAUDE_CONFIG_DIR/skills` or `~/.claude/skills`.

## Installer Interface

The installer receives already discovered skills and already selected target
directories. It does not resolve registries or mutate the manifest.

```typescript
export interface InstallPlan {
  skills: SelectedSkill[];
  targets: AgentInstallTarget[];
  mode: 'copy' | 'link';
  conflict: 'prompt' | 'overwrite' | 'skip' | 'fail';
  cwd: string;
}

export interface SelectedSkill {
  manifestName: string;
  sourceDir: string;
}
```

Responsibilities:

- Validate all source and target paths.
- Copy or link skill directories into each target agent directory.
- Deduplicate identical target paths.
- Handle existing directories according to conflict mode.
- Emit structured progress events for command UI.

## CLI Architecture

Follow the Story CLI shape:

```text
src/
  cli.ts
  cli/runtime.ts
  commands/
    index.ts
    install.ts
    skills.ts
  errors.ts
  manifest/
    parse.ts
    store.ts
    types.ts
  registries/
    index.ts
    git.ts
    github.ts
    gitlab.ts
    marketplace.ts
    file.ts
  discovery/
    discover.ts
    selection.ts
  agents/
    registry.ts
    targets.ts
  installer/
    install.ts
    materialize.ts
    conflicts.ts
  ui/
    prompts.ts
```

`src/cli.ts` builds the CLI and registers commands. Reusable modules remain
side-effect free.

`commands/index.ts` owns command registration order. Each command exports a
`register*Command(cli)` function.

`cli/runtime.ts` owns top-level parse, signal handling, and error formatting.

`errors.ts` should include a `SilentError` or equivalent user-facing error
type so expected validation failures do not print stack traces.

Command runtimes should be dependency-injected enough for unit tests: file IO,
git executor, prompt functions, fetch client, and process env should be
overridable.

## Implementation Slices

1. CLI shell and runtime
  - Add Story-style `buildCli`, `runCli`, `registerCoreCommands`.
  - Add `install` and `skills add` command shells.
  - Add user-facing error handling and non-TTY detection.
2. Manifest store
  - Parse and validate `ai-package.json`.
  - Read/write deterministic JSON.
  - Add manifest mutation helpers for `skills add` and `skills remove`.
3. Source registries
  - Move provider parsing out of manifest parsing.
  - Implement file, GitHub, and GitLab registries.
  - Store GitLab manifest sources as full clone URLs to preserve host.
  - Resolve Git default branch and `<ref>@<sha>` pinning.
4. Skill discovery and selection
  - Implement priority directory scanning.
  - Add `--path` and `--skill` behavior.
  - Add Clack searchable selection for TTY.
5. Agent target registry
  - Migrate complete `submodule/skills` agent mapping.
  - Add target validation and installed-agent detection.
  - Implement `--agent` parsing and TTY target selection.
6. Installer
  - Implement `--copy` and `--link`, default copy.
  - Implement `--force`, `--skip-existing`, and prompt conflict handling.
  - Deduplicate target directories.
7. Command integration
  - Wire `install` restore flow.
  - Wire `skills add` resolve/discover/write/install flow.
  - Add `skills list`, `skills remove`, `skills update`, and `skills search`
  shells or minimal implementations.
8. Marketplace follow-up
  - Implement backend zip API client.
  - Implement zip materialization.
  - Wire `--registry marketplace`.

## Validation Strategy

Unit tests:

- Manifest parse/write and deterministic formatting.
- Source parsing for GitHub, GitLab full clone URLs, Marketplace, file, URL,
and local path.
- Git version pinning for default branch and explicit ref.
- Skill discovery priority paths, `--path`, `--skill`, and non-TTY failures.
- Agent target path mapping for the full migrated registry.
- Copy/link installer behavior, path safety, dedupe, force, skip, and fail.

Integration tests:

- `ai-pkgs skills add owner/repo --agent cursor --skill foo --yes`.
- `ai-pkgs install --agent cursor --force`.
- GitHub and self-hosted GitLab clone URLs through local test repositories and
`insteadOf` rewriting.

E2E tests:

- Add from a repo with multiple skills and interactive selection.
- Restore from `ai-package.json` into selected agents.
- Conflict prompt behavior in a pseudo-TTY.

Verification commands after implementation:

```bash
bun run --filter ai-pkgs type-check
bun run --filter ai-pkgs test:unit
bun run lint
```

## Deferred Work

- Marketplace zip download and search backend integration.
- Lockfile semantics beyond installed-state compatibility.
- Plugin package management.
- Global install policy beyond the agent path registry.

