import { useMemo } from 'react';
import type { SegmentStats } from '@/calculations/analytics';
import { conditionalPerformance, performanceByPsychology, streaks } from '@/calculations';
import { Card, CardBody, CardHeader, LoadingState, MetricCard } from '@/components/ui';
import { DateFilter } from '@/components/layout/DateFilter';
import { PageHeader } from '@/components/layout/PageHeader';
import { TagPerformanceTable } from '@/components/analytics/TagPerformanceTable';
import { FeatureGate } from '@/components/billing/FeatureGate';
import { usePortfolio } from '@/hooks/usePortfolio';
import { formatCurrency, formatPercent, formatR } from '@/utils/format';
import { cn } from '@/utils/cn';

export default function Psychology() {
  const { filtered, currency, isLoading } = usePortfolio();

  const byTag = useMemo(() => performanceByPsychology(filtered), [filtered]);
  const cond = useMemo(() => conditionalPerformance(filtered), [filtered]);
  const streak = useMemo(() => streaks(filtered), [filtered]);

  if (isLoading) return <LoadingState />;

  return (
    <FeatureGate
      feature="psychology_analytics"
      title="Unlock Psychology Analytics"
      description="Upgrade to Pro to see how emotions and behaviour affect your results."
    >
      <PageHeader title="Psychology" subtitle="How your emotions and behaviour shape results.">
        <DateFilter />
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ConditionalCard title="Overall" stats={cond.overall} currency={currency} />
        <ConditionalCard title="After a Win" stats={cond.afterWin} currency={currency} />
        <ConditionalCard title="After a Loss" stats={cond.afterLoss} currency={currency} highlightNegative />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Current Streak" value={streak.currentStreak === 0 ? '—' : `${Math.abs(streak.currentStreak)} ${streak.currentStreak > 0 ? 'W' : 'L'}`} tone={streak.currentStreak > 0 ? 'profit' : streak.currentStreak < 0 ? 'loss' : 'neutral'} />
        <MetricCard label="Longest Win Streak" value={streak.longestWin} tone="profit" />
        <MetricCard label="Longest Loss Streak" value={streak.longestLoss} tone="loss" />
        <MetricCard label="Tagged Emotions" value={byTag.length} />
      </div>

      <Card className="mt-4 overflow-hidden">
        <CardHeader title="Performance by Emotion" description="Net result when each psychology tag was present" />
        <CardBody className="p-0">
          <TagPerformanceTable rows={byTag} currency={currency} labelHeader="Emotion" emptyMessage="Tag your trades with emotions to unlock this analysis." />
        </CardBody>
      </Card>
    </FeatureGate>
  );
}

function ConditionalCard({
  title,
  stats,
  currency,
  highlightNegative = false,
}: {
  title: string;
  stats: SegmentStats;
  currency: string;
  highlightNegative?: boolean;
}) {
  const tone = stats.netPnl > 0 ? 'text-profit' : stats.netPnl < 0 ? 'text-loss' : 'text-text';
  return (
    <Card>
      <CardHeader title={title} description={`${stats.trades} trades`} />
      <CardBody>
        {stats.trades === 0 ? (
          <p className="py-4 text-center text-xs text-muted">Not enough data.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Win Rate" value={formatPercent(stats.winRate)} />
            <Stat label="Avg R" value={formatR(stats.avgR)} className={(stats.avgR ?? 0) >= 0 ? 'text-profit' : 'text-loss'} />
            <Stat label="Net P&L" value={formatCurrency(stats.netPnl, currency, { compact: true })} className={cn(highlightNegative && stats.netPnl < 0 && 'text-loss', tone)} />
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className={cn('mt-0.5 text-base font-semibold tabular text-text', className)}>{value}</p>
    </div>
  );
}
