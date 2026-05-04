# TODO

## Marketplace Skills Zip Distribution

Marketplace support is intentionally deferred from the first implementation
pass. The CLI architecture should still reserve the interface boundary so the
Marketplace provider can be added without changing manifest or installer
semantics.

### Deferred Scope

- Implement `--registry marketplace` for `ai-pkgs skills add`.
- Implement `ai-pkgs skills search [query]` against the Marketplace backend.
- Download Marketplace skills as zip packages from the backend.
- Materialize zip contents into the same discovery and installer pipeline used
by Git and local sources.
- Resolve Marketplace updates through the backend rather than through Git.

### Interface Contract Placeholder

The CLI should treat Marketplace packages as backend-owned zip snapshots. It
must not assume that Marketplace packages are backed by GitHub, GitLab, or any
other public VCS.

```typescript
export interface MarketplaceRegistry {
  resolve(input: MarketplaceResolveInput): Promise<MarketplacePackage>;
  search(query: MarketplaceSearchInput): Promise<MarketplaceSearchResult[]>;
  update(entry: ManifestSkillEntry): Promise<MarketplacePackage>;
}

export interface MarketplaceResolveInput {
  packageId: string;
  requestedSkills: string[];
  version?: string;
}

export interface MarketplacePackage {
  source: `marketplace:${string}`;
  version: string;
  files: MarketplacePackageFile[];
  skills: MarketplaceSkillMetadata[];
}

export interface MarketplacePackageFile {
  path: string;
  contents: Uint8Array;
}

export interface MarketplaceSkillMetadata {
  name: string;
  path: string;
  description?: string;
  hash?: string;
}

export interface MarketplaceSearchInput {
  query?: string;
  limit?: number;
}

export interface MarketplaceSearchResult {
  packageId: string;
  name: string;
  description?: string;
  latestVersion: string;
}
```

### Expected Manifest Entry

Marketplace entries should stay provider-level and reproducible. The version
string is opaque to the CLI and owned by the backend.

```json
{
  "skills": {
    "marketplace-skill": {
      "source": "marketplace:owner/package",
      "version": "stable@sha256:abc123",
      "path": "skills/marketplace-skill"
    }
  }
}
```

### Follow-Up Tasks

- Define backend endpoints for package resolution, search, and zip download.
- Add a fetch client with timeout, retry, and user-facing error messages.
- Add zip extraction or in-memory zip materialization.
- Add unit tests for Marketplace response validation and manifest writing.
- Add integration tests that install from a mocked Marketplace zip response.

