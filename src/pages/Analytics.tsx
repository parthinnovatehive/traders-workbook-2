import { useMemo } from 'react';
import {
  computeStrategyPerformance,
  generateInsights,
  performanceByMistake,
  rMultipleDistribution,
  timeOfDaySeries,
} from '@/calculations';
import { RDistributionChart, StrategyBarChart, TimeOfDayChart } from '@/components/charts';
import { Card, CardBody, CardHeader, EmptyState, LoadingState } from '@/components/ui';
import { DateFilter } from '@/components/layout/DateFilter';
import { PageHeader } from '@/components/layout/PageHeader';
import { InsightList } from '@/components/analytics/InsightList';
import { TagPerformanceTable } from '@/components/analytics/TagPerformanceTable';
import { FeatureGate } from '@/components/billing/FeatureGate';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useStrategies } from '@/hooks/useStrategies';
import { formatCurrency } from '@/utils/format';

export default function Analytics() {
  const { filtered, startingCapital, currency, isLoading } = usePortfolio();
  const strategiesQuery = useStrategies();
  const strategies = useMemo(() => strategiesQuery.data ?? [], [strategiesQuery.data]);

  const insights = useMemo(
    () => generateInsights(filtered, { strategies, startingCapital }),
    [filtered, strategies, startingCapital],
  );
  const tod = useMemo(() => timeOfDaySeries(filtered), [filtered]);
  const rDist = useMemo(() => rMultipleDistribution(filtered), [filtered]);
  const mistakes = useMemo(() => performanceByMistake(filtered), [filtered]);
  const stratPerf = useMemo(
    () => computeStrategyPerformance(filtered, strategies, startingCapital).map((s) => ({ name: s.name, netPnl: s.netPnl })),
    [filtered, strategies, startingCapital],
  );

  const fcc = (n: number) => formatCurrency(n, currency, { compact: true });

  if (isLoading) return <LoadingState />;

  return (
    <FeatureGate
      feature="advanced_analytics"
      title="Unlock Advanced Trading Analytics"
      description="Upgrade to Pro to access performance intelligence, strategy comparison and time-of-day analytics."
    >
      <PageHeader title="Analytics" subtitle="Performance intelligence from your own trade data.">
        <DateFilter />
      </PageHeader>

      <Card className="mb-4">
        <CardHeader title="Performance Intelligence" description="Rule-based insights — generated only from your stored trades" />
        <CardBody>
          <InsightList insights={insights} />
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Time-of-Day Performance" />
          <CardBody>{tod.length ? <TimeOfDayChart data={tod} valueFormatter={fcc} /> : <EmptyState title="No time data" />}</CardBody>
        </Card>
        <Card>
          <CardHeader title="R-Multiple Distribution" />
          <CardBody>{rDist.length ? <RDistributionChart data={rDist} /> : <EmptyState title="No R data" message="Add stop losses to compute R." />}</CardBody>
        </Card>
        <Card>
          <CardHeader title="Strategy Comparison" description="Net P&L by strategy" />
          <CardBody>{stratPerf.length ? <StrategyBarChart data={stratPerf} valueFormatter={fcc} /> : <EmptyState title="No data" />}</CardBody>
        </Card>
        <Card>
          <CardHeader title="Mistake Analytics" description="Cost of each execution error" />
          <CardBody className="p-0">
            <TagPerformanceTable rows={mistakes} currency={currency} labelHeader="Mistake" emptyMessage="No mistakes tagged — or not enough data." />
          </CardBody>
        </Card>
      </div>
    </FeatureGate>
  );
}
