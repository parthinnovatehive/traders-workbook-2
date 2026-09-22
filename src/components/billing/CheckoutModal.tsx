import { useState } from 'react';
import { CreditCard, Lock, ShieldCheck, TriangleAlert } from 'lucide-react';
import type { PaymentOrder, PaymentResult, Plan } from '@/types';
import { Badge, Button, Modal } from '@/components/ui';
import { PERIOD_ADVERB, PERIOD_LABEL, periodMonths } from '@/lib/pricing';
import { formatCurrency } from '@/utils/format';
import { uid } from '@/utils/id';

/**
 * Checkout.
 *
 * Stands in for the gateway's own hosted UI. When Razorpay arrives this whole
 * component is replaced by `new Razorpay({...}).open()` — everything around it
 * stays, because the contract is identical:
 *
 *   order in  →  user pays  →  { paymentId, signature } out  →  server verifies
 *
 * `onPaid` receives exactly what Razorpay's success handler provides, so the
 * caller does not change either. See docs/PAYMENTS.md.
 */

type Phase = 'review' | 'processing' | 'done';

interface Props {
  open: boolean;
  order: PaymentOrder | null;
  plan: Plan | null;
  onPaid: (result: PaymentResult) => void;
  onFailed: (reason: string) => void;
  onClose: () => void;
  /** True while the parent is verifying the receipt with the server. */
  confirming?: boolean;
}

export function CheckoutModal({
  open,
  order,
  plan,
  onPaid,
  onFailed,
  onClose,
  confirming = false,
}: Props) {
  const [phase, setPhase] = useState<Phase>('review');

  if (!order || !plan) return null;

  const busy = phase === 'processing' || confirming;

  const settle = (succeed: boolean) => {
    setPhase('processing');
    // A beat of latency, so the UI is exercised the way a real gateway's
    // redirect-and-return would exercise it rather than resolving instantly.
    setTimeout(() => {
      if (succeed) {
        // Shaped like Razorpay's ids so nothing downstream has to change.
        onPaid({ paymentId: `pay_mock_${uid().replace(/-/g, '').slice(0, 14)}` });
      } else {
        setPhase('review');
        onFailed('Payment was declined by the test gateway.');
      }
    }, 900);
  };

  const close = () => {
    if (busy) return;
    if (phase === 'review') onFailed('Checkout was closed before payment.');
    setPhase('review');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Complete your payment"
      description={`${plan.name} · ${PERIOD_LABEL[plan.billingPeriod]}`}
      size="md"
    >
      <div className="space-y-5">
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2">
          <p className="flex items-start gap-2 text-xs text-warning">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              <span className="font-medium">Test checkout.</span> No card is taken and no money
              moves. This stands in for the payment gateway until it is connected.
            </span>
          </p>
        </div>

        <div className="rounded-card border border-border bg-surface-2 p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted">{plan.name}</span>
            <span className="text-2xl font-semibold tabular text-text">
              {formatCurrency(order.amount, order.currency, { dp: 0 })}
            </span>
          </div>
          <div className="mt-3 space-y-1.5 border-t border-border pt-3 text-xs text-muted">
            <Row label="Billing" value={PERIOD_ADVERB[plan.billingPeriod].replace('billed ', '')} />
            <Row
              label="Renews"
              value={`In ${periodMonths(plan.billingPeriod)} month${periodMonths(plan.billingPeriod) === 1 ? '' : 's'}`}
            />
            <Row label="Order" value={order.id.slice(0, 8)} mono />
          </div>
        </div>

        <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted">
          <Lock className="h-3 w-3" />
          The amount is set by the server from the plan — it is never sent from this page.
        </p>

        <div className="space-y-2">
          <Button className="w-full" loading={busy} onClick={() => settle(true)}>
            <CreditCard className="h-4 w-4" />
            {confirming
              ? 'Confirming…'
              : `Pay ${formatCurrency(order.amount, order.currency, { dp: 0 })}`}
          </Button>

          {/* The failure path needs to be reachable too, or it never gets tested
              until a real customer's card declines. */}
          <Button variant="ghost" className="w-full" disabled={busy} onClick={() => settle(false)}>
            Simulate a declined payment
          </Button>
        </div>

        <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted">
          <ShieldCheck className="h-3 w-3" />
          Your plan is activated by the server only after the payment is verified.
        </p>
      </div>
    </Modal>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className={mono ? 'tabular text-text' : 'text-text'}>{value}</span>
    </div>
  );
}

/** Small status pill reused by the billing history list. */
export function PaymentStatusBadge({ status }: { status: PaymentOrder['status'] }) {
  const tone = status === 'paid' ? 'profit' : status === 'failed' ? 'loss' : 'neutral';
  const label = status === 'created' ? 'Pending' : status[0]!.toUpperCase() + status.slice(1);
  return <Badge tone={tone}>{label}</Badge>;
}
