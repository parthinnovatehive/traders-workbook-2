import type { ISODateTime, UUID } from './common';

/**
 * Payment orders.
 *
 * Modelled on how a real gateway works, so swapping the mock provider for
 * Razorpay is a change of implementation rather than a change of shape:
 *
 *   1. the server creates an order, pricing it from the `plans` table
 *   2. the user pays against that order in the provider's checkout
 *   3. the provider returns a payment reference plus a signature
 *   4. the SERVER verifies the signature and only then activates the plan
 *
 * The client never sends an amount and never writes to `subscriptions`. That is
 * the whole point of the seam: a forged request can create a pending order and
 * nothing more.
 */

export const PAYMENT_STATUSES = ['created', 'paid', 'failed', 'refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** `mock` until Razorpay keys exist; the rest of the flow is unchanged by it. */
export const PAYMENT_PROVIDERS = ['mock', 'razorpay'] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export interface PaymentOrder {
  id: UUID;
  userId: UUID;
  planId: string;
  /** Priced server-side from `plans`, in the plan's own currency. */
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: PaymentProvider;
  /** The gateway's order id (`order_...` for Razorpay). Null for the mock. */
  providerOrderId?: string;
  /** The gateway's payment id (`pay_...`), set once the payment succeeds. */
  providerPaymentId?: string;
  failureReason?: string;
  createdAt: ISODateTime;
  paidAt?: ISODateTime;
}

/** What a gateway hands back to the browser when checkout succeeds. */
export interface PaymentResult {
  paymentId: string;
  /** The gateway's order id the payment was made against. */
  providerOrderId?: string;
  /**
   * HMAC from the provider, verified server-side. The browser only relays it —
   * it is never checked here, because a check in the browser proves nothing.
   */
  signature?: string;
}

/**
 * An order plus the publishable key needed to open checkout against it. The
 * key id is returned by the server so the client never hardcodes which account
 * it is charging into.
 */
export interface CheckoutSession extends PaymentOrder {
  keyId?: string;
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  created: 'Pending',
  paid: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
};
