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
}

export function MetricCard({ label, value, sub, tone = 'neutral', icon: Icon, hint }: MetricCardProps) {
  return (
    <div className="rounded-card border border-border bg-surface p-4" title={hint}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-muted" />}
      </div>
      <div className={cn('mt-2 text-2xl font-semibold tabular', VALUE_TONE[tone])}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}
