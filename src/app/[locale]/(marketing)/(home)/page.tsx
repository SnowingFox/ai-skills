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

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 sm:px-6 lg:px-8">
      {/* Hero */}
      <section className="grid grid-cols-1 gap-10 py-14 sm:py-16 lg:grid-cols-[auto_1fr] lg:gap-16 lg:py-20">
        <div className="flex flex-col items-center gap-4 lg:items-start">
          <h1 className="sr-only">Skills</h1>
          <pre
            aria-hidden="true"
            className="select-none whitespace-pre font-mono text-[12px] leading-[125%] tracking-tight text-foreground lg:text-[15px]"
          >
            {SKILLS_ASCII}
          </pre>
          <p className="text-center font-mono text-sm font-medium uppercase tracking-tight text-foreground lg:text-left lg:text-base">
            The Open Agent Skills Ecosystem
          </p>
        </div>
        <div className="flex items-center">
          <p className="text-balance text-center text-xl leading-tight tracking-tight text-muted-foreground lg:text-left lg:text-3xl">
            Skills are reusable capabilities for AI agents. Install them with a
            single command to enhance your agents with access to procedural
            knowledge.
          </p>
        </div>
      </section>

      {/* Try it now + agents */}
      <section className="grid grid-cols-1 gap-12 pb-16 lg:grid-cols-[auto_1fr] lg:gap-16">
        <div className="flex flex-col gap-3">
          <h2 className="font-mono text-xs font-medium uppercase tracking-wide text-foreground">
            Try it now
          </h2>
          <div className="flex w-full items-center justify-between gap-3 rounded-md bg-muted px-4 py-3 font-mono text-sm sm:max-w-sm">
            <code className="flex items-center gap-[1ch] truncate">
              <span className="text-muted-foreground">$</span>
              <span>npx ai-skills find</span>
              <span className="text-muted-foreground">&lt;query&gt;</span>
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
          <h2 className="font-mono text-xs font-medium uppercase tracking-wide text-foreground">
            Available for these agents
          </h2>
          <div className="relative">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-linear-to-r from-background to-transparent"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-linear-to-l from-background to-transparent"
            />
            <div className="flex gap-2 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {AGENTS.map((agent) => (
                <span
                  key={agent}
                  className="shrink-0 rounded-full border bg-background px-3 py-1.5 font-mono text-xs uppercase text-muted-foreground"
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
