# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

This repository is a Bun workspace. The Next.js app lives in `apps/web`,
and the Bun CLI starter workspace lives in `apps/cli`.

## Development Commands

- `bun run dev` - Start the `apps/web` Next.js dev server
- `bun run build` - Production build for `apps/web`
- `bun run preview` - Build and preview `apps/web` with OpenNext Cloudflare locally
- `bun run deploy` - Build and deploy `apps/web` with OpenNext Cloudflare
- `bun run lint` - Run root Biome checks across the workspace
- `bun run format` - Run root Biome formatter across the workspace
- `bun run db:generate` - Generate Drizzle migration files from schema changes
- `bun run db:migrate` - Apply pending migrations
- `bun run db:push` - Push schema directly to DB (dev only)
- `bun run db:studio` - Open Drizzle Studio GUI
- `bun run email` - Email template preview server on port 3333
- `bun run knip` - Find unused exports, dependencies, and files
- `bun run auth:schema:generate` - Regenerate Better Auth schema to `apps/web/src/db/auth.schema.ts`
- `bun run dev:cli` - Run the `apps/cli` Bun starter in watch mode
- `bun run start:cli` - Run the `apps/cli` Bun starter once
- `bun run type-check:cli` - Type-check `apps/cli`

Use Bun for package management and scripts. Prefer `bun run <script>`,
`bun add <package>`, and `bunx <package>`; do not introduce npm, pnpm, or
yarn workflows.

No automated test suite exists for the web app. Validate changes with
`bun run build`, `bun run lint`, and manual QA.

## Architecture Overview

### Routing & i18n

- App Router with `[locale]` dynamic segment using `next-intl` (as-needed prefix strategy — default locale omitted from URL)
- Route groups inside `[locale]`: `(marketing)` for public pages, `(protected)` for authenticated pages, `auth` for login/signup
- API routes at `apps/web/src/app/api/` (outside locale segment)
- Translation files: `apps/web/messages/en.json`, `apps/web/messages/zh.json`
- i18n routing config: `apps/web/src/i18n/routing.ts`; middleware: `apps/web/src/middleware.ts`

### Authentication (Better Auth)

- Server config: `apps/web/src/lib/auth.ts`; client: `apps/web/src/lib/auth-client.ts`
- PostgreSQL adapter via Drizzle, session cached 60s, 7-day expiry, fresh age disabled
- Plugins: admin, apiKey, emailHarmony (verification/password reset)
- OAuth: GitHub + Google with account linking
- Auth hooks auto-subscribe new users to newsletter and distribute registration credits
- Auth tables in `apps/web/src/db/schema.ts`: `user`, `session`, `account`, `verification`, `apikey`

### Database (Drizzle ORM + PostgreSQL)

- Connection: `apps/web/src/db/index.ts` using `postgres` driver (not `pg`), singleton pattern
- Schema: `apps/web/src/db/schema.ts` — auth tables + `payment`, `userCredit`, `creditTransaction`
- Payment records track `type` (subscription/one-time), `scene` (lifetime/credit/subscription), `status`; unique constraint on `invoiceId`
- Config: `apps/web/drizzle.config.ts` reads `DATABASE_URL` from env

### Server Actions (next-safe-action)

- Three-tier action clients in `apps/web/src/lib/safe-action.ts`:
  - `actionClient` — base, no auth required
  - `userActionClient` — requires authenticated session, ctx includes user/session
  - `adminActionClient` — requires admin role
- All actions use Zod schemas for input validation
- Actions organized by feature in `apps/web/src/actions/`

### Payment System (Stripe)

- Provider pattern in `apps/web/src/payment/` with Stripe as implementation
- Plans defined in `apps/web/src/config/website.tsx`: Free (50 credits), Pro ($9.90/mo or $99/yr, 1000 credits), Lifetime ($199 one-time, 1000 credits)
- Credit packages: Basic (100), Standard (200), Premium (500)
- Webhook handler validates signature and distributes credits on payment completion
- Checkout flow: server action → create Stripe customer if needed → record payment → redirect to Stripe → webhook updates record

### Credits System

- Core logic in `apps/web/src/credits/`
- 7 transaction types: `MONTHLY_REFRESH`, `REGISTER_GIFT`, `PURCHASE_PACKAGE`, `SUBSCRIPTION_RENEWAL`, `LIFETIME_MONTHLY`, `USAGE`, `EXPIRE`
- Credits tracked in `userCredit` table with history in `creditTransaction`
- Monthly distribution via `bun run distribute-credits` script

### Provider Pattern (used throughout)

All external integrations follow a pluggable provider pattern with factory functions:

- Payment: `apps/web/src/payment/` (Stripe)
- Mail: `apps/web/src/mail/` (Resend, React Email templates — all localized)
- Notifications: `apps/web/src/notification/` (Discord, Feishu)
- Storage: `apps/web/src/storage/` (S3 via `s3mini`)
- AI: `apps/web/src/ai/` (multiple image generation providers)

### State & Data Flow

- Server components fetch data directly; mutations via server actions
- Zustand stores in `apps/web/src/stores/` for client-side state
- React Query for async data on client
- Forms use React Hook Form + Zod validation

### Configuration

- Centralized app config with feature flags: `apps/web/src/config/website.tsx`
- Demo mode: `NEXT_PUBLIC_DEMO_WEBSITE` env var (enables Crisp chat, Turnstile CAPTCHA, looser admin checks)
- Environment template: `apps/web/.dev.vars.example`; copy it to ignored `apps/web/.dev.vars` for local OpenNext/Cloudflare development

## Code Style

- Biome enforces: 2-space indentation, 80-char line width, single quotes, ES5 trailing commas, semicolons required
- Filenames: kebab-case (`dashboard-sidebar.tsx`); hooks prefixed `use-` (`use-session.ts`)
- Named exports preferred; default exports only for pages/layouts
- Server-only code marked with `"use server"` directive
- Tailwind CSS v4 with tokens in `apps/web/src/styles/`
- UI primitives from Radix UI; icons from `lucide-react`
- Conventional Commits: `feat:`, `fix:`, `chore:`

## CLI Development Rules (`apps/cli`)

### Architecture Boundaries

- `apps/cli/src/cli.ts` owns CLI construction and entrypoint behavior only. Keep
command behavior in `src/commands/*`, help rendering in `src/cli/help.ts`,
help content in `src/cli/help-data/*`, and execution/error policy in
`src/cli/runtime.ts`.
- Keep provider-specific source logic behind registry interfaces in
`src/registries/*`. GitHub and GitLab should share the Git registry boundary
when behavior is identical; Marketplace remains a provider boundary even when
the implementation is deferred.
- Keep Git subprocess behavior in `src/git.ts`. Cache policy belongs in
`src/git-cache.ts`; install materialization belongs in `src/install.ts`;
copy/link/conflict behavior belongs in `src/installer/*`.
- Git-backed multi-skill checks must group work by `provider + packageId + ref`
and reuse the existing ref-resolution/cache boundaries. Do not resolve or
materialize the same source/ref once per skill; `skills outdated` and
`skills update` are the reference pattern.
- Do not add module-level side effects outside the CLI entrypoint. Modules should
export factories, helpers, and command registration functions; `buildCli()` /
`registerCoreCommands()` decide what is wired at startup.
- Prefer small exported pure helpers for command decisions (`resolveInstallMode`,
`resolveConflictPolicy`, `resolveInstallScope`, formatters). These make CLI UX
behavior unit-testable without spawning a process.

### JSDoc And Comments

- Every exported CLI helper, command runner, registry boundary, and cache helper
needs a concise multi-line JSDoc summary explaining behavior, not just the
type signature.
- Add `@example` when behavior has side effects, multiple modes, callbacks, or
non-obvious edge cases. Examples should show input and observable output.
- For functions with I/O side effects such as cloning, cache writes, manifest
writes, or install materialization, the JSDoc example must mention the
resulting filesystem/cache state and what cleanup does or does not happen.
- Avoid `@param` / `@returns` that simply restate TypeScript types. Use them only
when the meaning is not obvious from the signature.
- Do not add section-divider comments. Group related functions together and let
file/module JSDoc plus function JSDoc carry the explanation.

### Testing Discipline

- CLI changes require focused unit tests for exported decision helpers and
formatters, plus e2e coverage when behavior crosses command parsing, filesystem
writes, Git, or install targets.
- Tests must reflect real user or automation flows. Include failure paths for
invalid flags, non-interactive requirements, missing skills, cache misses, and
cache hits instead of only happy paths.
- Git/cache/install tests must use temporary directories and isolated cache
roots such as `AI_PKGS_CACHE_HOME`. Never let tests write to the developer's
real `~/.cache/ai-pkgs`, global agent skill directories, or repository root.
- Subprocess e2e tests must pass an explicit `cwd`. Do not rely on the parent
process cwd because that can accidentally install into this repository.
- Use Vitest (`bun run --cwd apps/cli test:unit`,
`bun run --cwd apps/cli test:e2e`) for CLI tests. Do not introduce `bun test`,
Jest, or ad-hoc test runners.
- Before claiming CLI work is complete, run `bun run type-check:cli`,
`bun run --cwd apps/cli test:unit`, `bun run --cwd apps/cli test:e2e`,
Biome on touched CLI files, and `bun run build:cli`.

### CLI UX Contracts

- Bare `ai-pkgs` renders help and must not attempt to read `ai-package.json`.
- `--ai` is strict non-interactive mode: no prompts, no spinners, deterministic
clack-style text output, and clear failure messages when required decisions are
missing.
- `ai-pkgs install` restores from `ai-package.json` into project-local targets.
`ai-pkgs install --global` restores from the fixed global manifest at
`~/.ai-pkgs/ai-package.json` into global agent skill directories.
- `skills add` writes to `ai-package.json` by default. `--install-only` skips
manifest reads/writes and must not be combined with `--manifest`.
- `skills add -g/--global` writes to `~/.ai-pkgs/ai-package.json` and installs
globally. `--global --install-only` performs a one-off global install without
writing the global manifest. `--global` and `--manifest` are mutually
exclusive.
- `skills list` is a manifest listing. Use ASCII-first Clack output in TTY,
stable plain text in non-TTY/`--ai`, and `--json` for machine output.
- `skills outdated [skill...]` is report-only: no args means all manifest
skills, positional names filter, unknown names fail with available names,
outdated results exit 0, and failed checks exit 1.
- `skills update [skill...]` must reuse the `outdated` check result, avoid
partial writes when any check fails, and require `--yes` in non-TTY/`--ai`.
- Mutually exclusive flags must fail early with `SilentError` and a detailed help
hint. Current examples include `--force` with `--skip-existing`, `--project`
with `--global`, and `--all` with `--skill`.
- Help data should stay detailed and scenario-based: grouped flags, grouped
examples, notes for special modes, and global flags visible in command help.

## File Editing Rules (Strict)

These rules apply to every code change, not just the first iteration.

- Never overwrite or rewrite source files via shell heredocs, scripted writes,
or one-shot file dumps. The following patterns are forbidden:
  - `python3 - <<'PY' ... p.write_text(...)` or any equivalent Python/Node
  heredoc that pipes a full file body into `Path(...).write_text`,
  `Bun.write`, `fs.writeFile`, etc.
  - `cat > path/to/file <<'EOF' ... EOF`, `echo "..." > file`,
  `sed -i 's/.../.../' file` for content edits.
  - Inline `bun -e "await Bun.write(...)"` or similar one-liners that produce
  or replace TypeScript/TSX/JSON sources.
- Use the `StrReplace` tool for targeted edits, the `Write` tool only when
creating a brand-new file from scratch, and the `Delete` tool to remove a
file. Read the file first when context is needed; do not guess.
- For batch edits across files, run `StrReplace` per file with `replace_all`
when appropriate, instead of generating files via shell scripts.
- Only `bun` (or its CLI equivalents like `bun run`, `bunx --bun`) may run
package or build commands. Do not introduce ad-hoc shell text-mangling
utilities to mutate project sources.

## UI Component Rules

- Always prefer shadcn/ui primitives in `apps/web/src/components/ui` over hand-rolled
markup. When a component is missing, install via
`bunx --bun shadcn@latest add <name>` from `apps/web` instead of building
a custom div.
- Do not commit non-shadcn registry mirrors (e.g. raw `magicui`, `tailark`,
`animate-ui`, `diceui` source dumps). If a registry component is needed,
install it on-demand and edit the resulting `apps/web/src/components/ui/*` file.
- Reuse the project layout primitives: `Container`, `SiteHeader`, `SiteFooter`
for marketing/public pages; `DashboardSidebar` for protected pages.