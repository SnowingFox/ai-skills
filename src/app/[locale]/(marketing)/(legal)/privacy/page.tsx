import { LegalPage } from '@/components/page/legal-page';
import { constructMetadata } from '@/lib/metadata';
import type { NextPageProps } from '@/types/next-page-props';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

const content = {
  en: {
    title: 'Privacy Policy',
    description: 'Add your privacy policy before launching this template.',
  },
  zh: {
    title: '隐私政策',
    description: '请在上线前补充你的隐私政策。',
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
    pathname: '/privacy',
  });
}

export default async function PrivacyPolicyPage(props: NextPageProps) {
  const params = await props.params;
  if (!params) {
    notFound();
  }

  const locale = params.locale as string;
  const page = content[locale as Locale] ?? content.en;

  if (!page) {
    notFound();
  }

  return <LegalPage title={page.title} description={page.description} />;
}
