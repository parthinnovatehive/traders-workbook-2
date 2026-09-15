import type { RankedTrade } from '@/calculations/rankings';
import { EmptyState } from '@/components/ui';
import { formatCurrency, formatR } from '@/utils/format';
import { formatDate } from '@/utils/date';
import { cn } from '@/utils/cn';

type Metric = 'netPnl' | 'rMultiple' | 'riskReward';

interface Props {
  rows: RankedTrade[];
  metric: Metric;
  currency: string;
  positive?: boolean;
  emptyMessage?: string;
}

function metricValue(row: RankedTrade, metric: Metric, currency: string): string {
  if (metric === 'netPnl') return formatCurrency(row.netPnl, currency);
  if (metric === 'rMultiple') return formatR(row.rMultiple);
  return row.riskReward == null ? 'N/A' : `${row.riskReward.toFixed(2)} R:R`;
}

export function RankedTrades({ rows, metric, currency, positive = true, emptyMessage }: Props) {
  if (rows.length === 0) {
    return <EmptyState title="Not enough data" message={emptyMessage ?? 'No qualifying trades yet.'} />;
  }
  return (
    <ol className="divide-y divide-border w-full">
      {rows.map((row, i) => (
        <li key={row.trade.id} className="flex items-center gap-3 px-1 py-2.5">
          <span
            className={cn(
              'grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold',
              i === 0 ? 'bg-warning/20 text-warning' : 'bg-surface-2 text-muted',
            )}
          >
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-text">{row.trade.symbol}</p>
            <p className="text-xs text-muted">
              {formatDate(row.trade.exitDate ?? row.trade.entryDate, 'MMM D, YYYY')} · {row.trade.direction}
            </p>
          </div>
          <span className={cn('text-sm font-semibold tabular', positive ? 'text-profit' : 'text-loss')}>
            {metricValue(row, metric, currency)}
          </span>
        </li>
      ))}
    </ol>
  );
}
