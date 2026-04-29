import { LocaleLink } from '@/i18n/navigation';
import { Routes } from '@/routes';
import { getTranslations } from 'next-intl/server';

export async function SiteFooter() {
  const t = await getTranslations();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
        <p>
          © {year} {t('Metadata.name')}. All rights reserved.
        </p>
        <nav
          aria-label="Footer"
          className="flex items-center gap-4 font-mono uppercase"
        >
          <LocaleLink href={Routes.About} className="hover:text-foreground">
            About
          </LocaleLink>
          <LocaleLink href={Routes.Pricing} className="hover:text-foreground">
            Pricing
          </LocaleLink>
          <LocaleLink
            href={Routes.PrivacyPolicy}
            className="hover:text-foreground"
          >
            Privacy
          </LocaleLink>
          <LocaleLink
            href={Routes.TermsOfService}
            className="hover:text-foreground"
          >
            Terms
          </LocaleLink>
        </nav>
      </div>
    </footer>
  );
}
