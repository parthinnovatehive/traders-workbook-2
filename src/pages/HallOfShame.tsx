import { useMemo, type ReactNode } from 'react';
import { CalendarDays, GraduationCap, TrendingDown } from 'lucide-react';
import type { MistakeCode, Trade } from '@/types';
import { MISTAKE_LABELS } from '@/constants/journal';
import {
  computeStrategyPerformance,
  computeTradeMetrics,
  worstPsychologyTrades,
  worstRuleViolations,
  worstTradesByProfit,
  worstTradesByR,
  worstTradingDay,
} from '@/calculations';
import { Badge, Card, CardBody, CardHeader, EmptyState, LoadingState, MetricCard } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { RankedTrades } from '@/components/analytics/RankedTrades';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useStrategies } from '@/hooks/useStrategies';
import { formatCurrency, formatR } from '@/utils/format';
import { formatDate } from '@/utils/date';

const ADVICE: Partial<Record<MistakeCode, string>> = {
  Revenge: 'Step away after a loss — revenge trades skip your checklist.',
  FOMO: 'Wait for your setup; chasing price rarely offers good risk/reward.',
  NoConfirmation: 'Require your entry trigger before committing risk.',
  MovedSL: 'Honour your original stop — widening it turns small losses into large ones.',
  MovedTarget: 'Let winners reach plan; don’t cut them early out of fear.',
  Overtrading: 'Cap trades per session — quality over quantity.',
  EarlyEntry: 'Be patient for the level to confirm.',
  LateEntry: 'Skip the trade if price already ran — the risk is now poor.',
  Oversizing: 'Size to your risk rule, not your conviction.',
  RuleViolation: 'A rule you set is a rule you keep — review why it broke.',
};

export default function HallOfShame() {
  const { all, startingCapital, currency, isLoading } = usePortfolio();
  const strategiesQuery = useStrategies();
  const strategies = useMemo(() => strategiesQuery.data ?? [], [strategiesQuery.data]);

  const worstProfit = useMemo(() => worstTradesByProfit(all, 5).filter((r) => r.netPnl < 0), [all]);
  const worstR = useMemo(() => worstTradesByR(all, 5).filter((r) => (r.rMultiple ?? 0) < 0), [all]);
  const worstPsych = useMemo(() => worstPsychologyTrades(all, 5), [all]);
  const worstRules = useMemo(() => worstRuleViolations(all, 5), [all]);
  const worstDay = useMemo(() => worstTradingDay(all), [all]);
  const worstStrategy = useMemo(() => {
    const perf = computeStrategyPerformance(all, strategies, startingCapital);
    return perf.reduce<(typeof perf)[number] | null>((min, p) => (!min || p.netPnl < min.netPnl ? p : min), null);
  }, [all, strategies, startingCapital]);

  if (isLoading) return <LoadingState />;

  return (
    <>
      <PageHeader title="Hall of Shame" subtitle="Learn from your worst trades — no judgement, just lessons." />

      <div className="mb-4 flex items-start gap-3 rounded-lg border border-border bg-surface-2 p-4 text-sm">
        <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-muted">
          This section is for improvement, not self-criticism. Each mistake below is paired with what a better
          execution would have looked like.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Biggest Loss" value={worstProfit[0] ? formatCurrency(worstProfit[0].netPnl, currency, { compact: true }) : '—'} tone="loss" icon={TrendingDown} sub={worstProfit[0]?.trade.symbol} />
        <MetricCard label="Worst Day" value={worstDay && worstDay.netPnl < 0 ? formatCurrency(worstDay.netPnl, currency, { compact: true }) : '—'} tone="loss" icon={CalendarDays} sub={worstDay ? formatDate(worstDay.date, 'MMM D') : undefined} />
        <MetricCard label="Worst Strategy" value={worstStrategy && worstStrategy.netPnl < 0 ? worstStrategy.name : '—'} tone="loss" sub={worstStrategy && worstStrategy.netPnl < 0 ? formatCurrency(worstStrategy.netPnl, currency) : undefined} />
        <MetricCard label="Rule Violations" value={worstRules.length} tone={worstRules.length > 0 ? 'loss' : 'neutral'} />
      </div>

      {worstProfit[0] && <WorstTradeBreakdown trade={worstProfit[0].trade} startingCapital={startingCapital} currency={currency} />}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Top 5 Losses" />
          <CardBody className="py-2">
            <RankedTrades rows={worstProfit} metric="netPnl" currency={currency} positive={false} emptyMessage="No losing trades in your history — nice." />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Worst 5 by R" />
          <CardBody className="py-2">
            <RankedTrades rows={worstR} metric="rMultiple" currency={currency} positive={false} emptyMessage="No negative-R trades to show." />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Worst Psychology Trades" description="Losses where a negative emotion was tagged" />
          <CardBody className="py-2">
            <RankedTrades rows={worstPsych} metric="netPnl" currency={currency} positive={false} emptyMessage="No emotion-tagged losses — good discipline." />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Worst Rule Violations" />
          <CardBody className="py-2">
            <RankedTrades rows={worstRules} metric="netPnl" currency={currency} positive={false} emptyMessage="No rule violations recorded." />
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function WorstTradeBreakdown({ trade, startingCapital, currency }: { trade: Trade; startingCapital: number; currency: string }) {
  const m = computeTradeMetrics(trade, { startingCapital });
  const lessons = trade.mistakes.map((code) => ADVICE[code]).filter(Boolean) as string[];

  return (
    <Card className="mt-4">
      <CardHeader title="Case Study — Your Biggest Loss" description={`${trade.symbol} · ${formatDate(trade.exitDate ?? trade.entryDate, 'MMM D, YYYY')}`} />
      <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-3 text-sm">
          <Row label="What happened" value={`${trade.direction} ${trade.symbol} closed at ${formatCurrency(m.netPnl ?? 0, currency)} (${formatR(m.rMultiple)}).`} />
          <Row
            label="Mistakes tagged"
            value={
              trade.mistakes.length ? (
                <span className="flex flex-wrap gap-1">
                  {trade.mistakes.map((code) => (
                    <Badge key={code} tone="loss">
                      {MISTAKE_LABELS[code]}
                    </Badge>
                  ))}
                </span>
              ) : (
                'None tagged — consider what went wrong.'
              )
            }
          />
          {trade.notes && <Row label="Your notes" value={trade.notes} />}
        </div>
        <div className="rounded-lg border border-border bg-surface-2 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">What better looked like</p>
          {lessons.length ? (
            <ul className="space-y-2 text-sm text-text">
              {lessons.map((l) => (
                <li key={l} className="flex gap-2">
                  <span className="text-primary">→</span>
                  {l}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No specific lesson" message="Tag the mistakes on this trade to get tailored guidance." />
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-1 text-text">{value}</div>
    </div>
  );
}
