import type { SiteContent } from '@/types';

/**
 * Bundled defaults for editable site content — the same role `DEFAULT_PLANS`
 * plays for pricing. These seed the database and act as the fallback whenever a
 * field comes back blank, so the marketing site renders correctly even if the
 * content row is missing, empty, or the request for it failed.
 *
 * Admins edit the live values at Admin → Content; nothing here needs a deploy.
 */
export const DEFAULT_CONTENT: SiteContent = {
  announcement: {
    enabled: false,
    message: '',
    tone: 'info',
  },
  marketing: {
    heroTitle: 'Turn every trade into data. Turn your data into discipline.',
    heroSubtitle:
      "Trader's Workbook is the complete journal, analytics and performance management system for serious traders. Record, analyze, identify mistakes, measure, improve — repeat.",
    heroNote: 'No credit card required · Free plan forever',
    ctaTitle: 'Ready to trade with an edge you can measure?',
  },
  faqs: [
    {
      id: 'privacy',
      question: 'Is my trading data private?',
      answer:
        'Yes. Your trades are yours alone. The app is built so that one user can never access another user’s data, enforced both in the app and at the database level.',
    },
    {
      id: 'broker',
      question: 'Do I need to connect my broker?',
      answer:
        'No. Trader’s Workbook is a journal — you record trades manually. This keeps you deliberate about reviewing every trade, which is where the improvement happens.',
    },
    {
      id: 'metrics',
      question: 'How are the metrics calculated?',
      answer:
        'Every financial metric — P&L, risk, R-multiple, expectancy, drawdown, ROI — comes from one tested calculation engine. When required inputs are missing (e.g. no stop loss), the metric shows N/A rather than a made-up value.',
    },
    {
      id: 'modes',
      question: 'Can I track Forex and Indian markets separately?',
      answer:
        'Yes. You get two books with their own starting capital and currency — the Indian one is always in rupees. Every figure is computed against the book the trade belongs to, so the two can never be mixed into one meaningless number.',
    },
    {
      id: 'export',
      question: 'What can I export?',
      answer:
        'Reports export to CSV (Excel-ready) and can be printed or saved as PDF on paid plans. On any plan, including Free, you can download your complete account data as JSON at any time.',
    },
  ],
};

/** Merges a stored row over the bundled defaults, ignoring blank fields. */
export function withContentDefaults(stored?: Partial<SiteContent> | null): SiteContent {
  if (!stored) return DEFAULT_CONTENT;
  const marketing = { ...DEFAULT_CONTENT.marketing, ...stored.marketing };
  // A blank string is an admin clearing a field, not an intent to show nothing.
  for (const key of Object.keys(marketing) as (keyof typeof marketing)[]) {
    if (!marketing[key]?.trim()) marketing[key] = DEFAULT_CONTENT.marketing[key];
  }
  return {
    announcement: { ...DEFAULT_CONTENT.announcement, ...stored.announcement },
    marketing,
    faqs: stored.faqs?.length ? stored.faqs : DEFAULT_CONTENT.faqs,
    updatedAt: stored.updatedAt,
  };
}
