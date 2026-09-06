import { Lightbulb, TrendingDown, TrendingUp } from 'lucide-react';
import type { Insight } from '@/calculations/insights';
import { Badge } from '@/components/ui';
import { cn } from '@/utils/cn';

const CONF_LABEL = { low: 'Low confidence', medium: 'Medium confidence', high: 'High confidence' } as const;

export function InsightList({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
        Not enough trading data to generate reliable insights yet. Keep journaling — insights appear once
        there is a meaningful sample.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {insights.map((it) => {
        const Icon = it.tone === 'positive' ? TrendingUp : it.tone === 'negative' ? TrendingDown : Lightbulb;
        return (
          <div key={it.id} className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg',
                  it.tone === 'positive' ? 'bg-profit/10 text-profit' : it.tone === 'negative' ? 'bg-loss/10 text-loss' : 'bg-primary/10 text-primary',
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text">{it.title}</p>
                <p className="mt-1 text-xs text-muted">{it.detail}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge tone="neutral">{it.sampleSize} trades</Badge>
                  <Badge tone={it.confidence === 'high' ? 'profit' : it.confidence === 'medium' ? 'primary' : 'neutral'}>
                    {CONF_LABEL[it.confidence]}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
