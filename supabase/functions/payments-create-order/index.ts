import { authenticate, corsHeaders, fail, json, serviceClient } from '../_shared/http.ts';
import { createRazorpayOrder, toMinorUnits } from '../_shared/razorpay.ts';

/**
 * POST /payments-create-order   { planId }
 *
 * Opens an order. Two things the browser is NOT allowed to decide:
 *
 *   - who it is       -> taken from the verified JWT, not the body
 *   - what it costs   -> read from `plans` inside create_payment_order
 *
 * So the entire request body is one plan id. Nothing else it could send would
 * change the price or the owner.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const user = await authenticate(req);
  if (!user) return json({ error: 'You are not signed in.' }, 401);

  let planId: unknown;
  try {
    ({ planId } = await req.json());
  } catch (err) {
    return fail('Malformed request.', err);
  }
  if (typeof planId !== 'string' || !planId) {
    return json({ error: 'A plan is required.' }, 400);
  }

  const db = serviceClient();

  // 1. Our own order first, priced from `plans`. If anything downstream fails
  //    we are left with an unpaid 'created' row, which is harmless.
  const { data: order, error: orderError } = await db.rpc('create_payment_order', {
    p_user_id: user.id,
    p_plan_id: planId,
    p_provider: 'razorpay',
  });
  if (orderError || !order) return fail('Could not start the checkout.', orderError);

  // 2. The matching Razorpay order. Amount comes from OUR row, converted to
  //    paise — never from the request.
  try {
    const rzp = await createRazorpayOrder({
      amountMinor: toMinorUnits(Number(order.amount)),
      currency: order.currency,
      receipt: order.id,
      notes: { order_id: order.id, user_id: user.id, plan_id: order.plan_id },
    });

    const { data: linked, error: linkError } = await db.rpc('attach_provider_order', {
      p_order_id: order.id,
      p_provider_order_id: rzp.id,
    });
    if (linkError) return fail('Could not start the checkout.', linkError);

    return json({
      order: linked,
      // Publishable id, safe in a response. The secret never leaves this runtime.
      keyId: Deno.env.get('RAZORPAY_KEY_ID'),
    });
  } catch (err) {
    // Close our row so the user's history does not fill with phantom pending
    // orders when the gateway is unreachable.
    await db.rpc('fail_payment_order', {
      p_order_id: order.id,
      p_user_id: user.id,
      p_reason: 'Could not reach the payment gateway.',
    });
    return fail('The payment gateway is unavailable. Please try again.', err, 502);
  }
});
