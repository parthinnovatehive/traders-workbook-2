import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Download, Printer } from 'lucide-react';
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
import { formatCurrency, formatPercent, formatR } from '@/utils/format';
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

function periodRange(period: Period): { range: DateRange; label: string } {
  const now = dayjs();
  switch (period) {
    case 'daily':
      return { range: { start: now.format('YYYY-MM-DD'), end: now.format('YYYY-MM-DD') }, label: now.format('MMMM D, YYYY') };
    case 'weekly':
      return { range: { start: now.startOf('week').format('YYYY-MM-DD'), end: now.endOf('week').format('YYYY-MM-DD') }, label: `Week of ${now.startOf('week').format('MMM D')}` };
    case 'monthly':
      return { range: { start: now.startOf('month').format('YYYY-MM-DD'), end: now.endOf('month').format('YYYY-MM-DD') }, label: now.format('MMMM YYYY') };
    case 'quarterly': {
      const q = Math.floor(now.month() / 3);
      const start = now.month(q * 3).startOf('month');
      const end = now.month(q * 3 + 2).endOf('month');
      return { range: { start: start.format('YYYY-MM-DD'), end: end.format('YYYY-MM-DD') }, label: `Q${q + 1} ${now.format('YYYY')}` };
    }
    case 'yearly':
    default:
      return { range: { start: now.startOf('year').format('YYYY-MM-DD'), end: now.endOf('year').format('YYYY-MM-DD') }, label: now.format('YYYY') };
  }
}

export default function Reports() {
  const { all, startingCapital, currency, isLoading } = usePortfolio();
  const [period, setPeriod] = useState<Period>('monthly');

  const { range, label } = useMemo(() => periodRange(period), [period]);
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
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4" /> CSV / Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print / PDF
            </Button>
          </div>
        }
      >
        <Tabs items={PERIOD_TABS} value={period} onChange={(v) => setPeriod(v as Period)} />
      </PageHeader>

      {trades.length === 0 ? (
        <Card>
          <EmptyState title="No trades in this period" message="Choose a different period or record trades to generate a report." />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <MetricCard label="Net P&L" value={formatCurrency(m.netPnl, currency)} tone={m.netPnl >= 0 ? 'profit' : 'loss'} />
            <MetricCard label="Win Rate" value={formatPercent(m.winRate)} />
            <MetricCard label="Avg R" value={formatR(m.averageR)} tone={(m.averageR ?? 0) >= 0 ? 'profit' : 'loss'} />
            <MetricCard label="Expectancy" value={m.expectancy == null ? 'N/A' : formatCurrency(m.expectancy, currency)} />
            <MetricCard label="Max DD" value={m.maxDrawdown === 0 ? '—' : `-${formatCurrency(m.maxDrawdown, currency, { compact: true })}`} tone={m.maxDrawdown > 0 ? 'loss' : 'neutral'} />
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
