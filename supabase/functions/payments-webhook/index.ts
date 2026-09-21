import { fail, json, serviceClient } from '../_shared/http.ts';
import { fromMinorUnits, requireEnv, verifyWebhookSignature } from '../_shared/razorpay.ts';

/**
 * POST /payments-webhook  — called by Razorpay, not by the browser.
 *
 * This is what makes payments reliable. The browser handler in payments-verify
 * is a nicety: the user can close the tab, lose signal, or have the redirect
 * eaten mid-flight, and their money is still taken. The webhook is the path
 * that guarantees the plan is granted anyway.
 *
 * Deploy with JWT verification DISABLED — Razorpay does not send a Supabase
 * token. The HMAC below is what authenticates the caller:
 *
 *   supabase functions deploy payments-webhook --no-verify-jwt
 *
 * Subscribe to `payment.captured` and `payment.failed` in the Razorpay
 * dashboard, and set RAZORPAY_WEBHOOK_SECRET to the secret shown there — it is
 * a DIFFERENT secret from the API key secret.
 */
Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  // The raw bytes, exactly as received. Parsing and re-stringifying reorders
  // keys and drops whitespace, and the HMAC would never match again.
  const rawBody = await req.text();
  const signature = req.headers.get('x-razorpay-signature') ?? '';
  const eventId = req.headers.get('x-razorpay-event-id') ?? '';

  if (!signature) return json({ error: 'Missing signature.' }, 400);

  let ok = false;
  try {
    ok = await verifyWebhookSignature({
      rawBody,
      signature,
      webhookSecret: requireEnv('RAZORPAY_WEBHOOK_SECRET'),
    });
  } catch (err) {
    return fail('Webhook is not configured.', err, 500);
  }

  if (!ok) {
    console.error('[payments] WEBHOOK SIGNATURE MISMATCH', { eventId });
    // 401, not 400: tells Razorpay this was rejected rather than malformed.
    return json({ error: 'Invalid signature.' }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    return fail('Malformed webhook payload.', err);
  }

  const event = String(payload.event ?? '');
  const entity = (payload as {
    payload?: { payment?: { entity?: Record<string, unknown> } };
  }).payload?.payment?.entity;

  if (!entity) return json({ ok: true, ignored: 'no payment entity' });

  const razorpayOrderId = String(entity.order_id ?? '');
  const razorpayPaymentId = String(entity.id ?? '');
  const amountMinor = Number(entity.amount ?? 0);
  const currency = String(entity.currency ?? '');
  const status = String(entity.status ?? '');
  const ourOrderId = String(
    (entity.notes as Record<string, unknown> | undefined)?.order_id ?? '',
  );

  const db = serviceClient();

  // Find our order. Prefer the note we attached at creation; fall back to the
  // gateway order id in case an older order predates the note.
  let orderId = ourOrderId;
  if (!orderId && razorpayOrderId) {
    const { data } = await db
      .from('payment_orders')
      .select('id')
      .eq('provider_order_id', razorpayOrderId)
      .maybeSingle();
    orderId = data?.id ?? '';
  }

  // Idempotency: Razorpay retries until it gets a 2xx, and the browser handler
  // may already have settled this order. Record first; if the event id is
  // already there, this is a redelivery and there is nothing to do.
  if (eventId) {
    const { data: isNew } = await db.rpc('record_webhook_event', {
      p_event_id: eventId,
      p_event: event,
      p_order_id: orderId || null,
      p_payload: payload,
    });
    if (isNew === false) return json({ ok: true, duplicate: true });
  }

  if (!orderId) {
    // A payment we have no record of — log it and 200 so Razorpay stops
    // retrying, but never guess which user it belonged to.
    console.error('[payments] webhook for an unknown order', { razorpayOrderId, event });
    return json({ ok: true, ignored: 'unknown order' });
  }

  const { data: order } = await db
    .from('payment_orders')
    .select('user_id')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) return json({ ok: true, ignored: 'order not found' });

  if (event === 'payment.captured' || status === 'captured') {
    const { error } = await db.rpc('confirm_payment_order', {
      p_order_id: orderId,
      p_user_id: order.user_id,
      p_provider_order_id: razorpayOrderId,
      p_provider_payment_id: razorpayPaymentId,
      p_amount_paid: fromMinorUnits(amountMinor),
      p_currency: currency,
      p_payment_status: 'captured',
    });
    // Returning 500 asks Razorpay to retry, which is what we want for a
    // transient failure. The guards inside the function already make a genuine
    // duplicate a no-op.
    if (error) return fail('Could not apply the payment.', error, 500);
    return json({ ok: true, applied: true });
  }

  if (event === 'payment.failed') {
    await db.rpc('fail_payment_order', {
      p_order_id: orderId,
      p_user_id: order.user_id,
      p_reason: String(
        (entity.error_description as string | undefined) ?? 'The payment failed.',
      ),
    });
    return json({ ok: true, failed: true });
  }

  return json({ ok: true, ignored: event });
});
