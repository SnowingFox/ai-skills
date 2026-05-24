import { constructMetadata } from '@/lib/metadata';
import { MailIcon } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = constructMetadata({
  title: 'About | AI-SKILLS',
  description:
    'Why we built AI-SKILLS — a git-native, free-forever ecosystem for distributing agent skills and plugins.',
  locale: 'en',
  pathname: '/about',
});

export default function AboutPage() {
  return (
    <div className="mx-auto min-h-screen max-w-4xl px-4 py-12 sm:px-6 sm:py-20 lg:px-8">
      <header className="mb-14">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          About AI-SKILLS
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          The open ecosystem for distributing agent skills and plugins.
        </p>
      </header>

      {/* The Problem */}
      <section className="mb-14">
        <h2 className="mb-5 font-mono text-xs font-medium uppercase tracking-wide text-foreground">
          The problem
        </h2>
        <div className="flex flex-col gap-4 text-sm leading-7 text-muted-foreground">
          <p>
            The agent ecosystem is fragmented. Skills live in one registry,
            plugins in another, and installing either requires jumping between
            CLIs that don&apos;t talk to each other. None of them truly fit how
            developers work.
          </p>
          <p>
            We ran into this ourselves. Running{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
              --help
            </code>{' '}
            on a subcommand shouldn&apos;t execute a destructive action — but it
            did, silently overwriting local modifications. Removing a skill for
            one agent left ghost copies in shared directories that other agents
            still read. SSH and GitLab sources broke on updates because the CLI
            naively appended folder paths to clone URLs. Plugin installation
            required a separate authenticated session and a proprietary backend
            that couldn&apos;t run offline.
          </p>
          <p>
            These aren&apos;t edge cases — they&apos;re daily friction for
            anyone managing skills across a team or more than one coding agent.
          </p>
        </div>
      </section>

      {/* The Landscape */}
      <section className="mb-14">
        <h2 className="mb-5 font-mono text-xs font-medium uppercase tracking-wide text-foreground">
          The landscape
        </h2>
        <div className="flex flex-col gap-5 text-sm leading-7 text-muted-foreground">
          <div>
            <span className="font-medium text-foreground">
              skills.sh / Vercel{' '}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
                npx skills
              </code>
            </span>{' '}
            — the most popular skills-only CLI. Git-native for installation, but
            no plugin support, no unified manifest, and relies on a{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
              skills-lock.json
            </code>{' '}
            that only tracks skills (not plugins or team configs). Discovery and
            metadata are coupled to the skills.sh backend.
          </div>
          <div>
            <span className="font-medium text-foreground">
              skills.sh Platform CLI{' '}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
                ai
              </code>
            </span>{' '}
            — extends skills.sh with plugin support, but requires login, a
            proprietary registry API for all non-git operations, and only
            installs plugins to Claude Code and Cursor. Can&apos;t work offline
            or against private infrastructure without their backend running.
          </div>
          <div>
            <span className="font-medium text-foreground">aipack</span> — a
            profile-based composition engine with a sync model. Different
            paradigm: you author &ldquo;packs&rdquo; with a{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
              pack.json
            </code>{' '}
            manifest and sync them into harness-native configs. Powerful for
            complex setups, but not git-native distribution — packs are local
            artifacts, not published repos.
          </div>
          <div>
            <span className="font-medium text-foreground">agentpkg</span> — a
            bundle-first approach that compiles a{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
              .agentpkg.zip
            </code>{' '}
            into platform-specific directory structures. Good for single-agent
            portability, but the zip-and-compile model doesn&apos;t support team
            collaboration, version tracking, or incremental updates.
          </div>
          <p>
            Each tool solves a real problem. None of them unify skills and
            plugins under a single, git-native, reproducible workflow that works
            across all agents without a proprietary backend.
          </p>
        </div>
      </section>

      {/* Our Approach */}
      <section className="mb-14">
        <h2 className="mb-5 font-mono text-xs font-medium uppercase tracking-wide text-foreground">
          Our approach
        </h2>
        <ul className="flex flex-col gap-4 text-sm leading-7 text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">
              Git-native distribution
            </span>{' '}
            — every skill and plugin is a git repo. No proprietary hosting, no
            registry to sign up for. Works with GitHub, GitLab, self-hosted — if
            you can{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
              git clone
            </code>{' '}
            it, you can install from it.
          </li>
          <li>
            <span className="font-medium text-foreground">ai-package.json</span>{' '}
            — one manifest to declare skills, plugins, and team configs. Version
            pins are embedded directly (
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
              ref@commitSha
            </code>
            ) — no separate lock file to keep in sync.
          </li>
          <li>
            <span className="font-medium text-foreground">
              One CLI, all agents
            </span>{' '}
            — install to Cursor, Claude Code, Codex, Copilot, Windsurf, or 40+
            other agents from a single{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
              ai-pkgs
            </code>{' '}
            command.
          </li>
          <li>
            <span className="font-medium text-foreground">
              Predictable CLI behavior
            </span>{' '}
            —{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
              --help
            </code>{' '}
            never executes side effects.{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
              --ai
            </code>{' '}
            mode fails loudly with the exact flag you need, not silently.
            Per-agent directories mean no ghost copies after removal.
          </li>
          <li>
            <span className="font-medium text-foreground">
              Workspace workflow
            </span>{' '}
            — fork a skill into your project, iterate locally, push back
            upstream. Like{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
              npm link
            </code>{' '}
            for agent skills.
          </li>
          <li>
            <span className="font-medium text-foreground">Free forever</span> —
            open-source CLI, open registry, zero fees. We will never charge for
            distributing skills.
          </li>
        </ul>
      </section>

      {/* Honest Boundaries */}
      <section className="mb-14">
        <h2 className="mb-5 font-mono text-xs font-medium uppercase tracking-wide text-foreground">
          Where we are today
        </h2>
        <div className="flex flex-col gap-4 text-sm leading-7 text-muted-foreground">
          <p>
            AI-SKILLS is young. Plugin installation currently supports Claude
            Code, Cursor, and Codex. Marketplace search is still in development.
            Our leaderboard data builds on top of the skills.sh API — we
            acknowledge standing on their shoulders.
          </p>
          <p>
            What we&apos;re committed to: the{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
              ai-package.json
            </code>{' '}
            format stays compatible, the CLI stays free, and the distribution
            model stays git-native. Everything else is iterating fast.
          </p>
        </div>
      </section>

      {/* Contact */}
      <section className="border-t border-border pt-10">
        <h2 className="mb-4 font-mono text-xs font-medium uppercase tracking-wide text-foreground">
          Contact
        </h2>
        <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
          <a
            href="https://x.com/foxsnowing"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            <svg
              role="img"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="size-4"
            >
              <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
            </svg>
            @foxsnowing
          </a>
          <a
            href="mailto:gsnowingfox@gmail.com"
            className="flex items-center gap-2 underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            <MailIcon className="size-4" />
            gsnowingfox@gmail.com
          </a>
        </div>
      </section>
    </div>
  );
}
