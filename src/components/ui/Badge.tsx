import type { HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

type Tone = 'neutral' | 'profit' | 'loss' | 'primary' | 'warning' | 'info';

const TONES: Record<Tone, string> = {
  neutral: 'border-border bg-surface-2 text-muted',
  profit: 'border-profit/30 bg-profit/10 text-profit',
  loss: 'border-loss/30 bg-loss/10 text-loss',
  primary: 'border-primary/30 bg-primary/10 text-primary',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  info: 'border-info/30 bg-info/10 text-info',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
