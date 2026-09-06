import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';

const FAQS = [
  { q: 'Is my trading data private?', a: 'Yes. Your trades are yours alone. The app is built so that one user can never access another user’s data, enforced both in the app and (with a real backend) at the database level.' },
  { q: 'Do I need to connect my broker?', a: 'No. Trader’s Workbook is a journal — you record trades manually or import them. This keeps you deliberate about reviewing every trade, which is where the improvement happens.' },
  { q: 'How are the metrics calculated?', a: 'Every financial metric — P&L, risk, R-multiple, expectancy, drawdown, ROI — comes from one tested calculation engine. When required inputs are missing (e.g. no stop loss), the metric shows N/A rather than a made-up value.' },
  { q: 'Can I try it before signing up?', a: 'Yes — the demo account is preloaded with realistic sample trades so you can explore the dashboard, analytics, risk tools and reports immediately.' },
  { q: 'What can I export?', a: 'Reports export to CSV (Excel-ready) and can be printed or saved as PDF. Full spreadsheet and PDF document exports are on the roadmap.' },
  { q: 'Will there be AI features?', a: 'The architecture is built for it. Today’s insights are transparent and rule-based; an AI review layer can be added later behind the same interface — always grounded in your real data.' },
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-text sm:text-4xl">Frequently asked questions</h1>
      <div className="mt-8 divide-y divide-border rounded-card border border-border bg-surface">
        {FAQS.map((item, i) => (
          <div key={item.q}>
            <button
              type="button"
              onClick={() => setOpen(open === i ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="text-sm font-medium text-text">{item.q}</span>
              <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted transition-transform', open === i && 'rotate-180')} />
            </button>
            {open === i && <p className="px-5 pb-4 text-sm text-muted">{item.a}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
