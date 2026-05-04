import { Button } from '@/components/ui/button';
import { SkillsLeaderboard } from '@/components/skills/skills-leaderboard';
import { fetchAllTimeSkills } from '@/lib/skills-api';
import { constructMetadata } from '@/lib/metadata';
import { CopyIcon } from 'lucide-react';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';

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

const AGENTS = [
  'Claude Code',
  'Codex',
  'Cursor',
  'Gemini',
  'Copilot',
  'Windsurf',
  'Goose',
  'Cline',
  'Roo',
  'Trae',
  'OpenCode',
  'Kilo',
  'Droid',
  'AMP',
  'Antigravity',
  'VSCode',
];

export default async function HomePage() {
  const initialSkillsData = await fetchAllTimeSkills(0);
  const scrollingAgents = [...AGENTS, ...AGENTS];

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 sm:px-6 lg:px-8">
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
            The Open Agent Skills Ecosystem
          </p>
        </div>
        <div className="flex items-center">
          <p className="text-balance text-center text-xl leading-tight tracking-tight text-muted-foreground sm:text-2xl lg:text-left lg:text-3xl">
            Skills are reusable capabilities for AI agents. Install them with a
            single command to enhance your agents with access to procedural
            knowledge.
          </p>
        </div>
      </section>

      {/* Try it now + agents */}
      <section className="grid grid-cols-1 gap-10 pb-12 lg:grid-cols-[auto_1fr] lg:gap-14">
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
        <div className="flex flex-col gap-3">
          <h2 className="font-mono text-xs font-medium uppercase tracking-wide text-foreground sm:text-center lg:text-left">
            Available for these agents
          </h2>
          <div className="group relative overflow-hidden">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-linear-to-r from-background to-transparent sm:w-32 lg:w-48"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-linear-to-l from-background to-transparent sm:w-32 lg:w-48"
            />
            <div className="flex w-max animate-[skills-marquee_34s_linear_infinite] gap-3 py-2 group-hover:paused">
              {scrollingAgents.map((agent, index) => (
                <span
                  key={`${agent}-${index}`}
                  className="flex h-12 min-w-20 shrink-0 items-center justify-center rounded-md border bg-background/80 px-3 font-mono text-xs uppercase text-muted-foreground transition-colors hover:text-foreground sm:h-14 sm:min-w-24"
                >
                  {agent}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SkillsLeaderboard initialData={initialSkillsData} />
    </div>
  );
}
