import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { ChevronLeft, ChevronRight, Download, Printer } from 'lucide-react';
import type { DateRange } from '@/utils/date';
import {
  computeAccountMetrics,
  performanceByMistake,
  performanceByPsychology,
  topTradesByProfit,
  worstTradesByProfit,
} from '@/calculations';
import { Button, Card, CardBody, CardHeader, EmptyState, LoadingState, MetricCard, Tabs } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { RankedTrades } from '@/components/analytics/RankedTrades';
import { TagPerformanceTable } from '@/components/analytics/TagPerformanceTable';
import { FeatureGate } from '@/components/billing/FeatureGate';
import { usePortfolio } from '@/hooks/usePortfolio';
import { filterTradesByRange } from '@/hooks/useDateFilter';
import { formatCompactCurrency, formatCurrency, formatPercent, formatR } from '@/utils/format';
import { downloadText, tradesToCsv } from '@/utils/export';
import { toast } from '@/store/toastStore';

type Period = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

const PERIOD_TABS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

const ISO = 'YYYY-MM-DD';

/**
 * Resolve a reporting period.
 *
 * `offset` counts periods back from today: 0 is the current one, -1 the
 * previous. Without it the page could only ever render the period in progress,
 * so "last month's report" — the single most common thing anyone wants from a
 * reports page — was unreachable.
 */
function periodRange(period: Period, offset: number): { range: DateRange; label: string } {
  const now = dayjs();
  switch (period) {
    case 'daily': {
      const d = now.add(offset, 'day');
      return {
        range: { start: d.format(ISO), end: d.format(ISO) },
        label: d.format('MMMM D, YYYY'),
      };
    }
    case 'weekly': {
      const w = now.add(offset, 'week');
      return {
        range: { start: w.startOf('week').format(ISO), end: w.endOf('week').format(ISO) },
        label: `Week of ${w.startOf('week').format('MMM D, YYYY')}`,
      };
    }
    case 'monthly': {
      const m = now.add(offset, 'month');
      return {
        range: { start: m.startOf('month').format(ISO), end: m.endOf('month').format(ISO) },
        label: m.format('MMMM YYYY'),
      };
    }
    case 'quarterly': {
      // Step whole quarters, then snap to that quarter's own boundaries.
      const base = now.add(offset * 3, 'month');
      const q = Math.floor(base.month() / 3);
      const start = base.month(q * 3).startOf('month');
      const end = base.month(q * 3 + 2).endOf('month');
      return {
        range: { start: start.format(ISO), end: end.format(ISO) },
        label: `Q${q + 1} ${base.format('YYYY')}`,
      };
    }
    case 'yearly':
    default: {
      const y = now.add(offset, 'year');
      return {
        range: { start: y.startOf('year').format(ISO), end: y.endOf('year').format(ISO) },
        label: y.format('YYYY'),
      };
    }
  }
}

export default function Reports() {
  const { all, startingCapital, currency, isLoading } = usePortfolio();
  const [period, setPeriod] = useState<Period>('monthly');
  const [offset, setOffset] = useState(0);

  const { range, label } = useMemo(() => periodRange(period, offset), [period, offset]);
  const trades = useMemo(() => filterTradesByRange(all, range), [all, range]);
  const m = useMemo(() => computeAccountMetrics(trades, startingCapital), [trades, startingCapital]);
  const best = useMemo(() => topTradesByProfit(trades, 3), [trades]);
  const worst = useMemo(() => worstTradesByProfit(trades, 3).filter((r) => r.netPnl < 0), [trades]);
  const mistakes = useMemo(() => performanceByMistake(trades), [trades]);
  const psych = useMemo(() => performanceByPsychology(trades), [trades]);

  const exportCsv = () => {
    if (trades.length === 0) {
      toast.error('No trades in this period to export.');
      return;
    }
    downloadText(`traders-workbook-${period}-${label.replace(/\s+/g, '-')}.csv`, tradesToCsv(trades, startingCapital));
    toast.success('CSV exported.');
  };

  if (isLoading) return <LoadingState />;

  return (
    <FeatureGate
      feature="reports"
      title="Unlock Reports & Export"
      description="Upgrade to Pro to generate daily–yearly reports and export to CSV / PDF."
    >
      <PageHeader
        title="Reports"
        subtitle={`${label} · ${trades.length} trades`}
        actions={
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4" /> CSV / Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print / PDF
            </Button>
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <Tabs
            items={PERIOD_TABS}
            value={period}
            onChange={(v) => {
              setPeriod(v as Period);
              // A "3 months ago" quarter and a "3 days ago" day are different
              // places; jump back to the current period on a unit change.
              setOffset(0);
            }}
          />
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Previous period"
              onClick={() => setOffset((o) => o - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Next period"
              disabled={offset >= 0}
              onClick={() => setOffset((o) => Math.min(0, o + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {offset !== 0 && (
              <Button variant="ghost" size="sm" onClick={() => setOffset(0)}>
                Today
              </Button>
            )}
          </div>
        </div>
      </PageHeader>

      {trades.length === 0 ? (
        <Card>
          <EmptyState title="No trades in this period" message="Choose a different period or record trades to generate a report." />
        </Card>
      ) : (
        <>
          {/* Compact figures (K/M or L/Cr by currency) so a large P&L cannot
              overflow its card; the exact value stays in the hover title. */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <MetricCard
              label="Net P&L"
              value={formatCompactCurrency(m.netPnl, currency)}
              title={formatCurrency(m.netPnl, currency)}
              tone={m.netPnl >= 0 ? 'profit' : 'loss'}
            />
            <MetricCard label="Win Rate" value={formatPercent(m.winRate)} />
            <MetricCard label="Avg R" value={formatR(m.averageR)} tone={(m.averageR ?? 0) >= 0 ? 'profit' : 'loss'} />
            <MetricCard
              label="Expectancy"
              value={formatCompactCurrency(m.expectancy, currency)}
              title={formatCurrency(m.expectancy, currency)}
            />
            <MetricCard
              label="Max DD"
              value={m.maxDrawdown === 0 ? '—' : `-${formatCompactCurrency(m.maxDrawdown, currency)}`}
              title={m.maxDrawdown === 0 ? undefined : formatCurrency(m.maxDrawdown, currency)}
              tone={m.maxDrawdown > 0 ? 'loss' : 'neutral'}
            />
            <MetricCard label="ROI" value={formatPercent(m.roi)} tone={(m.roi ?? 0) >= 0 ? 'profit' : 'loss'} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Best Trades" />
              <CardBody className="py-2">
                <RankedTrades rows={best} metric="netPnl" currency={currency} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Worst Trades" />
              <CardBody className="py-2">
                <RankedTrades rows={worst} metric="netPnl" currency={currency} positive={false} emptyMessage="No losing trades this period." />
              </CardBody>
            </Card>
            <Card className="overflow-hidden">
              <CardHeader title="Mistakes" />
              <CardBody className="p-0">
                <TagPerformanceTable rows={mistakes} currency={currency} labelHeader="Mistake" />
              </CardBody>
            </Card>
            <Card className="overflow-hidden">
              <CardHeader title="Psychology" />
              <CardBody className="p-0">
                <TagPerformanceTable rows={psych} currency={currency} labelHeader="Emotion" />
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </FeatureGate>
  );
}
