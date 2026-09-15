import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useSiteContent } from '@/hooks/useContent';
import { cn } from '@/utils/cn';

export default function Faq() {
  // Entries are admin-editable (Admin → Content) and fall back to the bundled
  // defaults, so answering a new common question no longer needs a deploy.
  const { data } = useSiteContent();
  const faqs = data?.faqs ?? [];
  const [open, setOpen] = useState<string | null>(faqs[0]?.id ?? null);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-text sm:text-4xl">Frequently asked questions</h1>
      <div className="mt-8 divide-y divide-border rounded-card border border-border bg-surface">
        {faqs.map((item) => (
          <div key={item.id}>
            <button
              type="button"
              onClick={() => setOpen(open === item.id ? null : item.id)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="text-sm font-medium text-text">{item.question}</span>
              <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted transition-transform', open === item.id && 'rotate-180')} />
            </button>
            {open === item.id && <p className="px-5 pb-4 text-sm text-muted">{item.answer}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
