/**
 * Razorpay Checkout loader.
 *
 * Only the publishable key id ever reaches this file. The key secret lives in
 * Supabase Edge Function secrets and is used solely to sign and verify
 * server-side — if you ever find `RAZORPAY_KEY_SECRET` in anything under
 * `src/`, that is a breach, not a convenience.
 */

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

export interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (response: RazorpaySuccess) => void;
  modal?: { ondismiss?: () => void; escape?: boolean };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (payload: unknown) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

let loader: Promise<void> | null = null;

/** Loads checkout.js once, on demand. Cached so reopening is instant. */
export function loadRazorpayCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (loader) return loader;

  loader = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      // Allow a retry on the next attempt rather than caching the failure.
      loader = null;
      reject(new Error('Could not load the payment gateway. Check your connection.'));
    };
    document.head.append(script);
  });

  return loader;
}

export interface OpenCheckoutInput {
  keyId: string;
  /** Razorpay's order id (`order_…`), created server-side. */
  providerOrderId: string;
  /** Amount in the major unit (rupees); converted to paise here. */
  amount: number;
  currency: string;
  planName: string;
  prefill?: { name?: string; email?: string; contact?: string };
  onSuccess: (response: RazorpaySuccess) => void;
  onDismiss: () => void;
  onFailure: (reason: string) => void;
}

/**
 * Opens the hosted checkout.
 *
 * The amount passed here is display-only — Razorpay charges what the *order*
 * says, and the order was priced on the server. A tampered value in this call
 * cannot change what is taken.
 */
export async function openRazorpayCheckout(input: OpenCheckoutInput): Promise<void> {
  await loadRazorpayCheckout();
  if (!window.Razorpay) throw new Error('The payment gateway failed to load.');

  const rzp = new window.Razorpay({
    key: input.keyId,
    order_id: input.providerOrderId,
    amount: Math.round(input.amount * 100),
    currency: input.currency,
    name: "Trader's Workbook",
    description: input.planName,
    prefill: input.prefill,
    theme: { color: '#3b82f6' },
    handler: input.onSuccess,
    modal: { ondismiss: input.onDismiss },
  });

  rzp.on('payment.failed', (payload: unknown) => {
    const description = (payload as { error?: { description?: string } })?.error?.description;
    input.onFailure(description ?? 'The payment could not be completed.');
  });

  rzp.open();
}
