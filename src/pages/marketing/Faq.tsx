import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { Seo, breadcrumbSchema, faqPageSchema, webPageSchema, MARKETING_TRAIL } from '@/components/seo';
import { useSiteContent } from '@/hooks/useContent';
import { cn } from '@/utils/cn';

const PAGE = {
  path: ROUTES.faq,
  name: 'Frequently asked questions',
  description:
    'Straight answers on data privacy, broker connections, how metrics are calculated, tracking Forex and Indian markets separately, and what you can export.',
};

export default function Faq() {
  // Entries are admin-editable (Admin → Content) and fall back to the bundled
  // defaults, so answering a new common question no longer needs a deploy.
  const { data } = useSiteContent();
  const faqs = data?.faqs ?? [];
  const [open, setOpen] = useState<string | null>(faqs[0]?.id ?? null);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      {/*
        The FAQPage block is built from `faqs` — the very array rendered below —
        so the structured data cannot describe questions the page does not show.
        An admin who clears the list gets no FAQPage rather than an empty one.
      */}
      <Seo
        path={PAGE.path}
        schema={[
          webPageSchema({ name: PAGE.name, description: PAGE.description, path: PAGE.path }),
          breadcrumbSchema([...MARKETING_TRAIL, { name: PAGE.name, path: PAGE.path }]),
          faqPageSchema(faqs),
        ]}
      />

      <h1 className="text-3xl font-bold tracking-tight text-text sm:text-4xl">Frequently asked questions</h1>
      <div className="mt-8 divide-y divide-border rounded-card border border-border bg-surface">
        {faqs.map((item) => (
          <div key={item.id}>
            <h2>
              <button
                type="button"
                onClick={() => setOpen(open === item.id ? null : item.id)}
                aria-expanded={open === item.id}
                aria-controls={`faq-answer-${item.id}`}
                id={`faq-question-${item.id}`}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <span className="text-sm font-medium text-text">{item.question}</span>
                <ChevronDown
                  aria-hidden="true"
                  className={cn('h-4 w-4 shrink-0 text-muted transition-transform', open === item.id && 'rotate-180')}
                />
              </button>
            </h2>
            {open === item.id && (
              <p id={`faq-answer-${item.id}`} role="region" aria-labelledby={`faq-question-${item.id}`} className="px-5 pb-4 text-sm text-muted">
                {item.answer}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
