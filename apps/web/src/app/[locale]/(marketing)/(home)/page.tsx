import { Button } from '@/components/ui/button';
import { SkillsLeaderboardSection } from '@/components/skills/skills-leaderboard-server';
import { SkillsLeaderboardSkeleton } from '@/components/skills/skills-leaderboard-skeleton';
import { constructMetadata } from '@/lib/metadata';
import { getBaseUrl } from '@/lib/urls';
import { CopyIcon } from 'lucide-react';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

export const revalidate = 10800;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata | undefined> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  return constructMetadata({
    title: t('title'),
    description: t('description'),
    locale,
    pathname: '',
  });
}

const SKILLS_ASCII = `███████╗██╗  ██╗██╗██╗     ██╗     ███████╗
██╔════╝██║ ██╔╝██║██║     ██║     ██╔════╝
███████╗█████╔╝ ██║██║     ██║     ███████╗
╚════██║██╔═██╗ ██║██║     ██║     ╚════██║
███████║██║  ██╗██║███████╗███████╗███████║
╚══════╝╚═╝  ╚═╝╚═╝╚══════╝╚══════╝╚══════╝`;

const SKILLS_ASCII_SOLID = `███████ ██   ██ ██ ██      ██      ███████
██      ██  ██  ██ ██      ██      ██
███████ █████   ██ ██      ██      ███████
     ██ ██  ██  ██ ██      ██           ██
███████ ██   ██ ██ ███████ ███████ ███████
                                              `;

interface AgentMark {
  slug: string;
  name: string;
}

const AGENTS: AgentMark[] = [
  { slug: 'claude-code', name: 'Claude Code' },
  { slug: 'cursor', name: 'Cursor' },
  { slug: 'codex', name: 'Codex' },
  { slug: 'copilot', name: 'GitHub Copilot' },
  { slug: 'windsurf', name: 'Windsurf' },
  { slug: 'gemini', name: 'Gemini' },
  { slug: 'cline', name: 'Cline' },
  { slug: 'amp', name: 'AMP' },
  { slug: 'antigravity', name: 'Antigravity' },
  { slug: 'clawdbot', name: 'ClawdBot' },
  { slug: 'droid', name: 'Droid' },
  { slug: 'goose', name: 'Goose' },
  { slug: 'kilo', name: 'Kilo' },
  { slug: 'kiro-cli', name: 'Kiro CLI' },
  { slug: 'nous-research', name: 'Nous Research' },
  { slug: 'opencode', name: 'OpenCode' },
  { slug: 'roo', name: 'Roo' },
  { slug: 'trae', name: 'Trae' },
  { slug: 'vscode', name: 'VS Code' },
];

export default async function HomePage() {
  const scrollingAgents = [...AGENTS, ...AGENTS];
  const baseUrl = getBaseUrl();
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'AI-SKILLS',
      url: baseUrl,
      description:
        'The open ecosystem for distributing agent skills and plugins — git-native, free forever, managed by ai-package.json.',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'AI-SKILLS',
      url: baseUrl,
      logo: `${baseUrl}/logo.png`,
      sameAs: ['https://x.com/foxsnowing'],
      contactPoint: {
        '@type': 'ContactPoint',
        email: 'gsnowingfox@gmail.com',
      },
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD is static, structured metadata for crawlers.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto min-h-screen w-full max-w-6xl overflow-hidden px-4 sm:px-6 lg:px-8">
        {/* Hero */}
        <section className="mx-auto grid w-full grid-cols-1 gap-10 py-12 sm:py-14 lg:grid-cols-[auto_1fr] lg:gap-14 lg:py-16">
          <div className="grid grid-cols-1 gap-2 py-1">
            <h1 className="sr-only">AI Skills</h1>
            <div className="relative flex w-full animate-in items-start justify-center overflow-hidden fade-in zoom-in-95 duration-700 lg:justify-start">
              <div className="relative max-w-[320px] overflow-hidden lg:max-w-[390px]">
                <pre
                  aria-hidden="true"
                  className="select-none whitespace-pre font-mono text-[12px] leading-[125%] tracking-[-1px] text-muted-foreground lg:text-[15px]"
                >
                  {SKILLS_ASCII}
                </pre>
                <pre
                  aria-hidden="true"
                  className="absolute left-0 top-0 select-none whitespace-pre font-mono text-[12px] leading-[125%] tracking-[-1px] text-foreground lg:text-[15px]"
                >
                  {SKILLS_ASCII_SOLID}
                </pre>
              </div>
            </div>
            <p className="text-center font-mono text-[15px] font-medium uppercase tracking-tight text-primary lg:text-left lg:text-[19px]">
              The Open Agent Skills &amp; Plugins Ecosystem
            </p>
          </div>
          <div className="flex items-center">
            <p className="text-balance text-center text-xl leading-tight tracking-tight text-muted-foreground sm:text-2xl lg:text-left lg:text-3xl">
              One CLI for skills and plugins — git-native, free forever. Managed
              by{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
                ai-package.json
              </code>{' '}
              for reproducible agent setups across your entire team.
            </p>
          </div>
        </section>

        {/* Try it now + agents */}
        <section className="grid grid-cols-1 gap-10 overflow-hidden pb-12 lg:grid-cols-[auto_1fr] lg:gap-14">
          <div className="flex flex-col gap-3">
            <h2 className="font-mono text-xs font-medium uppercase tracking-wide text-foreground sm:text-center lg:text-left">
              Try it now
            </h2>
            <div className="mx-auto flex w-full items-center justify-between gap-3 rounded-md bg-muted/80 px-4 py-3 font-mono text-sm transition-colors hover:bg-muted sm:max-w-[348px] lg:mx-0">
              <code className="flex items-center gap-[1ch] truncate">
                <span className="text-muted-foreground">$</span>
                <span>
                  ai-pkgs skills add vercel-labs/skills --all --agent cursor
                </span>
              </code>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Copy command"
                className="text-muted-foreground hover:text-foreground"
              >
                <CopyIcon />
              </Button>
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-3 overflow-hidden">
            <h2 className="font-mono text-xs font-medium uppercase tracking-wide text-foreground sm:text-center lg:text-left">
              Available for these agents
            </h2>
            <div className="group relative w-full overflow-hidden">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-linear-to-r from-background to-transparent sm:w-24 lg:w-32"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-linear-to-l from-background to-transparent sm:w-24 lg:w-32"
              />
              <div className="flex w-max animate-[skills-marquee_34s_linear_infinite] items-center gap-6 py-2 group-hover:paused sm:gap-8">
                {scrollingAgents.map((agent, index) => (
                  <img
                    key={`${agent.slug}-${index}`}
                    src={`/agents/${agent.slug}.svg`}
                    alt={agent.name}
                    width={88}
                    height={88}
                    loading="eager"
                    decoding="sync"
                    className="h-14 w-auto shrink-0 object-contain grayscale transition-all duration-300 hover:grayscale-0 sm:h-16 lg:h-20"
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <Suspense fallback={<SkillsLeaderboardSkeleton />}>
          <SkillsLeaderboardSection />
        </Suspense>
      </div>
    </>
  );
}
