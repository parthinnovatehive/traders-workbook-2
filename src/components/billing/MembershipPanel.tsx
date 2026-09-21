import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Clock, RefreshCw, ShieldCheck } from 'lucide-react';
import type { BillingPeriod, CheckoutSession, PaymentResult, Plan } from '@/types';
import { Badge, Button, Card, CardBody, CardHeader, LoadingState, Modal } from '@/components/ui';
import {
  useCancelSubscription,
  useConfirmPayment,
  useCreateOrder,
  useEntitlements,
  useFailOrder,
  useOrders,
  useSubscription,
} from '@/hooks/useBilling';
import { usePlans } from '@/hooks/usePlans';
import { billingPhase, daysUntilExpiry, type BillingPhase } from '@/lib/entitlements';
import { toast } from '@/store/toastStore';
import { formatCurrency } from '@/utils/format';
import { formatDate } from '@/utils/date';
import { cn } from '@/utils/cn';
import { openRazorpayCheckout } from '@/lib/razorpay';
import { useAuthStore } from '@/store/authStore';
import { CheckoutModal, PaymentStatusBadge } from './CheckoutModal';

const PHASE_META: Record<
  BillingPhase,
  { label: string; tone: 'neutral' | 'profit' | 'loss' | 'warning' | 'primary' }
> = {
  free: { label: 'Free', tone: 'neutral' },
  active: { label: 'Active', tone: 'profit' },
  trialing: { label: 'Trial', tone: 'primary' },
  expiring_soon: { label: 'Expiring soon', tone: 'warning' },
  past_due: { label: 'Payment failed', tone: 'warning' },
  canceled: { label: 'Cancelled', tone: 'warning' },
  expired: { label: 'Expired', tone: 'loss' },
};

export function MembershipPanel() {
  const user = useAuthStore((s) => s.user);
  const { entitlements, isLoading } = useEntitlements();
  const subscription = useSubscription();
  const plansQuery = usePlans();

  const createOrder = useCreateOrder();
  const confirmPayment = useConfirmPayment();
  const failOrder = useFailOrder();
  const cancelSubscription = useCancelSubscription();

  // The order being paid for. Held here rather than in the modal so the modal
  // stays a dumb presentation of "this order, this plan".
  const [order, setOrder] = useState<CheckoutSession | null>(null);
  const [checkoutPlan, setCheckoutPlan] = useState<Plan | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [period, setPeriod] = useState<BillingPeriod>('monthly');

  const plans = plansQuery.data ?? [];
  const active = plans.filter((p) => p.isActive);
  const monthly = active.filter((p) => p.billingPeriod === 'monthly');
  const yearly = active.filter((p) => p.billingPeriod === 'yearly');

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

  const topSaving = useMemo(
    () => (yearlySavings.size > 0 ? Math.max(...yearlySavings.values()) : 0),
    [yearlySavings],
  );

  if (isLoading) return <LoadingState />;

  const sub = subscription.data ?? null;
  const phase = billingPhase(sub, plans);
  const meta = PHASE_META[phase];
  const days = daysUntilExpiry(sub);
  const limit = entitlements.tradeLimit;
  const used = entitlements.tradesUsed;
  const unlimited = limit < 0;
  const ratio = entitlements.tradeUsageRatio;

  // The plan whose limits are actually in force right now — not the one on the
  // stored row. A lapsed Pro subscriber is on Free, and the page must say so.
  const freePlan = plans.find((p) => p.code === 'FREE') ?? null;
  const subscribedPlan = entitlements.plan;
  const livePlan = entitlements.paidActive ? subscribedPlan : freePlan;
  const lapsedPlan = !entitlements.paidActive && subscribedPlan?.code !== 'FREE' ? subscribedPlan : null;

  /** Step 2: the gateway succeeded — let the server verify and activate. */
  const onPaid = (activeOrder: CheckoutSession, result: PaymentResult) => {
    confirmPayment.mutate(
      { orderId: activeOrder.id, result },
      {
        onSuccess: ({ subscription: s }) => {
          const paidPlan = plans.find((p) => p.id === s.planId);
          toast.success(`Payment received — you're on ${paidPlan?.name ?? 'your new plan'}.`);
          setOrder(null);
          setCheckoutPlan(null);
        },
        onError: (e) =>
          toast.error(
            e instanceof Error
              ? e.message
              : 'Payment taken but not yet applied — it will land shortly.',
          ),
      },
    );
  };

  /** Declined or abandoned: close the order so it isn't left pending forever. */
  const onFailed = (activeOrder: CheckoutSession, reason: string) => {
    failOrder.mutate({ orderId: activeOrder.id, reason });
    setOrder(null);
    setCheckoutPlan(null);
    toast.error(reason);
  };

  /** Step 1: open a server-priced order, then hand it to the gateway. */
  const onSubscribe = (plan: Plan) => {
    // Moving to Free is a cancellation, not a purchase — the server refuses to
    // open an order for a zero-price plan, so route it where it belongs.
    if (plan.price <= 0) {
      setCancelOpen(true);
      return;
    }

    createOrder.mutate(plan.id, {
      onSuccess: async (created) => {
        setCheckoutPlan(plan);
        setOrder(created);

        // Mock provider (no Razorpay keys configured): the local modal stands in.
        if (created.provider !== 'razorpay' || !created.keyId || !created.providerOrderId) {
          return;
        }

        try {
          await openRazorpayCheckout({
            keyId: created.keyId,
            providerOrderId: created.providerOrderId,
            amount: created.amount,
            currency: created.currency,
            planName: `${plan.name} · ${plan.billingPeriod === 'yearly' ? 'Yearly' : 'Monthly'}`,
            prefill: { name: user?.displayName, email: user?.email, contact: user?.phone },
            onSuccess: (r) =>
              onPaid(created, {
                paymentId: r.razorpay_payment_id,
                providerOrderId: r.razorpay_order_id,
                signature: r.razorpay_signature,
              }),
            onDismiss: () => onFailed(created, 'Checkout was closed before payment.'),
            onFailure: (reason) => onFailed(created, reason),
          });
        } catch (e) {
          onFailed(created, e instanceof Error ? e.message : 'Could not open checkout.');
        }
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not start the checkout.'),
    });
  };

  const onCancel = () => {
    cancelSubscription.mutate(undefined, {
      onSuccess: () => {
        setCancelOpen(false);
        toast.info('Subscription cancelled. You keep access until the period ends.');
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not cancel.'),
    });
  };

  /** Jump to the plan the user just lost, in the period they bought it in. */
  const onRenew = () => {
    const target = lapsedPlan ?? subscribedPlan;
    if (!target) return;
    if (target.billingPeriod) setPeriod(target.billingPeriod);
    onSubscribe(target);
  };

  const shownPlans = period === 'yearly' ? yearly : monthly;

  return (
    <div className="space-y-6">
      <PlanAlert
        phase={phase}
        days={days}
        planName={(lapsedPlan ?? subscribedPlan)?.name ?? 'your plan'}
        expiresAt={sub?.currentPeriodEnd}
        renewing={createOrder.isPending}
        onRenew={onRenew}
      />

      {/* Current plan */}
      <Card>
        <CardHeader title="Current Plan" description="Your membership status and usage" />
        <CardBody>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-2xl font-semibold text-text">{livePlan?.name ?? 'Free'}</span>
            <Badge tone={meta.tone}>{meta.label}</Badge>
            {livePlan && livePlan.price > 0 && (
              <span className="text-sm text-muted">
                {formatCurrency(livePlan.price, livePlan.currency, { dp: 0 })} /{' '}
                {livePlan.billingPeriod === 'monthly' ? 'mo' : 'yr'}
              </span>
            )}
            {lapsedPlan && (
              <span className="text-sm text-muted">
                — {lapsedPlan.name} is no longer active
              </span>
            )}
          </div>

          {/* Usage. The bar is the point: "18 / 30" is a number, a bar is a feeling. */}
          <div className="mt-5">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted">Trade entries</span>
              <span className="tabular font-medium text-text">
                {unlimited ? `${used} recorded` : `${used} of ${limit}`}
              </span>
            </div>
            {unlimited ? (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-profit">
                <ShieldCheck className="h-3.5 w-3.5" /> Unlimited on this plan
              </p>
            ) : (
              <div
                className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-2"
                role="progressbar"
                aria-valuenow={Math.round(ratio * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Trade entries used"
              >
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    ratio >= 1 ? 'bg-loss' : ratio >= 0.8 ? 'bg-warning' : 'bg-primary',
                  )}
                  style={{ width: `${Math.max(2, Math.min(100, ratio * 100))}%` }}
                />
              </div>
            )}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat
              label="Remaining"
              value={unlimited ? 'Unlimited' : String(entitlements.tradesRemaining)}
              tone={!unlimited && entitlements.tradesRemaining === 0 ? 'loss' : undefined}
            />
            <Stat
              label="Custom strategies"
              value={entitlements.strategyLimit < 0 ? 'Unlimited' : String(entitlements.strategyLimit)}
            />
            <Stat
              label="Started"
              value={sub?.currentPeriodStart ? formatDate(sub.currentPeriodStart.slice(0, 10)) : '—'}
            />
            <Stat
              label={phase === 'expired' ? 'Expired on' : 'Renews / ends'}
              value={sub?.currentPeriodEnd ? formatDate(sub.currentPeriodEnd.slice(0, 10)) : '—'}
              tone={phase === 'expired' ? 'loss' : undefined}
              hint={
                phase !== 'expired' && days !== null && days >= 0
                  ? `${days} day${days === 1 ? '' : 's'} left`
                  : undefined
              }
            />
          </div>

          {!unlimited && entitlements.tradesRemaining === 0 && (
            <div className="mt-4 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
              You&apos;ve used all {limit} trade entries on this plan. Upgrade to continue recording
              trades — your existing trades stay exactly where they are.
            </div>
          )}

          {entitlements.paidActive && phase !== 'canceled' && (
            <div className="mt-5 flex justify-end border-t border-border pt-4">
              <Button variant="ghost" size="sm" onClick={() => setCancelOpen(true)}>
                Cancel subscription
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Plans */}
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-text">
            {entitlements.paidActive ? 'Change your plan' : 'Choose a plan'}
          </h3>
          {monthly.length > 0 && yearly.length > 0 && (
            <PeriodToggle value={period} onChange={setPeriod} saving={topSaving} />
          )}
        </div>

        <PlanGrid
          plans={shownPlans}
          livePlanId={livePlan?.id}
          lapsedPlanId={lapsedPlan?.id}
          onSubscribe={onSubscribe}
          pending={createOrder.isPending}
          savings={yearlySavings}
        />
      </div>

      <BillingHistory />

      {/* Only used when no Razorpay keys are configured — with them, the hosted
          checkout takes over and this never opens. */}
      <CheckoutModal
        open={order !== null && order.provider !== 'razorpay'}
        order={order}
        plan={checkoutPlan}
        confirming={confirmPayment.isPending}
        onPaid={(result) => order && onPaid(order, result)}
        onFailed={(reason) => order && onFailed(order, reason)}
        onClose={() => {
          setOrder(null);
          setCheckoutPlan(null);
        }}
      />

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel your subscription?"
        size="md"
      >
        <p className="text-sm text-text">
          You keep everything you have paid for until{' '}
          {sub?.currentPeriodEnd ? formatDate(sub.currentPeriodEnd.slice(0, 10)) : 'the end of the period'}
          . After that your account returns to the Free plan — your trades are never deleted.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setCancelOpen(false)}>
            Keep my plan
          </Button>
          <Button variant="danger" loading={cancelSubscription.isPending} onClick={onCancel}>
            Cancel subscription
          </Button>
        </div>
      </Modal>
    </div>
  );
}

/**
 * The banner the page previously had no way to show.
 *
 * Enforcement of a lapsed plan was always correct; the user was simply never
 * told. Silence is the worst option here — someone who has paid deserves to
 * know the day before, not to discover it when an action is refused.
 */
function PlanAlert({
  phase,
  days,
  planName,
  expiresAt,
  renewing,
  onRenew,
}: {
  phase: BillingPhase;
  days: number | null;
  planName: string;
  expiresAt?: string;
  renewing: boolean;
  onRenew: () => void;
}) {
  if (phase === 'free' || phase === 'active' || phase === 'trialing') return null;

  const on = expiresAt ? formatDate(expiresAt.slice(0, 10)) : null;

  const copy: Record<string, { tone: 'loss' | 'warning'; title: string; body: string; cta: string }> = {
    expired: {
      tone: 'loss',
      title: `Your ${planName} plan has expired`,
      body: `It ended${on ? ` on ${on}` : ''}. You're on the Free plan now — every trade you recorded is still here, and renewing restores your full limits immediately.`,
      cta: 'Renew now',
    },
    expiring_soon: {
      tone: 'warning',
      title:
        days !== null && days <= 0
          ? `Your ${planName} plan ends today`
          : `Your ${planName} plan ends in ${days} day${days === 1 ? '' : 's'}`,
      body: `Renew${on ? ` before ${on}` : ''} to keep your limits. We don't charge automatically, so nothing happens unless you choose to renew.`,
      cta: 'Renew now',
    },
    canceled: {
      tone: 'warning',
      title: 'Subscription cancelled',
      body: `You keep ${planName}${on ? ` until ${on}` : ' until the period ends'}, then move to the Free plan. Changed your mind? Renewing puts it back.`,
      cta: 'Resume plan',
    },
    past_due: {
      tone: 'loss',
      title: 'Your last payment did not go through',
      body: `${planName} is on hold until a payment succeeds. Nothing has been deleted.`,
      cta: 'Pay now',
    },
  };

  const c = copy[phase];
  if (!c) return null;

  const loss = c.tone === 'loss';
  const Icon = loss ? AlertTriangle : Clock;

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-card border p-4 sm:flex-row sm:items-center sm:justify-between',
        loss ? 'border-loss/40 bg-loss/10' : 'border-warning/40 bg-warning/10',
      )}
    >
      <div className="flex gap-3">
        <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', loss ? 'text-loss' : 'text-warning')} />
        <div>
          <p className={cn('text-sm font-semibold', loss ? 'text-loss' : 'text-warning')}>{c.title}</p>
          <p className="mt-1 text-sm text-text/80">{c.body}</p>
        </div>
      </div>
      <Button
        variant={loss ? 'primary' : 'secondary'}
        size="sm"
        loading={renewing}
        onClick={onRenew}
        className="shrink-0 sm:ml-4"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        {c.cta}
      </Button>
    </div>
  );
}

function PeriodToggle({
  value,
  onChange,
  saving,
}: {
  value: BillingPeriod;
  onChange: (p: BillingPeriod) => void;
  saving: number;
}) {
  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-surface-2 p-0.5">
      {(['monthly', 'yearly'] as const).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          aria-pressed={value === p}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            value === p ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text',
          )}
        >
          {p === 'monthly' ? 'Monthly' : 'Yearly'}
          {p === 'yearly' && saving > 0 && (
            <span className="rounded bg-profit/15 px-1.5 py-0.5 text-[10px] font-semibold text-profit">
              Save {saving}%
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function PlanGrid({
  plans,
  livePlanId,
  lapsedPlanId,
  onSubscribe,
  pending,
  savings,
}: {
  plans: Plan[];
  livePlanId?: string;
  lapsedPlanId?: string;
  onSubscribe: (p: Plan) => void;
  pending: boolean;
  savings?: Map<string, number>;
}) {
  if (plans.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {plans.map((plan) => {
        const isCurrent = plan.id === livePlanId;
        // A plan the user had and lost. It must stay clickable — the old code
        // marked it "Current" and disabled it, leaving no way to renew.
        const isLapsed = plan.id === lapsedPlanId;
        const featured = plan.code === 'PRO';
        const save = savings?.get(plan.id);

        return (
          <div
            key={plan.id}
            className={cn(
              'relative flex flex-col rounded-card border bg-surface p-5 transition-shadow',
              isCurrent && 'border-primary ring-1 ring-primary/40',
              isLapsed && 'border-loss/50 ring-1 ring-loss/30',
              !isCurrent && !isLapsed && 'border-border hover:shadow-md',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-base font-semibold text-text">{plan.name}</h4>
              {isCurrent ? (
                <Badge tone="primary">Current</Badge>
              ) : isLapsed ? (
                <Badge tone="loss">Expired</Badge>
              ) : save ? (
                <Badge tone="profit">Save {save}%</Badge>
              ) : featured ? (
                <Badge tone="primary">Popular</Badge>
              ) : null}
            </div>

            <div className="mt-3 flex items-end gap-1">
              <span className="text-3xl font-bold tracking-tight text-text">
                {plan.price === 0 ? 'Free' : formatCurrency(plan.price, plan.currency, { dp: 0 })}
              </span>
              {plan.price > 0 && (
                <span className="mb-1 text-xs text-muted">
                  / {plan.billingPeriod === 'monthly' ? 'mo' : 'yr'}
                </span>
              )}
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
              variant={isCurrent ? 'outline' : isLapsed || featured ? 'primary' : 'secondary'}
              disabled={isCurrent || pending}
              onClick={() => onSubscribe(plan)}
            >
              {isCurrent
                ? 'Current plan'
                : isLapsed
                  ? `Renew ${plan.name}`
                  : plan.price === 0
                    ? 'Switch to Free'
                    : `Choose ${plan.name}`}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

/** Receipts. Every order, including the ones that failed. */
function BillingHistory() {
  const orders = useOrders();
  const rows = orders.data ?? [];

  if (orders.isLoading || rows.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Billing history"
        description={`${rows.length} order${rows.length === 1 ? '' : 's'}`}
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-3 py-2.5 font-medium">Order</th>
              <th className="px-3 py-2.5 text-right font-medium">Amount</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/50">
                <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                  {formatDate(o.createdAt.slice(0, 10))}
                </td>
                <td className="px-3 py-2.5 tabular text-xs text-muted" title={o.id}>
                  {o.providerPaymentId ?? o.id.slice(0, 8)}
                </td>
                <td className="px-3 py-2.5 text-right tabular text-text">
                  {formatCurrency(o.amount, o.currency, { dp: 0 })}
                </td>
                <td className="px-3 py-2.5">
                  <span title={o.failureReason}>
                    <PaymentStatusBadge status={o.status} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Stat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: 'loss';
  hint?: string;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className={cn('mt-0.5 text-base font-semibold text-text', tone === 'loss' && 'text-loss')}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}
