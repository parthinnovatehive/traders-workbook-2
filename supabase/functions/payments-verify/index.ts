import { authenticate, corsHeaders, fail, json, serviceClient } from '../_shared/http.ts';
import {
  fetchRazorpayPayment,
  fromMinorUnits,
  requireEnv,
  verifyPaymentSignature,
} from '../_shared/razorpay.ts';

/**
 * POST /payments-verify
 *   { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature }
 *
 * The gate between "the browser says it paid" and "the plan is granted".
 * Four independent checks, in order of cheapness:
 *
 *   1. JWT            — who is asking (never taken from the body)
 *   2. HMAC signature — the values really came from Razorpay, untampered
 *   3. Live API read  — the payment is actually CAPTURED, for this order,
 *                       for this amount (a signature alone proves none of that)
 *   4. SQL guards     — order ownership, replay, amount and currency re-checked
 *                       inside confirm_payment_order
 *
 * Skipping 3 is the classic Razorpay mistake: a signature is valid for an
 * `authorized`-but-never-captured payment, and for a ₹1 payment against a
 * ₹3,299 order.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const user = await authenticate(req);
  if (!user) return json({ error: 'You are not signed in.' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (err) {
    return fail('Malformed request.', err);
  }

  const orderId = String(body.orderId ?? '');
  const razorpayOrderId = String(body.razorpayOrderId ?? '');
  const razorpayPaymentId = String(body.razorpayPaymentId ?? '');
  const razorpaySignature = String(body.razorpaySignature ?? '');

  if (!orderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return json({ error: 'Incomplete payment details.' }, 400);
  }

  // --- 2. Signature -----------------------------------------------------------
  let signatureOk = false;
  try {
    signatureOk = await verifyPaymentSignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
      keySecret: requireEnv('RAZORPAY_KEY_SECRET'),
    });
  } catch (err) {
    return fail('Payment verification is not configured.', err, 500);
  }

  if (!signatureOk) {
    // Someone posted a receipt we did not issue. Worth alerting on.
    console.error('[payments] SIGNATURE MISMATCH', {
      userId: user.id,
      orderId,
      razorpayPaymentId,
    });
    return json({ error: 'We could not verify that payment.' }, 400);
  }

  // --- 3. What Razorpay itself says -------------------------------------------
  let payment;
  try {
    payment = await fetchRazorpayPayment(razorpayPaymentId);
  } catch (err) {
    // Do NOT grant on a failed lookup. The webhook will settle it shortly.
    return fail('We could not confirm that payment yet. It will apply shortly.', err, 502);
  }

  if (payment.order_id !== razorpayOrderId) {
    console.error('[payments] payment/order mismatch', { payment, razorpayOrderId });
    return json({ error: 'We could not verify that payment.' }, 400);
  }

  // --- 4. Settle, with the SQL guards re-checking everything -------------------
  const db = serviceClient();
  const { data, error } = await db.rpc('confirm_payment_order', {
    p_order_id: orderId,
    p_user_id: user.id,
    p_provider_order_id: razorpayOrderId,
    p_provider_payment_id: razorpayPaymentId,
    p_amount_paid: fromMinorUnits(payment.amount),
    p_currency: payment.currency,
    p_payment_status: payment.status,
  });

  if (error) return fail('We could not apply that payment.', error);

  return json({ subscription: data });
});
