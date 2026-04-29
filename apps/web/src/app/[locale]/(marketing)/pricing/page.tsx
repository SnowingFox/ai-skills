import Container from '@/components/layout/container';
import { PricingTable } from '@/components/pricing/pricing-table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { getTranslations } from 'next-intl/server';

export default async function PricingPage() {
  const t = await getTranslations('HomePage');
  const pt = await getTranslations('PricingPage');
  const faqs = ['item-1', 'item-2', 'item-3', 'item-4'] as const;

  return (
    <Container className="flex max-w-6xl flex-col gap-14 px-4 py-14 sm:py-16">
      <section className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
        <Badge variant="secondary" className="font-mono uppercase">
          AI-SKILLS
        </Badge>
        <h1 className="text-balance font-semibold text-4xl tracking-tight sm:text-5xl">
          {pt('subtitle')}
        </h1>
        <p className="text-balance text-lg text-muted-foreground">
          {pt('description')}
        </p>
      </section>

      <PricingTable />

      <section className="mx-auto flex w-full max-w-3xl flex-col gap-8">
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
    </Container>
  );
}
