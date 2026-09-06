import type { TagPerformance } from '@/calculations/analytics';
import { EmptyState } from '@/components/ui';
import { formatCurrency, formatPercent, formatR } from '@/utils/format';
import { cn } from '@/utils/cn';

interface Props {
  rows: TagPerformance[];
  currency: string;
  labelHeader?: string;
  emptyMessage?: string;
}

export function TagPerformanceTable({ rows, currency, labelHeader = 'Tag', emptyMessage }: Props) {
  if (rows.length === 0) {
    return <EmptyState title="Not enough data" message={emptyMessage ?? 'No tagged trades in this period.'} />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th className="px-3 py-2 font-medium">{labelHeader}</th>
            <th className="px-3 py-2 text-right font-medium">Trades</th>
            <th className="px-3 py-2 text-right font-medium">Net P&L</th>
            <th className="px-3 py-2 text-right font-medium">Win Rate</th>
            <th className="px-3 py-2 text-right font-medium">Avg R</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code} className="border-b border-border/60 last:border-0">
              <td className="px-3 py-2 font-medium text-text">{r.label}</td>
              <td className="px-3 py-2 text-right tabular text-muted">{r.trades}</td>
              <td className={cn('px-3 py-2 text-right tabular font-medium', r.netPnl > 0 ? 'text-profit' : r.netPnl < 0 ? 'text-loss' : 'text-text')}>
                {formatCurrency(r.netPnl, currency)}
              </td>
              <td className="px-3 py-2 text-right tabular text-text">{formatPercent(r.winRate)}</td>
              <td className={cn('px-3 py-2 text-right tabular', (r.avgR ?? 0) >= 0 ? 'text-profit' : 'text-loss')}>
                {formatR(r.avgR)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
