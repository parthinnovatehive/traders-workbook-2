/**
 * Razorpay helpers shared by the payment Edge Functions.
 *
 * Everything in here runs server-side only. RAZORPAY_KEY_SECRET and
 * RAZORPAY_WEBHOOK_SECRET are Edge Function secrets and must never be exposed
 * to the browser, logged, or returned in a response body.
 */

export const RAZORPAY_API = 'https://api.razorpay.com/v1';

export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required secret: ${name}`);
  return value;
}

/* -------------------------------------------------------------------------- */
/* Signatures                                                                  */
/* -------------------------------------------------------------------------- */

const encoder = new TextEncoder();

/** Hex HMAC-SHA256, the encoding Razorpay uses for every signature. */
export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Constant-time comparison.
 *
 * A plain `===` on a signature leaks how many leading bytes matched through
 * timing, which is enough to forge one given enough attempts. Always compare
 * secrets this way.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Checkout signature: HMAC of `order_id|payment_id` keyed with the API secret.
 * Proves the browser's success callback really came from Razorpay.
 */
export async function verifyPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
  keySecret: string;
}): Promise<boolean> {
  const expected = await hmacSha256Hex(
    params.keySecret,
    `${params.orderId}|${params.paymentId}`,
  );
  return timingSafeEqual(expected, params.signature);
}

/**
 * Webhook signature: HMAC of the RAW request body keyed with the webhook
 * secret — a different secret from the API key secret.
 *
 * The body must be the exact bytes received. Parsing to JSON and re-stringifying
 * changes key order and whitespace and will never match.
 */
export async function verifyWebhookSignature(params: {
  rawBody: string;
  signature: string;
  webhookSecret: string;
}): Promise<boolean> {
  const expected = await hmacSha256Hex(params.webhookSecret, params.rawBody);
  return timingSafeEqual(expected, params.signature);
}

/* -------------------------------------------------------------------------- */
/* API                                                                         */
/* -------------------------------------------------------------------------- */

function authHeader(): string {
  const keyId = requireEnv('RAZORPAY_KEY_ID');
  const keySecret = requireEnv('RAZORPAY_KEY_SECRET');
  return `Basic ${btoa(`${keyId}:${keySecret}`)}`;
}

export interface RazorpayOrder {
  id: string;
  amount: number; // paise
  currency: string;
  status: string;
}

export interface RazorpayPayment {
  id: string;
  order_id: string;
  amount: number; // paise
  currency: string;
  status: string; // 'captured' is the only one that means money moved
}

/**
 * Rupees to paise. Razorpay works entirely in the smallest currency unit, and
 * getting this wrong charges 100x or 1/100th — so round explicitly rather than
 * letting a float drift.
 */
export const toMinorUnits = (amount: number): number => Math.round(amount * 100);

/** Paise back to rupees, for comparing against what we stored. */
export const fromMinorUnits = (minor: number): number => Math.round(minor) / 100;

export async function createRazorpayOrder(input: {
  amountMinor: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  const res = await fetch(`${RAZORPAY_API}/orders`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: input.amountMinor,
      currency: input.currency,
      receipt: input.receipt,
      notes: input.notes ?? {},
      payment_capture: 1,
    }),
  });

  if (!res.ok) {
    throw new Error(`Razorpay order creation failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as RazorpayOrder;
}

/**
 * Re-read the payment from Razorpay rather than trusting what the browser sent.
 *
 * The signature proves the values were not tampered with in transit, but this
 * is what proves the payment was actually captured and for how much. It is the
 * difference between "a valid-looking receipt" and "money in the account".
 */
export async function fetchRazorpayPayment(paymentId: string): Promise<RazorpayPayment> {
  const res = await fetch(`${RAZORPAY_API}/payments/${paymentId}`, {
    headers: { Authorization: authHeader() },
  });
  if (!res.ok) {
    throw new Error(`Could not fetch payment ${paymentId} (${res.status})`);
  }
  return (await res.json()) as RazorpayPayment;
}
