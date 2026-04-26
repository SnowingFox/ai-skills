import Container from '@/components/layout/container';
import { NewsletterCard } from '@/components/newsletter/newsletter-card';
import { PricingTable } from '@/components/pricing/pricing-table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { LocaleLink } from '@/i18n/navigation';
import { constructMetadata } from '@/lib/metadata';
import { Routes } from '@/routes';
import {
  ArrowRightIcon,
  CreditCardIcon,
  LayoutDashboardIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from 'lucide-react';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';

/**
 * https://next-intl.dev/docs/environments/actions-metadata-route-handlers#metadata-api
 */
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

interface HomePageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function HomePage(_props: HomePageProps) {
  const t = await getTranslations('HomePage');

  const features = [
    {
      icon: ShieldCheckIcon,
      title: t('features.items.item-1.title'),
      description: t('features.items.item-1.description'),
    },
    {
      icon: CreditCardIcon,
      title: t('features.items.item-2.title'),
      description: t('features.items.item-2.description'),
    },
    {
      icon: LayoutDashboardIcon,
      title: t('features.items.item-3.title'),
      description: t('features.items.item-3.description'),
    },
    {
      icon: SparklesIcon,
      title: t('features.items.item-4.title'),
      description: t('features.items.item-4.description'),
    },
  ];

  const faqs = ['item-1', 'item-2', 'item-3', 'item-4'] as const;

  return (
    <Container className="flex flex-col gap-24 px-4 py-20">
      <section className="mx-auto flex max-w-4xl flex-col items-center gap-8 text-center">
        <Badge variant="outline">{t('hero.introduction')}</Badge>
        <div className="flex flex-col gap-6">
          <h1 className="text-balance font-semibold text-4xl tracking-tight sm:text-6xl">
            {t('hero.title')}
          </h1>
          <p className="mx-auto max-w-2xl text-balance text-lg text-muted-foreground">
            {t('hero.description')}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <LocaleLink href={Routes.Register}>
              {t('hero.primary')}
              <ArrowRightIcon data-icon="inline-end" />
            </LocaleLink>
          </Button>
          <Button asChild size="lg" variant="outline">
            <LocaleLink href={Routes.About}>{t('hero.secondary')}</LocaleLink>
          </Button>
        </div>
      </section>

      <section id="features" className="flex flex-col gap-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-3 text-center">
          <Badge variant="secondary">{t('features.title')}</Badge>
          <h2 className="text-balance font-semibold text-3xl tracking-tight">
            {t('features.subtitle')}
          </h2>
          <p className="text-muted-foreground">{t('features.description')}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title}>
                <CardHeader>
                  <div className="mb-2 flex size-10 items-center justify-center rounded-lg border bg-muted">
                    <Icon className="size-5" />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-3 text-center">
          <Badge variant="secondary">{t('pricing.title')}</Badge>
          <h2 className="text-balance font-semibold text-3xl tracking-tight">
            {t('pricing.subtitle')}
          </h2>
          <p className="text-muted-foreground">{t('pricing.description')}</p>
        </div>
        <PricingTable />
      </section>

      <section
        id="faqs"
        className="mx-auto flex w-full max-w-3xl flex-col gap-8"
      >
        <div className="flex flex-col gap-3 text-center">
          <Badge variant="secondary">{t('faqs.title')}</Badge>
          <h2 className="text-balance font-semibold text-3xl tracking-tight">
            {t('faqs.subtitle')}
          </h2>
        </div>
        <Accordion type="single" collapsible>
          {faqs.map((item) => (
            <AccordionItem key={item} value={item}>
              <AccordionTrigger>
                {t(`faqs.items.${item}.question`)}
              </AccordionTrigger>
              <AccordionContent>
                {t(`faqs.items.${item}.answer`)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <NewsletterCard />
    </Container>
  );
}
