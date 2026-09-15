import { useMemo, type ReactNode } from 'react';
import { Activity, BookOpen, Percent, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import {
  computeAccountMetrics,
  dailyPnlSeries,
  equitySeries,
  monthlyPnlSeries,
  openPositions,
  rMultipleDistribution,
  timeOfDaySeries,
  winLossDistribution,
} from '@/calculations';
import { computeStrategyPerformance } from '@/calculations';
import {
  DrawdownChart,
  EquityCurveChart,
  PnlBarChart,
  RDistributionChart,
  StrategyBarChart,
  TimeOfDayChart,
  WinLossDonut,
} from '@/components/charts';
import { Card, CardBody, CardHeader, EmptyState, LoadingState, MetricCard } from '@/components/ui';
import { DateFilter } from '@/components/layout/DateFilter';
import { PageHeader } from '@/components/layout/PageHeader';
import { OpenPositions } from '@/components/analytics/OpenPositions';
import { useStrategies } from '@/hooks/useStrategies';
import { usePortfolio } from '@/hooks/usePortfolio';
import { filterTradesByRange } from '@/hooks/useDateFilter';
import { resolvePreset, todayISO } from '@/utils/date';
import {
  formatCompactCurrency,
  formatCompactSignedCurrency,
  formatCurrency,
  formatPercent,
  formatR,
  formatSignedCurrency,
} from '@/utils/format';

export default function Dashboard() {
  const { all, filtered, startingCapital, currency, isLoading } = usePortfolio();
  const strategiesQuery = useStrategies();
  const strategies = useMemo(() => strategiesQuery.data ?? [], [strategiesQuery.data]);

  const allMetrics = useMemo(() => computeAccountMetrics(all, startingCapital), [all, startingCapital]);
  const m = useMemo(() => computeAccountMetrics(filtered, startingCapital), [filtered, startingCapital]);
  const today = useMemo(
    () => computeAccountMetrics(filterTradesByRange(all, resolvePreset('today')), startingCapital),
    [all, startingCapital],
  );

  // Open positions come from `all`, never the date-filtered set: a position
  // opened before the selected window is still on, and still at risk.
  const open = useMemo(() => openPositions(all, todayISO()), [all]);

  const equity = useMemo(() => equitySeries(filtered, startingCapital), [filtered, startingCapital]);
  const daily = useMemo(() => dailyPnlSeries(filtered), [filtered]);
  const monthly = useMemo(() => monthlyPnlSeries(filtered), [filtered]);
  const winLoss = useMemo(() => winLossDistribution(filtered), [filtered]);
  const rDist = useMemo(() => rMultipleDistribution(filtered), [filtered]);
  const tod = useMemo(() => timeOfDaySeries(filtered), [filtered]);
  const stratPerf = useMemo(
    () =>
      computeStrategyPerformance(filtered, strategies, startingCapital)
        .map((s) => ({ name: s.name, netPnl: s.netPnl }))
        .slice(0, 8),
    [filtered, strategies, startingCapital],
  );

  const fc = (n: number | null) => formatCurrency(n, currency);
  // Charts and card values use the reader's own numbering system: lakh/crore
  // for rupees, K/M/B otherwise.
  const fcc = (n: number | null) => formatCompactCurrency(n, currency);

  if (isLoading) return <LoadingState label="Loading your dashboard…" />;

  if (all.length === 0) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle="Your trading performance at a glance." />
        <Card>
          <EmptyState
            icon={BookOpen}
            title="No trades yet"
            message="Record your first trade to start building your performance history."
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Your trading performance at a glance.">
        <DateFilter />
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard
          label="Current Capital"
          value={fcc(allMetrics.endingCapital)}
          title={fc(allMetrics.endingCapital)}
          icon={Wallet}
          sub={`Start ${fcc(startingCapital)}`}
        />
        <MetricCard
          label="Net P&L"
          value={formatCompactSignedCurrency(m.netPnl, currency)}
          title={formatSignedCurrency(m.netPnl, currency)}
          tone={m.netPnl > 0 ? 'profit' : m.netPnl < 0 ? 'loss' : 'neutral'}
          icon={m.netPnl >= 0 ? TrendingUp : TrendingDown}
          sub={`Gross ${fcc(m.grossPnl)}`}
        />
        <MetricCard
          label="Today's P&L"
          value={formatCompactSignedCurrency(today.netPnl, currency)}
          title={formatSignedCurrency(today.netPnl, currency)}
          tone={today.netPnl > 0 ? 'profit' : today.netPnl < 0 ? 'loss' : 'neutral'}
          icon={Activity}
          sub={`${today.closedTrades} trades today`}
        />
        <MetricCard label="ROI" value={formatPercent(m.roi)} tone={(m.roi ?? 0) >= 0 ? 'profit' : 'loss'} icon={Percent} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Win Rate" value={formatPercent(m.winRate)} sub={`${m.winningTrades}W / ${m.losingTrades}L`} />
        <MetricCard label="Average R" value={formatR(m.averageR)} tone={(m.averageR ?? 0) >= 0 ? 'profit' : 'loss'} />
        <MetricCard label="Expectancy" value={fcc(m.expectancy)} title={fc(m.expectancy)} tone={(m.expectancy ?? 0) >= 0 ? 'profit' : 'loss'} hint="Expected value per trade" />
        <MetricCard label="Max Drawdown" value={m.maxDrawdown === 0 ? fcc(0) : `-${fcc(m.maxDrawdown)}`} title={fc(m.maxDrawdown)} tone={m.maxDrawdown > 0 ? 'loss' : 'neutral'} sub={formatPercent(m.maxDrawdownPct)} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <MetricCard label="Total Trades" value={m.totalTrades} sub={`${m.openTrades} open`} />
        <MetricCard
          label="Open Positions"
          value={open.count}
          sub={open.count === 0 ? 'Nothing at risk' : `${fcc(open.totalRiskAtStop)} at stop`}
          tone={open.unprotected > 0 ? 'loss' : 'neutral'}
          hint={
            open.unprotected > 0
              ? `${open.unprotected} of them have no stop loss recorded`
              : undefined
          }
        />
        <MetricCard label="Profit Factor" value={m.profitFactor == null ? 'N/A' : m.profitFactor.toFixed(2)} tone={(m.profitFactor ?? 0) >= 1 ? 'profit' : 'loss'} />
        <MetricCard label="Best Trade" value={fcc(m.bestTrade)} title={fc(m.bestTrade)} tone="profit" />
        <MetricCard label="Worst Trade" value={fcc(m.worstTrade)} title={fc(m.worstTrade)} tone="loss" />
      </div>

      {open.count > 0 && (
        <div className="mt-6">
          <OpenPositions summary={open} currency={currency} />
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Equity Curve" description="Running capital across the selected period" />
          <CardBody>
            <EquityCurveChart data={equity} valueFormatter={fcc} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Win / Loss" description={`${winLoss.wins} wins · ${winLoss.losses} losses`} />
          <CardBody>
            {winLoss.wins + winLoss.losses + winLoss.breakevens > 0 ? (
              <WinLossDonut {...winLoss} />
            ) : (
              <EmptyState title="No closed trades" />
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Daily P&L">
          {daily.length ? <PnlBarChart data={daily.map((d) => ({ label: d.date.slice(5), netPnl: d.netPnl }))} valueFormatter={fcc} /> : <EmptyState title="No data" />}
        </ChartCard>
        <ChartCard title="Monthly P&L">
          {monthly.length ? <PnlBarChart data={monthly.map((mo) => ({ label: mo.label, netPnl: mo.netPnl }))} valueFormatter={fcc} /> : <EmptyState title="No data" />}
        </ChartCard>
        <ChartCard title="R-Multiple Distribution">
          {rDist.length ? <RDistributionChart data={rDist} /> : <EmptyState title="No R data" message="Add stop losses to see R multiples." />}
        </ChartCard>
        <ChartCard title="Strategy Performance">
          {stratPerf.length ? <StrategyBarChart data={stratPerf} valueFormatter={fcc} /> : <EmptyState title="No data" />}
        </ChartCard>
        <ChartCard title="Time-of-Day Performance">
          {tod.length ? <TimeOfDayChart data={tod} valueFormatter={fcc} /> : <EmptyState title="No time data" />}
        </ChartCard>
        <ChartCard title="Drawdown">
          <DrawdownChart data={equity} valueFormatter={fcc} />
        </ChartCard>
      </div>
    </>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} />
      <CardBody>{children}</CardBody>
    </Card>
  );
}
