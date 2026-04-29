# Skills ai-package.json Decisions

This document records the current v1 decisions for using `ai-package.json` to
manage skills. Plugins are intentionally out of scope for this round and will
be designed later.

## Summary

- `ai-package.json` is the user-editable manifest for skills.
- `ai-package.json` is the primary interface; `skills-lock.json` is only for
  compatibility or installed-state tracking.
- The top-level key is `skills`, not the singular `skill` used by the current
  tiktok schema.
- Each skill entry is keyed by the installed skill name.
- The skill name can differ from the source directory name.

## Manifest Shape

```json
{
  "skills": {
    "find-skills": {
      "source": "github:vercel-labs/skills",
      "version": "main@df0579f85cb8a360473c921e1343359006100d3c",
      "path": "skills/find-skills"
    },
    "grill-me": {
      "source": "file:.",
      "path": ".agents/skills/grille-me"
    }
  }
}
```

## Field Rules

### `source`

`source` is a locator string in the form `<provider>:<package-id>`.

Supported v1 providers:

- `github:owner/repo`
- `gitlab:group/repo`
- `marketplace:owner/package`
- `file:relative-or-absolute-path`

### `version`

`version` is required for remote sources.

For Git-backed sources, use `<ref>@<commitSha>`.

Example:

```json
"version": "main@df0579f85cb8a360473c921e1343359006100d3c"
```

Installation must use the commit sha as the source of truth. The ref exists to
make future updates understandable and to provide the update source.

`file:` sources may omit `version`.

### `path`

`path` is required. It points to the skill directory inside the source package
or repository.

The target directory must contain `SKILL.md`.

The installer should not auto-discover `SKILL.md`; the manifest must make the
skill location explicit.

## Validation Examples

Valid:

- `github:vercel-labs/skills` with `main@<sha>` and `skills/find-skills`
- `file:.` with `.agents/skills/grille-me`

Invalid:

- A remote source without `version`
- An entry without `path`
- A `path` that does not contain `SKILL.md`

## Notes

- `skills-lock.json` should not become the main user-authored configuration.
- The older tiktok `ai-package.md` design is too stateful for this manifest
  because it tracks installed files and timestamps.
- The tiktok `ai-package-v2.md` ownership model, including `origin` and
  `ejectedFrom`, is intentionally deferred.
- Plugins are deferred so that the skills interface can stay small and stable.
