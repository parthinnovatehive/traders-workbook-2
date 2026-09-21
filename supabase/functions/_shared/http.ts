import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Shared HTTP plumbing for the payment functions.
 */

export const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/**
 * Never let a raw error reach the client: Razorpay errors and Postgres
 * exceptions can carry order ids, amounts and internal detail. Log the real one
 * server-side, return something safe.
 */
export const fail = (clientMessage: string, err: unknown, status = 400): Response => {
  console.error(`[payments] ${clientMessage}`, err);
  return json({ error: clientMessage }, status);
};

/** Service-role client. Bypasses RLS — only ever construct this server-side. */
export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * Resolve the caller from their Authorization header.
 *
 * The client cannot be trusted to say who it is — the user id comes from
 * verifying the JWT, never from the request body. Returns null when the token
 * is missing or invalid.
 */
export async function authenticate(req: Request): Promise<{ id: string; email?: string } | null> {
  const header = req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;

  const anon = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: header } }, auth: { persistSession: false } },
  );

  const { data, error } = await anon.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? undefined };
}
