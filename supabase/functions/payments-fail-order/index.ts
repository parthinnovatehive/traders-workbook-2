import { authenticate, corsHeaders, fail, json, serviceClient } from '../_shared/http.ts';

/**
 * POST /payments-fail-order   { orderId, reason }
 *
 * Closes an order the user abandoned or that the gateway declined, so their
 * billing history does not accumulate rows stuck on "Pending".
 *
 * Grants nothing and can only ever move an order from `created` to `failed`,
 * for the caller's own order — the SQL function checks the user id. Worst case
 * for a malicious caller is marking their own pending order as failed, which
 * costs them a click.
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
  if (!orderId) return json({ error: 'An order is required.' }, 400);

  const reason = String(body.reason ?? 'Payment was not completed.').slice(0, 500);

  const db = serviceClient();
  const { data, error } = await db.rpc('fail_payment_order', {
    p_order_id: orderId,
    p_user_id: user.id,
    p_reason: reason,
  });

  if (error) return fail('Could not close that order.', error);
  return json({ order: data });
});
