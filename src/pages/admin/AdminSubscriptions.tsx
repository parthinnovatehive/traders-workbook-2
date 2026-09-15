import { useMemo } from 'react';
import dayjs from 'dayjs';
import { Badge, Card, CardBody, CardHeader, EmptyState, LoadingState, MetricCard } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAdminSubscriptions, useAdminUsers } from '@/hooks/useAdmin';
import { usePlans } from '@/hooks/usePlans';
import { formatCurrency } from '@/utils/format';
import { formatDate } from '@/utils/date';

const STATUS_TONE: Record<string, 'profit' | 'warning' | 'loss' | 'neutral'> = {
  active: 'profit',
  trialing: 'warning',
  past_due: 'loss',
  expired: 'loss',
  canceled: 'neutral',
  free: 'neutral',
};

export default function AdminSubscriptions() {
  const subs = useAdminSubscriptions();
  const users = useAdminUsers();
  const plans = usePlans();

  const planById = useMemo(
    () => new Map((plans.data ?? []).map((p) => [p.id, p])),
    [plans.data],
  );
  const userById = useMemo(
    () => new Map((users.data ?? []).map((u) => [u.id, u])),
    [users.data],
  );

  const rows = useMemo(
    () =>
      (subs.data ?? [])
        .map((s) => ({ sub: s, plan: planById.get(s.planId), user: userById.get(s.userId) }))
        .toSorted((a, b) =>
          (b.sub.currentPeriodStart ?? '').localeCompare(a.sub.currentPeriodStart ?? ''),
        ),
    [subs.data, planById, userById],
  );

  const stats = useMemo(() => {
    const paid = rows.filter(
      (r) => r.plan && r.plan.code !== 'FREE' && ['active', 'trialing'].includes(r.sub.status),
    );
    // Approximate monthly recurring revenue: yearly plans divided across 12.
    const mrr = paid.reduce((total, r) => {
      const price = r.plan?.price ?? 0;
      return total + (r.plan?.billingPeriod === 'yearly' ? price / 12 : price);
    }, 0);
    const expiringSoon = paid.filter(
      (r) =>
        r.sub.currentPeriodEnd && dayjs(r.sub.currentPeriodEnd).isBefore(dayjs().add(14, 'day')),
    ).length;

    return { paid: paid.length, mrr, expiringSoon, currency: plans.data?.[0]?.currency ?? 'INR' };
  }, [rows, plans.data]);

  return (
    <>
      <PageHeader title="Subscriptions" subtitle="Who is on what, and what expires soon." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Paid & Active" value={stats.paid} tone="profit" />
        <MetricCard
          label="Approx. MRR"
          value={formatCurrency(stats.mrr, stats.currency)}
          hint="Yearly plans divided across 12 months"
        />
        <MetricCard
          label="Expiring (14 days)"
          value={stats.expiringSoon}
          tone={stats.expiringSoon > 0 ? 'loss' : 'neutral'}
        />
        <MetricCard label="Total Records" value={rows.length} />
      </div>

      <Card className="mt-4 overflow-hidden">
        <CardHeader title="All subscriptions" description="Grant or change a plan from the Users page" />
        {subs.isLoading ? (
          <LoadingState />
        ) : rows.length === 0 ? (
          <EmptyState title="No subscriptions yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="px-4 py-2.5 font-medium">User</th>
                  <th className="px-3 py-2.5 font-medium">Plan</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Started</th>
                  <th className="px-3 py-2.5 font-medium">Renews / ends</th>
                  <th className="px-3 py-2.5 text-right font-medium">Price</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ sub, plan, user }) => (
                  <tr key={sub.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-text">{user?.displayName ?? '—'}</span>
                      <p className="text-xs text-muted">{user?.email}</p>
                    </td>
                    <td className="px-3 py-2.5 text-muted">{plan?.name ?? sub.planId}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone={STATUS_TONE[sub.status] ?? 'neutral'}>{sub.status}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-muted">
                      {sub.currentPeriodStart
                        ? formatDate(sub.currentPeriodStart.slice(0, 10), 'MMM D, YYYY')
                        : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-muted">
                      {sub.currentPeriodEnd
                        ? formatDate(sub.currentPeriodEnd.slice(0, 10), 'MMM D, YYYY')
                        : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular text-muted">
                      {plan ? formatCurrency(plan.price, plan.currency) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <CardBody>
          <p className="text-xs text-muted">
            Payments are not yet connected. Subscriptions are granted manually from the Users page;
            when a gateway is added it will write to this same record.
          </p>
        </CardBody>
      </Card>
    </>
  );
}
