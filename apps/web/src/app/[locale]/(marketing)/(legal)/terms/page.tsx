import { LegalPage } from '@/components/page/legal-page';
import { constructMetadata } from '@/lib/metadata';
import type { NextPageProps } from '@/types/next-page-props';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

const content: Record<string, { title: string; description: string }> = {
  en: {
    title: 'Terms of Service',
    description: 'Add your terms of service before launching this template.',
  },
  zh: {
    title: '服务条款',
    description: '请在上线前补充你的服务条款。',
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata | undefined> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  const page = content[locale] ?? content.en;

  return constructMetadata({
    title: page.title + ' | ' + t('title'),
    description: page.description,
    locale,
    pathname: '/terms',
  });
}

export default async function TermsOfServicePage(props: NextPageProps) {
  const params = await props.params;
  if (!params) {
    notFound();
  }

  const locale = params.locale as string;
  const page = content[locale] ?? content.en;

  if (!page) {
    notFound();
  }

  return <LegalPage title={page.title} description={page.description} />;
}
