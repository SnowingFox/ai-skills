import Container from '@/components/layout/container';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
    <Container className="py-16 px-4">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <div className="mx-auto grid max-w-3xl gap-8 rounded-xl border bg-card p-8 sm:grid-cols-[auto_1fr]">
          <div className="flex items-center gap-6">
            <Avatar className="size-24">
              <AvatarImage src="/logo.png" alt="Avatar" />
              <AvatarFallback>MK</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-2">
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
      </div>
    </Container>
  );
}
