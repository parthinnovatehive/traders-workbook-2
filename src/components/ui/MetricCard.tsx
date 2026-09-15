import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

type Tone = 'neutral' | 'profit' | 'loss';

const VALUE_TONE: Record<Tone, string> = {
  neutral: 'text-text',
  profit: 'text-profit',
  loss: 'text-loss',
};

export interface MetricCardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  icon?: LucideIcon;
  hint?: string;
  /** Exact figure, shown on hover when `value` has been shortened. */
  title?: string;
}

export function MetricCard({
  label,
  value,
  sub,
  tone = 'neutral',
  icon: Icon,
  hint,
  title,
}: MetricCardProps) {
  return (
    <div className="rounded-card border border-border bg-surface p-4" title={hint}>
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs font-medium uppercase tracking-wide text-muted">
          {label}
        </span>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-muted" />}
      </div>
      {/* min-w-0 + truncate stop a long figure from pushing out of the card;
          the untruncated value stays available via the title attribute. */}
      <div
        className={cn('mt-2 min-w-0 truncate text-2xl font-semibold tabular', VALUE_TONE[tone])}
        title={title}
      >
        {value}
      </div>
      {sub && <div className="mt-1 min-w-0 truncate text-xs text-muted">{sub}</div>}
    </div>
  );
}
