import type { OpenPositionSummary } from '@/calculations';
import { Badge, Card, CardBody, CardHeader, EmptyState } from '@/components/ui';
import { formatCurrency, formatR } from '@/utils/format';
import { formatDate } from '@/utils/date';
import { cn } from '@/utils/cn';

/**
 * The trades still on. No unrealized P&L column: the journal has no price feed,
 * and a made-up number here would be the one figure on the dashboard that isn't
 * derived from what the trader actually recorded.
 */
export function OpenPositions({
  summary,
  currency,
}: {
  summary: OpenPositionSummary;
  currency: string;
}) {
  const { positions, count, totalExposure, totalRiskAtStop, unprotected } = summary;

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Open Positions"
        description={
          count === 0
            ? 'Nothing currently at risk'
            : `${count} open · ${formatCurrency(totalExposure, currency, { compact: true })} committed · ${formatCurrency(totalRiskAtStop, currency, { compact: true })} at stop`
        }
        action={
          unprotected > 0 ? (
            <Badge tone="warning">
              {unprotected} without a stop
            </Badge>
          ) : undefined
        }
      />
      {count === 0 ? (
        <CardBody>
          <EmptyState
            title="No open positions"
            message="Trades without an exit price appear here until you close them."
          />
        </CardBody>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-2.5 font-medium">Symbol</th>
                <th className="px-3 py-2.5 font-medium">Dir</th>
                <th className="px-3 py-2.5 text-right font-medium">Entry</th>
                <th className="px-3 py-2.5 text-right font-medium">Size</th>
                <th className="px-3 py-2.5 text-right font-medium">Exposure</th>
                <th className="px-3 py-2.5 text-right font-medium">Risk at stop</th>
                <th className="px-3 py-2.5 text-right font-medium">R:R</th>
                <th className="px-3 py-2.5 text-right font-medium">Held</th>
              </tr>
            </thead>
            <tbody>
              {positions.map(({ trade, positionSize, exposure, riskAtStop, plannedRr, daysOpen }) => (
                <tr key={trade.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/50">
                  <td className="px-4 py-2.5 font-medium text-text">
                    {trade.symbol}
                    <span className="ml-2 text-xs text-muted">
                      {formatDate(trade.entryDate, 'MMM D')}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={trade.direction === 'long' ? 'profit' : 'loss'}>
                      {trade.direction}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular text-text">{trade.entryPrice}</td>
                  <td className="px-3 py-2.5 text-right tabular text-muted">
                    {positionSize.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular text-text">
                    {formatCurrency(exposure, currency, { compact: true })}
                  </td>
                  <td
                    className={cn(
                      'px-3 py-2.5 text-right tabular',
                      riskAtStop === null ? 'text-warning' : 'text-loss',
                    )}
                  >
                    {riskAtStop === null
                      ? 'No stop'
                      : `-${formatCurrency(riskAtStop, currency, { compact: true })}`}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular text-muted">
                    {plannedRr === null ? 'N/A' : formatR(plannedRr).replace('R', '')}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular text-muted">
                    {daysOpen === 0 ? 'Today' : `${daysOpen}d`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
