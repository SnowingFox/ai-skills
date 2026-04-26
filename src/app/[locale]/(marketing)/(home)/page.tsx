import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { constructMetadata } from '@/lib/metadata';
import { CopyIcon, SearchIcon } from 'lucide-react';
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

interface LeaderboardEntry {
  rank: number;
  name: string;
  source: string;
  installs: string;
}

const LEADERBOARD: LeaderboardEntry[] = [
  {
    rank: 1,
    name: 'find-skills',
    source: 'ai-skills/registry',
    installs: '1.2M',
  },
  {
    rank: 2,
    name: 'frontend-design',
    source: 'anthropics/skills',
    installs: '338.9K',
  },
  {
    rank: 3,
    name: 'web-design-guidelines',
    source: 'vercel-labs/agent-skills',
    installs: '278.9K',
  },
  {
    rank: 4,
    name: 'brainstorming',
    source: 'obra/superpowers',
    installs: '123.0K',
  },
  {
    rank: 5,
    name: 'shadcn',
    source: 'shadcn/ui',
    installs: '109.4K',
  },
  {
    rank: 6,
    name: 'next-best-practices',
    source: 'vercel-labs/next-skills',
    installs: '72.7K',
  },
  {
    rank: 7,
    name: 'systematic-debugging',
    source: 'obra/superpowers',
    installs: '71.7K',
  },
  {
    rank: 8,
    name: 'writing-plans',
    source: 'obra/superpowers',
    installs: '71.1K',
  },
  {
    rank: 9,
    name: 'test-driven-development',
    source: 'obra/superpowers',
    installs: '61.8K',
  },
  {
    rank: 10,
    name: 'verification-before-completion',
    source: 'obra/superpowers',
    installs: '50.5K',
  },
  {
    rank: 11,
    name: 'subagent-driven-development',
    source: 'obra/superpowers',
    installs: '52.3K',
  },
  {
    rank: 12,
    name: 'requesting-code-review',
    source: 'obra/superpowers',
    installs: '61.3K',
  },
];

const TOTAL_SKILLS = '90,988';

export default async function HomePage() {
  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 sm:px-6 lg:px-8">
      {/* Hero */}
      <section className="grid grid-cols-1 gap-8 py-10 sm:py-12 lg:grid-cols-[auto_1fr] lg:gap-14 lg:py-14">
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
      <section className="grid grid-cols-1 gap-10 pb-12 lg:grid-cols-[auto_1fr] lg:gap-14">
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

      {/* Leaderboard */}
      <section className="flex flex-col gap-6 pb-16">
        <h2 className="font-mono text-xs font-medium uppercase tracking-wide text-foreground">
          Skills Leaderboard
        </h2>

        <div className="relative">
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Search skills"
            placeholder="Search skills..."
            className="h-11 rounded-none border-0 border-input border-b bg-transparent pr-10 pl-8 font-mono text-base focus-visible:border-foreground focus-visible:ring-0 md:text-sm"
          />
          <kbd className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border border-border px-1.5 py-0.5 font-mono text-muted-foreground text-xs sm:inline-flex">
            /
          </kbd>
        </div>

        <Tabs defaultValue="all-time">
          <TabsList variant="line" className="-mb-px w-full justify-start">
            <TabsTrigger value="all-time">
              All Time ({TOTAL_SKILLS})
            </TabsTrigger>
            <TabsTrigger value="trending">Trending (24h)</TabsTrigger>
            <TabsTrigger value="hot">Hot</TabsTrigger>
          </TabsList>
        </Tabs>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 font-mono text-muted-foreground text-xs uppercase">
                #
              </TableHead>
              <TableHead className="font-mono text-muted-foreground text-xs uppercase">
                Skill
              </TableHead>
              <TableHead className="text-right font-mono text-muted-foreground text-xs uppercase">
                Installs
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {LEADERBOARD.map((entry) => (
              <TableRow key={`${entry.source}-${entry.name}`}>
                <TableCell className="w-12 font-mono text-muted-foreground text-sm">
                  {entry.rank}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
                    <span className="truncate font-medium">{entry.name}</span>
                    <span className="truncate font-mono text-muted-foreground text-xs sm:text-sm">
                      {entry.source}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {entry.installs}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
