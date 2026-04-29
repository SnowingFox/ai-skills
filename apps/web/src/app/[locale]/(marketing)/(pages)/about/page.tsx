import Container from '@/components/layout/container';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { websiteConfig } from '@/config/website';
import { constructMetadata } from '@/lib/metadata';
import { cn } from '@/lib/utils';
import { MailIcon, TwitterIcon } from 'lucide-react';
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
  const pt = await getTranslations({ locale, namespace: 'AboutPage' });

  return constructMetadata({
    title: pt('title') + ' | ' + t('title'),
    description: pt('description'),
    locale,
    pathname: '/about',
  });
}

/**
 * inspired by https://astro-nomy.vercel.app/about
 */
export default async function AboutPage() {
  const t = await getTranslations('AboutPage');

  return (
    <Container className="px-4 py-14 sm:py-16">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <div className="mx-auto grid max-w-4xl gap-8 rounded-xl border bg-card p-8 sm:grid-cols-[auto_1fr]">
          <div className="flex items-center gap-6">
            <Avatar className="size-24 rounded-md border bg-background">
              <AvatarFallback className="rounded-md font-mono text-2xl">
                AI
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-2">
              <Badge variant="secondary" className="w-fit font-mono uppercase">
                Registry
              </Badge>
              <h1 className="font-semibold text-3xl text-foreground">
                {t('authorName')}
              </h1>
              <p className="text-muted-foreground">{t('authorBio')}</p>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <p className="text-muted-foreground">{t('introduction')}</p>

            <div className="flex flex-col gap-3 sm:flex-row">
              {websiteConfig.metadata.social?.twitter && (
                <a
                  href={websiteConfig.metadata.social.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: 'outline' }))}
                >
                  <TwitterIcon data-icon="inline-start" />
                  {t('followMe')}
                </a>
              )}
              {websiteConfig.mail.supportEmail && (
                <Button asChild>
                  <a href={`mailto:${websiteConfig.mail.supportEmail}`}>
                    <MailIcon data-icon="inline-start" />
                    {t('talkWithMe')}
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: 'Workspace',
              description:
                'Private registries, team review flows, and controlled skill distribution.',
            },
            {
              title: 'Evaluation',
              description:
                'Repeatable benchmark runs and scorecards for agent workflow quality.',
            },
            {
              title: 'Agent Kits',
              description:
                'Reusable procedures that install into agents with a predictable command.',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl border bg-card p-5 transition-colors hover:bg-accent/40"
            >
              <h2 className="font-mono text-sm font-medium uppercase">
                {item.title}
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
}
