import { useMemo } from 'react';
import { Check } from 'lucide-react';
import type { Plan, SubscriptionStatus } from '@/types';
import { Badge, Button, Card, CardBody, CardHeader, LoadingState } from '@/components/ui';
import { useEntitlements, useSubscribe, useSubscription } from '@/hooks/useBilling';
import { usePlans } from '@/hooks/usePlans';
import { toast } from '@/store/toastStore';
import { formatCurrency } from '@/utils/format';
import { formatDate } from '@/utils/date';
import { cn } from '@/utils/cn';

const STATUS_META: Record<SubscriptionStatus, { label: string; tone: 'neutral' | 'profit' | 'loss' | 'warning' | 'primary' }> = {
  free: { label: 'Free', tone: 'neutral' },
  active: { label: 'Active', tone: 'profit' },
  trialing: { label: 'Trial', tone: 'primary' },
  past_due: { label: 'Past due', tone: 'warning' },
  expired: { label: 'Expired', tone: 'loss' },
  canceled: { label: 'Cancelled', tone: 'loss' },
};

export function MembershipPanel() {
  const { entitlements, isLoading } = useEntitlements();
  const subscription = useSubscription();
  const plansQuery = usePlans();
  const subscribe = useSubscribe();

  const plans = plansQuery.data ?? [];
  const monthly = plans.filter((p) => p.isActive && p.billingPeriod === 'monthly');
  const yearly = plans.filter((p) => p.isActive && p.billingPeriod === 'yearly');

  const yearlySavings = useMemo(() => {
    const map = new Map<string, number>();
    for (const y of yearly) {
      const m = monthly.find((mm) => mm.code === y.code);
      if (m && m.price > 0) {
        const pct = ((m.price * 12 - y.price) / (m.price * 12)) * 100;
        if (pct > 0) map.set(y.id, Math.round(pct));
      }
    }
    return map;
  }, [monthly, yearly]);

  if (isLoading) return <LoadingState />;

  const status = entitlements.status;
  const meta = STATUS_META[status];
  const limit = entitlements.tradeLimit;
  const used = entitlements.tradesUsed;
  const unlimited = limit < 0;
  const currentPlanId = subscription.data?.planId;

  const onSubscribe = (plan: Plan) => {
    subscribe.mutate(plan.id, {
      onSuccess: () => toast.success(`You're now on ${plan.name} (${plan.billingPeriod}).`),
      onError: () => toast.error('Could not change plan.'),
    });
  };

  return (
    <div className="space-y-6">
      {/* Current plan */}
      <Card>
        <CardHeader title="Current Plan" description="Your membership status and usage" />
        <CardBody>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-2xl font-semibold text-text">{entitlements.plan?.name ?? 'Free'}</span>
            <Badge tone={meta.tone}>{meta.label}</Badge>
            {entitlements.plan && entitlements.plan.price > 0 && (
              <span className="text-sm text-muted">
                {formatCurrency(entitlements.plan.price, entitlements.plan.currency, { dp: 0 })} /{' '}
                {entitlements.plan.billingPeriod === 'monthly' ? 'mo' : 'yr'}
              </span>
            )}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Trades used" value={unlimited ? String(used) : `${used} / ${limit}`} />
            <Stat label="Remaining" value={unlimited ? 'Unlimited' : String(entitlements.tradesRemaining)} tone={!unlimited && entitlements.tradesRemaining === 0 ? 'loss' : undefined} />
            <Stat label="Start date" value={subscription.data?.currentPeriodStart ? formatDate(subscription.data.currentPeriodStart.slice(0, 10)) : '—'} />
            <Stat label="Expiry date" value={subscription.data?.currentPeriodEnd ? formatDate(subscription.data.currentPeriodEnd.slice(0, 10)) : '—'} />
          </div>

          {!unlimited && entitlements.tradesRemaining === 0 && (
            <div className="mt-4 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
              You&apos;ve used all {limit} free trade entries. Upgrade to continue recording trades — your
              existing trades stay exactly where they are.
            </div>
          )}
        </CardBody>
      </Card>

      <PlanGroup title="Monthly Plans" plans={monthly} currentPlanId={currentPlanId} onSubscribe={onSubscribe} pending={subscribe.isPending} />
      <PlanGroup title="Yearly Plans" plans={yearly} currentPlanId={currentPlanId} onSubscribe={onSubscribe} pending={subscribe.isPending} savings={yearlySavings} />
    </div>
  );
}

function PlanGroup({
  title,
  plans,
  currentPlanId,
  onSubscribe,
  pending,
  savings,
}: {
  title: string;
  plans: Plan[];
  currentPlanId?: string;
  onSubscribe: (p: Plan) => void;
  pending: boolean;
  savings?: Map<string, number>;
}) {
  if (plans.length === 0) return null;
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-text">{title}</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const featured = plan.code === 'PRO';
          const save = savings?.get(plan.id);
          return (
            <div key={plan.id} className={cn('flex flex-col rounded-card border bg-surface p-5', isCurrent ? 'border-primary ring-1 ring-primary/40' : 'border-border')}>
              <div className="flex items-center justify-between">
                <h4 className="text-base font-semibold text-text">{plan.name}</h4>
                {isCurrent ? <Badge tone="primary">Current</Badge> : save ? <Badge tone="profit">Save {save}%</Badge> : featured ? <Badge tone="primary">Popular</Badge> : null}
              </div>
              <div className="mt-3 flex items-end gap-1">
                <span className="text-3xl font-bold tracking-tight text-text">
                  {plan.price === 0 ? 'Free' : formatCurrency(plan.price, plan.currency, { dp: 0 })}
                </span>
                {plan.price > 0 && <span className="mb-1 text-xs text-muted">/ {plan.billingPeriod === 'monthly' ? 'mo' : 'yr'}</span>}
              </div>
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-text">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-profit" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className="mt-5 w-full"
                variant={isCurrent ? 'outline' : featured ? 'primary' : 'secondary'}
                disabled={isCurrent || pending}
                onClick={() => onSubscribe(plan)}
              >
                {isCurrent ? 'Current plan' : plan.price === 0 ? 'Switch to Free' : `Choose ${plan.name}`}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'loss' }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className={cn('mt-0.5 text-base font-semibold text-text', tone === 'loss' && 'text-loss')}>{value}</p>
    </div>
  );
}
