# AI Skills

[![npm](https://img.shields.io/npm/v/ai-pkgs)](https://www.npmjs.com/package/ai-pkgs)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.19-brightgreen)](https://nodejs.org)
[![License](https://img.shields.io/github/license/anthropics/ai-skills)](LICENSE)

AI Skills is a platform for distributing and managing AI agent components —
skills, plugins, and workspace iteration — across 47+ AI coding assistants.

This is a Bun workspace containing:

- **`apps/web`** — The AI Skills website (Next.js, deployed on Cloudflare)
- **`apps/cli`** — The `ai-pkgs` CLI package manager

## Install

```bash
npm i -g ai-pkgs
```

Or run without installing:

```bash
npx ai-pkgs@latest --help
```

## ai-pkgs CLI

Manage skills, plugins, and iterate on skills locally with Git push/pull.

### Skills

```bash
ai-pkgs skills add vercel-labs/skills --skill tdd --agent cursor --project
ai-pkgs skills list
ai-pkgs skills outdated
ai-pkgs skills update --yes
```

### Plugins

```bash
ai-pkgs plugins init my-plugin
ai-pkgs plugins add vercel/vercel-plugin --yes
ai-pkgs plugins list
```

### Workspace

```bash
ai-pkgs workspace link explain
ai-pkgs workspace push explain -m "feat: improve examples"
ai-pkgs workspace pull explain
ai-pkgs workspace status
```

### Restore from manifest

```bash
ai-pkgs install --agent cursor --force --yes
```

See [`apps/cli/README.md`](apps/cli/README.md) for the full CLI documentation.

## Supported agents

Cursor, Claude Code, Codex, Windsurf, GitHub Copilot, Gemini CLI, Cline,
Roo Code, Amp, Continue, Kilo Code, Trae, Devin, Goose, and 30+ more.

Run `ai-pkgs skills -h` for the full list of 47+ supported agents.

## Development

```bash
bun install
bun run dev              # Start apps/web Next.js dev server
bun run dev:cli          # Run apps/cli in watch mode
bun run build            # Production build for apps/web
bun run build:cli        # Production build for apps/cli
bun run lint             # Biome linter + formatter across the workspace
bun run format           # Biome formatter across the workspace
bun run type-check:cli   # Type-check apps/cli
```

### CLI testing

```bash
bun run --cwd apps/cli test:unit
bun run --cwd apps/cli test:e2e
```

### Database (apps/web)

```bash
bun run db:generate      # Generate Drizzle migration files
bun run db:migrate       # Apply pending migrations
bun run db:push          # Push schema directly (dev only)
bun run db:studio        # Open Drizzle Studio GUI
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. Use Conventional Commits
(`feat:`, `fix:`, `chore:`) for all commit messages.

## License

See [LICENSE](LICENSE).
