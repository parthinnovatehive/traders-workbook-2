import { useMemo } from 'react';
import { Award, CalendarDays, Crown, Trophy } from 'lucide-react';
import {
  bestTradingDay,
  bestTradingMonth,
  computeStrategyPerformance,
  topTradesByProfit,
  topTradesByR,
  topTradesByRR,
} from '@/calculations';
import { Card, CardBody, CardHeader, LoadingState, MetricCard } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { RankedTrades } from '@/components/analytics/RankedTrades';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useStrategies } from '@/hooks/useStrategies';
import { formatCurrency } from '@/utils/format';
import { formatDate } from '@/utils/date';

export default function HallOfFame() {
  const { all, startingCapital, currency, isLoading } = usePortfolio();
  const strategiesQuery = useStrategies();
  const strategies = useMemo(() => strategiesQuery.data ?? [], [strategiesQuery.data]);

  const topProfit = useMemo(() => topTradesByProfit(all, 5), [all]);
  const topR = useMemo(() => topTradesByR(all, 5), [all]);
  const topRR = useMemo(() => topTradesByRR(all, 5), [all]);
  const bestDay = useMemo(() => bestTradingDay(all), [all]);
  const bestMonth = useMemo(() => bestTradingMonth(all), [all]);
  const bestStrategy = useMemo(() => {
    const perf = computeStrategyPerformance(all, strategies, startingCapital).filter((s) => s.netPnl > 0);
    return perf.length ? perf[0] : null;
  }, [all, strategies, startingCapital]);

  if (isLoading) return <LoadingState />;

  return (
    <>
      <PageHeader title="Hall of Fame" subtitle="Your best executions — celebrate what's working." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Best Strategy" value={bestStrategy?.name ?? '—'} icon={Crown} tone="profit" sub={bestStrategy ? formatCurrency(bestStrategy.netPnl, currency) : undefined} />
        <MetricCard label="Best Day" value={bestDay ? formatCurrency(bestDay.netPnl, currency, { compact: true }) : '—'} icon={CalendarDays} tone="profit" sub={bestDay ? formatDate(bestDay.date, 'MMM D, YYYY') : undefined} />
        <MetricCard label="Best Month" value={bestMonth ? formatCurrency(bestMonth.netPnl, currency, { compact: true }) : '—'} icon={CalendarDays} tone="profit" sub={bestMonth?.label} />
        <MetricCard label="Top Trade" value={topProfit[0] ? formatCurrency(topProfit[0].netPnl, currency, { compact: true }) : '—'} icon={Trophy} tone="profit" sub={topProfit[0]?.trade.symbol} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Top 5 by Profit" action={<Trophy className="h-4 w-4 text-warning" />} />
          <CardBody className="py-2">
            <RankedTrades rows={topProfit} metric="netPnl" currency={currency} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Top 5 by R Multiple" action={<Award className="h-4 w-4 text-warning" />} />
          <CardBody className="py-2">
            <RankedTrades rows={topR} metric="rMultiple" currency={currency} emptyMessage="Add stop losses to rank by R." />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Top 5 by Risk/Reward" action={<Award className="h-4 w-4 text-warning" />} />
          <CardBody className="py-2">
            <RankedTrades rows={topRR} metric="riskReward" currency={currency} emptyMessage="Add stops and targets to rank by R:R." />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
