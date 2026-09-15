import { useMemo } from 'react';
import { Activity, BookOpen, MessageSquare, ShieldOff, TrendingUp, UserPlus, Users } from 'lucide-react';
import { Card, CardBody, CardHeader, EmptyState, LoadingState, MetricCard } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { PnlBarChart } from '@/components/charts';
import { useAdminOverview, useAdminSignups } from '@/hooks/useAdmin';
import { usePlans } from '@/hooks/usePlans';
import { useAdminSubscriptions } from '@/hooks/useAdmin';
import { formatNumber } from '@/utils/format';
import { formatDate } from '@/utils/date';

export default function AdminOverview() {
  const overview = useAdminOverview();
  const signups = useAdminSignups(30);
  const plans = usePlans();
  const subs = useAdminSubscriptions();

  const signupSeries = useMemo(
    () =>
      (signups.data ?? []).map((p) => ({
        label: formatDate(p.day, 'MMM D'),
        netPnl: p.signups, // the bar chart is value-agnostic
      })),
    [signups.data],
  );

  const planMix = useMemo(() => {
    const byPlan = new Map<string, number>();
    for (const s of subs.data ?? []) {
      byPlan.set(s.planId, (byPlan.get(s.planId) ?? 0) + 1);
    }
    return (plans.data ?? [])
      .map((p) => ({ plan: p, count: byPlan.get(p.id) ?? 0 }))
      .toSorted((a, b) => b.count - a.count);
  }, [plans.data, subs.data]);

  if (overview.isLoading) return <LoadingState label="Loading platform statistics…" />;

  const s = overview.data;
  const totalSubs = planMix.reduce((a, p) => a + p.count, 0);

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Platform health. Individual trade data is never shown here."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Total Users" value={formatNumber(s?.totalUsers, 0)} icon={Users} sub={`${s?.adminUsers ?? 0} admins`} />
        <MetricCard label="New (7 days)" value={formatNumber(s?.newUsers7d, 0)} icon={UserPlus} sub={`${s?.newUsers30d ?? 0} in 30 days`} />
        <MetricCard label="Active (7 days)" value={formatNumber(s?.activeUsers7d, 0)} icon={Activity} hint="Signed in within the last week" />
        <MetricCard
          label="Suspended"
          value={formatNumber(s?.suspendedUsers, 0)}
          icon={ShieldOff}
          tone={(s?.suspendedUsers ?? 0) > 0 ? 'loss' : 'neutral'}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Paid Plans" value={formatNumber(s?.paidSubscriptions, 0)} icon={TrendingUp} tone="profit" hint="Active or trialing on a non-free plan" />
        <MetricCard label="Free Plan" value={formatNumber(s?.freeSubscriptions, 0)} />
        <MetricCard
          label="Trades Recorded"
          value={formatNumber(s?.totalTrades, 0)}
          icon={BookOpen}
          sub={`${s?.tradesLast7d ?? 0} this week`}
          hint="Count only — trade contents are private to each user"
        />
        <MetricCard
          label="Feedback Waiting"
          value={formatNumber(s?.openFeedback, 0)}
          icon={MessageSquare}
          tone={(s?.openFeedback ?? 0) > 0 ? 'loss' : 'neutral'}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Signups" description="New accounts per day, last 30 days" />
          <CardBody>
            {signupSeries.length > 0 ? (
              <PnlBarChart data={signupSeries} valueFormatter={(v) => formatNumber(v, 0)} />
            ) : (
              <EmptyState title="No signups yet" />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Plan Mix" description={`${totalSubs} subscriptions`} />
          <CardBody className="space-y-3">
            {planMix.length === 0 ? (
              <EmptyState title="No plans configured" />
            ) : (
              planMix.map(({ plan, count }) => {
                const pct = totalSubs > 0 ? (count / totalSubs) * 100 : 0;
                return (
                  <div key={plan.id}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-text">{plan.name}</span>
                      <span className="text-muted">
                        {count} · {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardBody>
          <p className="text-xs text-muted">
            Admins manage accounts, plans and content. They cannot read any user&apos;s trades,
            positions or P&amp;L — the database has no policy granting that access, and these
            figures come from functions that return counts only.
          </p>
        </CardBody>
      </Card>
    </>
  );
}
