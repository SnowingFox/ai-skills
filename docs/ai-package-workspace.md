# Workspace: Skill Iteration Design

This document defines the design for `ai-pkgs workspace` — a feature that lets
users iterate on skills locally and push/pull changes to/from Git remotes.
Skills only; plugin workspace support is deferred.

---

## Command Tree

```text
ai-pkgs workspace (alias: ws)
  ├── link <name>           Move an installed skill to workspace for iteration
  ├── remove <name>         Remove workspace entry and delete local skill files
  ├── push <name>           Push local changes to remote
  ├── pull <name>           Pull latest from remote into local
  ├── status [name]         Show dirty/clean state vs last push
  └── list                  List all workspace skills

ai-pkgs skills add <source> --workspace
  └── Install directly into workspace.skills (skip skills[])
```

Shorthand: `ai-pkgs ws push explain` is equivalent to
`ai-pkgs workspace push explain`.

---

## Manifest Shape

Workspace entries live in `ai-package.json` under `workspace.skills`, keyed by
skill name. A skill appears in `skills` **or** `workspace.skills`, never both.

```json
{
  "skills": {
    "tdd": {
      "source": "github:mattpocock/skills",
      "path": "skills/engineering/tdd",
      "version": "main@b843cb5"
    }
  },
  "plugins": { ... },
  "workspace": {
    "skills": {
      "explain": {
        "local": ".cursor/skills/explain",
        "source": "github:entireio/skills",
        "path": "skills/explain",
        "version": "main@c376dc9"
      }
    }
  }
}
```

### Field Rules

| Field     | Required | Description |
|-----------|----------|-------------|
| `local`   | yes      | Relative path from project root to the skill directory on disk. |
| `source`  | yes      | Git remote. Same format as `skills[].source`: `github:owner/repo`, `gitlab:https://host/repo.git`, `git@host:owner/repo.git`, `https://github.com/owner/repo`. The user must have push access. |
| `path`    | yes      | Directory inside the remote repo that contains this skill. |
| `version` | yes      | `<branch>@<commitSha>`. The branch is locked at link time and cannot be changed. The commit SHA updates automatically after each push or pull. |

### Exclusivity Rule

A skill name exists in exactly one location:

- `skills` — dependency mode (consumer, read-only from user's perspective)
- `workspace.skills` — development mode (author, push/pull enabled)

`workspace link` moves a skill from `skills` → `workspace.skills`. It only
works for skills already present in `skills[]`.

`workspace remove` removes the workspace entry and deletes the local skill
directory from disk. The skill is fully removed — if you want it back as a
dependency afterward, run `skills add` separately.

For new skills that are not yet in `skills[]`, use
`skills add owner/repo --workspace` to install directly into workspace.

`skills add`, `skills update`, and `skills outdated` ignore workspace skills
entirely. Workspace skills are managed exclusively through `workspace` commands.

---

## Commands

### `ai-pkgs workspace link <name>`

Move an already-installed skill from `skills[]` to `workspace.skills` for local
iteration. The `source`, `path`, and `version` are auto-filled from the existing
manifest entry. The only prompt is an agent-aware local path selector.

`workspace link` only works for skills already in `skills[]`. For new skills,
use `skills add --workspace` instead.

```
$ ai-pkgs workspace link explain

┌  Workspace link
│
◇  Found "explain" in skills (github:entireio/skills)
│
◇  Which installed copy to iterate on?
│  ● .cursor/skills/explain
│  ○ .claude/skills/explain
│  ○ Custom path (type manually)
│
◆  Moved "explain" to workspace
│
│  local:   .cursor/skills/explain
│  source:  github:entireio/skills
│  path:    skills/explain
│  version: main@c376dc9
│
└  Link complete
```

The selector scans agent skill directories (using the agent registry) for the
skill folder. Found paths are listed first, followed by a "Custom path" option
that opens a text input. If the selected or typed path does not exist on disk,
the CLI shows an error and re-prompts.

#### Custom path with validation

```
$ ai-pkgs workspace link explain

┌  Workspace link
│
◇  Found "explain" in skills (github:entireio/skills)
│
◇  Which installed copy to iterate on?
│  ○ .cursor/skills/explain
│  ○ .claude/skills/explain
│  ● Custom path (type manually)
│
◇  Enter path:
│  .nonexistent/skills/explain
│
■  Path does not exist: .nonexistent/skills/explain
│
◇  Enter path:
│  .cursor/skills/explain
│
◆  Moved "explain" to workspace
│
│  local:   .cursor/skills/explain
│  source:  github:entireio/skills
│  path:    skills/explain
│  version: main@c376dc9
│
└  Link complete
```

`--ai` mode output:

```
$ ai-pkgs workspace link explain --ai --local .cursor/skills/explain

◇  Found "explain" in skills (github:entireio/skills)
◆  Moved "explain" to workspace
◇  local: .cursor/skills/explain
◇  source: github:entireio/skills
◇  path: skills/explain
◇  version: main@c376dc9
◆  Link complete
```

Flags:

- `--local <path>` — local skill path on disk, skip selector prompt. Required
  in `--ai` mode.

Errors:

- Skill not in `skills[]`: `"my-new-skill" is not in skills. Use
  "skills add <source> --workspace" to add a new workspace skill.`
- Skill already in workspace: `"explain" is already a workspace skill.`
- `--ai` mode without `--local`: `--local is required when linking in
  non-interactive mode.`
- `--local` path does not exist: `Path does not exist:
  .nonexistent/skills/explain`

### `ai-pkgs workspace remove <name>`

Remove a workspace skill entry from `ai-package.json` and delete the local
skill directory from disk. This is a destructive operation — the skill files
are permanently removed.

```
$ ai-pkgs workspace remove explain

┌  Workspace remove
│
▲  This will remove the workspace entry and delete local files:
│    .cursor/skills/explain
│
◇  Delete .cursor/skills/explain and remove workspace entry?
│  ● Yes, delete and remove
│  ○ No, cancel
│
◆  Deleted .cursor/skills/explain
◆  Removed "explain" from workspace
│
└  Remove complete
```

`--ai` mode requires `--yes`:

```
$ ai-pkgs workspace remove explain --ai --yes

◇  Deleting .cursor/skills/explain
◆  Deleted .cursor/skills/explain
◆  Removed "explain" from workspace
◆  Remove complete
```

Without `--yes` in `--ai` mode:

```
$ ai-pkgs workspace remove explain --ai

■  Pass --yes to confirm removal in non-interactive mode.
```

Flags:

- `-y, --yes` — skip confirmation prompt (required in `--ai` mode).

Errors:

- Skill not in workspace: `"tdd" is not a workspace skill. Available: explain`
- Local path does not exist: proceeds anyway (removes the workspace entry and
  warns that the directory was already missing).

### `ai-pkgs workspace push <name>`

Push local skill changes to the remote Git repository.

#### Flow: Clean push (no conflicts)

```
$ ai-pkgs workspace push explain

┌  Workspace push
│
◇  Fetching github:entireio/skills (main)...
│
◇  Commit message?  (default: chore: update explain)
│  feat: improve code explanation examples
│
◇  Copying .cursor/skills/explain -> skills/explain
│
◆  Committed: feat: improve code explanation examples
│
◇  Pushing to main...
│
◆  Pushed main@d4e5f6a
│
│  Updated version: main@c376dc9 -> main@d4e5f6a
│
└  Push complete
```

#### Flow: Conflict — TTY interactive resolution

When the remote has newer commits and push is rejected, TTY mode shows a
selector letting the user choose how to resolve:

```
$ ai-pkgs workspace push explain

┌  Workspace push
│
◇  Fetching github:entireio/skills (main)...
│
◇  Commit message?
│  chore: update explain
│
◇  Copying .cursor/skills/explain -> skills/explain
│
◆  Committed: chore: update explain
│
◇  Pushing to main...
│
▲  Push failed: remote has newer commits.
│
◇  How to resolve?
│  ● Accept my changes (force push, overwrite remote)
│  ○ Resolve locally (keep temp clone for manual merge)
│
◇  Force pushing to main...
│
◆  Pushed main@d4e5f6a (force)
│
│  Updated version: main@c376dc9 -> main@d4e5f6a
│
└  Push complete
```

If the user selects "Resolve locally":

```
◇  How to resolve?
│  ○ Accept my changes (force push, overwrite remote)
│  ● Resolve locally (keep temp clone for manual merge)
│
│  The working clone is preserved at:
│    /tmp/ai-pkgs-ws-a1b2c3/
│
│  To resolve:
│    cd /tmp/ai-pkgs-ws-a1b2c3
│    git pull --rebase origin main
│    # resolve conflicts
│    git push origin main
│
│  Then sync your local copy:
│    ai-pkgs workspace pull explain
│
└  Push failed (manual resolution required)
```

#### Flow: Conflict — `--accept-my-change` flag

```
$ ai-pkgs workspace push explain --accept-my-change -m "chore: update explain"

┌  Workspace push
│
◇  Fetching github:entireio/skills (main)...
│
◇  Copying .cursor/skills/explain -> skills/explain
│
◆  Committed: chore: update explain
│
◇  Pushing to main...
│
▲  Push rejected, force pushing with --accept-my-change...
│
◆  Pushed main@d4e5f6a (force)
│
│  Updated version: main@c376dc9 -> main@d4e5f6a
│
└  Push complete
```

#### Flow: Conflict — `--ai` mode without `--accept-my-change` (safe default)

```
$ ai-pkgs workspace push explain --ai -m "chore: update explain"

◇  Fetching github:entireio/skills (main)
◇  Copying .cursor/skills/explain -> skills/explain
◇  Committed: chore: update explain
◇  Pushing to main
■  Push failed: remote has newer commits.
■  The working clone is preserved at: /tmp/ai-pkgs-ws-a1b2c3/
■  Pass --accept-my-change to force push, or resolve manually.
```

`--ai` mode output (clean push):

```
$ ai-pkgs workspace push explain --ai -m "feat: improve examples"

◇  Fetching github:entireio/skills (main)
◇  Copying .cursor/skills/explain -> skills/explain
◇  Committed: feat: improve examples
◇  Pushing to main
◆  Pushed main@d4e5f6a
◆  Push complete
```

Conflict resolution behavior matrix:

| Mode | No flag | `--accept-my-change` |
|------|---------|---------------------|
| TTY  | Show selector (accept vs resolve locally) | Force push, no prompt |
| `--ai` | Fail with bail-out message | Force push, no prompt |

Flags:

- `--message <msg>` / `-m <msg>` — commit message, skip prompt.
- `--accept-my-change` — force push when remote has diverged, overwriting
  remote with local changes.
- `--ai` — non-interactive: auto-generates commit message if `--message` not
  provided (`chore: update <skill-name>`).

Errors:

- Skill not in workspace: `"tdd" is not a workspace skill.`
- Local path does not exist: `Local path ".cursor/skills/explain" does not
  exist. Did you move or delete the skill?`
- Authentication failure: `Push failed: authentication error. Check your Git
  credentials for github:entireio/skills.`

### `ai-pkgs workspace pull <name>`

Pull the latest version of a skill from the remote into the local directory.

```
$ ai-pkgs workspace pull explain

┌  Workspace pull
│
◇  Fetching github:entireio/skills (main)...
│
◆  Pulled skills/explain -> .cursor/skills/explain
│
│  Updated version: main@c376dc9 -> main@f7890ab
│
└  Pull complete
```

#### Flow: Local has uncommitted changes

```
$ ai-pkgs workspace pull explain

┌  Workspace pull
│
◇  Fetching github:entireio/skills (main)...
│
▲  Local directory .cursor/skills/explain has changes since last push.
│  Pulling will overwrite them.
│
◇  Continue?
│  ● Yes, overwrite local changes
│  ○ No, cancel
│
◆  Pulled skills/explain -> .cursor/skills/explain
│
│  Updated version: main@c376dc9 -> main@f7890ab
│
└  Pull complete
```

`--ai` mode: pull always overwrites without prompting. Use `workspace status`
first to check for local changes.

Flags:

- `--force` — skip the overwrite confirmation.

Errors:

- Skill not in workspace: `"tdd" is not a workspace skill.`
- Remote fetch failed: `Failed to fetch github:entireio/skills. Check the
  remote URL and your network connection.`

### `ai-pkgs workspace status [name]`

Show the sync state of workspace skills. Compares local files against the last
pushed/pulled commit.

#### Single skill

```
$ ai-pkgs workspace status explain

┌  Workspace status
│
◇  explain ─────────────────────────────────╮
│                                            │
│  local:   .cursor/skills/explain           │
│  source:  github:entireio/skills           │
│  path:    skills/explain                   │
│  version: main@c376dc9                     │
│  status:  modified (local has changes)     │
│                                            │
├────────────────────────────────────────────╯
│
└  Done.
```

#### All skills

```
$ ai-pkgs workspace status

┌  Workspace status
│
◇  Workspace skills (2) ────────────────────╮
│                                            │
│  explain                                   │
│    status: modified (local has changes)    │
│    version: main@c376dc9                   │
│                                            │
│  my-new-skill                              │
│    status: clean                           │
│    version: main@a1b2c3d                   │
│                                            │
├────────────────────────────────────────────╯
│
└  Done.
```

Status values:

| Status | Meaning |
|--------|---------|
| `clean` | Local matches last pushed version |
| `modified` | Local has changes since last push/pull |
| `untracked` | Version is `0000000` (never pushed) |

Status detection: clone the remote at the pinned `commitSha`, extract the skill
directory at `path`, and diff against the `local` directory. If any files differ
in content or are added/removed, the status is `modified`.

Plain-text output (non-TTY / `--ai`):

```
$ ai-pkgs workspace status --ai

explain: modified main@c376dc9
my-new-skill: clean main@a1b2c3d
```

### `ai-pkgs workspace list`

List all workspace skill entries.

```
$ ai-pkgs workspace list

┌  Workspace skills
│
◇  Workspace skills (2) ────────────────────────╮
│                                                │
│  explain                                       │
│    local:   .cursor/skills/explain             │
│    source:  github:entireio/skills             │
│    path:    skills/explain                     │
│    version: main@c376dc9                       │
│                                                │
│  my-new-skill                                  │
│    local:   .claude/skills/my-new-skill        │
│    source:  github:myteam/agent-skills         │
│    path:    skills/my-new-skill                │
│    version: main@0000000                       │
│                                                │
├────────────────────────────────────────────────╯
│
└  Done.
```

Empty state:

```
$ ai-pkgs workspace list

┌  Workspace skills
│
▲  No workspace skills.
│  Use "ai-pkgs workspace link <name>" to iterate on an installed skill,
│  or "ai-pkgs skills add <source> --workspace" to add a new one.
│
└  Done.
```

Flags:

- `--json` — machine-readable output.
- `--ai` — plain-text output.

JSON output:

```json
[
  {
    "name": "explain",
    "local": ".cursor/skills/explain",
    "source": "github:entireio/skills",
    "path": "skills/explain",
    "version": "main@c376dc9"
  }
]
```

### `ai-pkgs skills add <source> --workspace`

Install a skill directly into `workspace.skills`, skipping `skills[]`. Use this
for new skills that are not yet in the manifest.

```
$ ai-pkgs skills add entireio/skills --skill explain --workspace

┌  Skill add (workspace)
│
◇  Repository cloned (main@c376dc9)
│
◇  Discovered 5 skill(s)
│
◇  Local skill path?  (where to place the skill on disk)
│  .cursor/skills/explain
│
◇  Installing skill...
│
│  copy: explain -> .cursor/skills/explain
│
◆  Wrote workspace entry for "explain"
│
│  local:   .cursor/skills/explain
│  source:  github:entireio/skills
│  path:    skills/explain
│  version: main@c376dc9
│
└  Add complete
```

This combines `skills add` resolution + discovery with workspace entry writing.
The skill is installed to the `local` path (not to agent target directories),
and only the workspace entry is written.

Flags:

All standard `skills add` flags apply, plus:

- `--workspace` — route the entry to `workspace.skills` instead of `skills[]`.
  When set, the CLI prompts for a `local` path and skips the agent target
  selector.

Errors:

- `--workspace` with `--global`: `--workspace and --global are mutually
  exclusive. Workspace skills are always project-scoped.`

---

## Design Rules

### Branch Locking

The `version` field encodes both the branch name and the commit SHA:
`main@c376dc9`. The branch is set at `workspace link` time (or `skills add
--workspace` time) and cannot be changed afterward. All push and pull operations
target this locked branch.

To switch branches, `remove` the workspace skill and re-add it with a new
branch via `skills add --workspace --ref <new-branch>`.

### No Fork / Upstream Tracking

`source` is both where the skill was originally obtained AND where changes are
pushed to. There is no separate `upstream` field.

If you want to push to a different repo than where you installed from (fork
workflow), create the target repo yourself, then use `skills add --workspace`
with that repo as the source.

### Commit Message

| Mode | Behavior |
|------|----------|
| TTY  | Prompt with default `chore: update <skill-name>`. User can type a custom message. |
| `--message` flag | Use the provided message, skip prompt. |
| `--ai` mode | Auto-generate `chore: update <skill-name>` unless `--message` is provided. |

### Conflict Resolution

`workspace push` performs a straightforward sequence:

1. Clone/fetch the remote repo (reuse Git cache where possible).
2. Checkout the locked branch.
3. Copy the local skill directory into the clone at `path` (full directory
   overwrite).
4. `git add . && git commit -m "<message>"`.
5. `git push origin <branch>`.

On success: update `version` in `ai-package.json` and clean up the temp clone.

On push rejection (remote has diverged):

| Mode | No flag | `--accept-my-change` |
|------|---------|---------------------|
| TTY  | Show selector: "Accept my changes (force push)" vs "Resolve locally (manual merge)" | Force push without prompt |
| `--ai` | Fail with bail-out message and temp clone path | Force push without prompt |

"Accept my changes" performs `git push --force-with-lease origin <branch>`,
overwriting remote with the local version.

"Resolve locally" preserves the temp clone at `/tmp/ai-pkgs-ws-xxxxx/` and
prints manual resolution instructions. The user runs `workspace pull` after
resolving to sync the result back to their local directory.

### Pull Overwrite Warning

`workspace pull` replaces the local skill directory with the remote version. If
the local directory has changes since the last push/pull (detected by diffing
against the pinned commit), the CLI warns and asks for confirmation in TTY mode.

In `--ai` mode or with `--force`, pull always overwrites without prompting.

---

## Push / Pull Data Flow

```text
workspace push explain
  │
  ├── 1. Read workspace entry from ai-package.json
  │      { local: ".cursor/skills/explain", source: "github:entireio/skills",
  │        path: "skills/explain", version: "main@c376dc9" }
  │
  ├── 2. Clone/fetch entireio/skills into temp dir
  │      /tmp/ai-pkgs-ws-xxxxx/
  │
  ├── 3. Checkout branch "main"
  │
  ├── 4. Copy .cursor/skills/explain/ -> /tmp/.../skills/explain/
  │      (full directory replace)
  │
  ├── 5. git add . && git commit -m "chore: update explain"
  │
  ├── 6. git push origin main
  │      ├── success: update version to main@<new-sha>, clean up temp
  │      ├── rejected + TTY: show selector (force push vs resolve locally)
  │      ├── rejected + --accept-my-change: git push --force-with-lease
  │      └── rejected + --ai (no flag): fail, print temp path
  │
  └── 7. Clean up temp dir (on success / force push only)

workspace pull explain
  │
  ├── 1. Read workspace entry from ai-package.json
  │
  ├── 2. Clone/fetch entireio/skills at latest
  │
  ├── 3. Detect local changes (diff local vs pinned commit)
  │      ├── changes found + TTY: warn and prompt
  │      ├── changes found + --force / --ai: proceed
  │      └── no changes: proceed
  │
  ├── 4. Copy /tmp/.../skills/explain/ -> .cursor/skills/explain/
  │      (full directory replace)
  │
  ├── 5. Get latest commit SHA on branch
  │
  └── 6. Update version to main@<latest-sha>
```

---

## CLI Architecture

```text
src/
  commands/
    workspace/
      index.ts          # registerWorkspaceCommand, dispatch (alias: ws)
      link.ts           # workspace link (existing skills[] only)
      remove.ts         # workspace remove (delete entry + local files)
      push.ts           # workspace push (with --accept-my-change)
      pull.ts           # workspace pull
      status.ts         # workspace status
      list.ts           # workspace list
      types.ts          # WorkspaceCommandOptions, WorkspaceSkillEntry
  manifest/
    parse.ts            # extend to parse workspace.skills
    store.ts            # extend with addWorkspaceSkill, removeWorkspaceSkill,
                        #   moveSkillToWorkspace
    types.ts            # extend RawAiPackageManifest with workspace
  types.ts              # extend AiPackageManifest with workspace
```

### Manifest Store Extensions

New methods on the manifest store:

- `addWorkspaceSkill(entry)` — add or update a workspace skill entry.
- `removeWorkspaceSkill(name)` — remove a workspace skill entry.
- `moveSkillToWorkspace(name, localPath)` — atomically move a skill from
  `skills` to `workspace.skills`, preserving `source`, `path`, `version` and
  adding the `local` field.

### Source Parsing

The `source` field in workspace entries reuses the existing source format parser
from `skills[].source`. All formats are supported:

- `github:owner/repo`
- `gitlab:https://host/repo.git`
- `https://github.com/owner/repo`
- `git@host:owner/repo.git`

The registry resolution logic from `skills add` is reused for clone/fetch
operations during push and pull.

---

## Interaction with Existing Commands

| Command | Behavior with workspace skills |
|---------|-------------------------------|
| `skills add` | Ignores workspace skills. `--workspace` flag routes to `workspace.skills`. |
| `skills list` | Does not show workspace skills. |
| `skills update` | Does not update workspace skills. |
| `skills outdated` | Does not check workspace skills. |
| `skills remove` | Cannot remove a workspace skill. Prints: `"explain" is a workspace skill. Use workspace remove to delete it.` |
| `ai-pkgs install` | Does not install workspace skills (they are already at their `local` path). |
| `workspace list` | Shows only workspace skills. |
| `workspace push/pull` | Only operates on workspace skills. |

---

## Deferred Work

- **Plugin workspace**: `workspace.plugins` with push/pull for plugin
  directories. Deferred because plugins have vendor dirs, marketplace manifests,
  and multi-target installation that add complexity.
- **`workspace diff`**: Show a file-level diff between local and last-pushed
  version.
- **`workspace sync`**: Bidirectional sync (pull then push) in a single command.
- **PR creation**: `workspace push --pr` to open a pull request instead of
  pushing directly to the branch.
- **Multi-skill push**: `workspace push --all` to push all modified workspace
  skills at once.
- **Branch switching**: `workspace branch <name> <new-branch>` to change the
  locked branch (currently requires remove + re-add via `skills add --workspace`).
