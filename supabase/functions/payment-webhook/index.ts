/// <reference lib="deno.ns" />
/**
 * POST /functions/v1/payment-webhook
 *
 * Called by the payment provider, not by the app, so there is no JWT
 * (verify_jwt = false in supabase/config.toml). The provider signature over
 * the raw body is the only thing that authenticates this request — read the
 * body as text and verify before parsing anything.
 *
 * A verified charge flips payment_status to 'paid' via mark_payment_paid(),
 * which re-checks the amount against the row and is idempotent on retries.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { fail, json, messageOf } from "../_shared/http.ts";
import { DEFAULT_PROVIDER, getProvider } from "../_shared/providers/index.ts";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return fail("Use POST", 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const providerName = Deno.env.get("PAYMENT_PROVIDER") ?? DEFAULT_PROVIDER;

  if (!supabaseUrl || !serviceKey) {
    return fail("Payments are not configured on this project", 500);
  }

  let provider;
  let secretKey: string;
  try {
    provider = getProvider(providerName);
    secretKey = Deno.env.get(`${provider.name.toUpperCase()}_SECRET_KEY`) ?? "";
  } catch (error) {
    return fail(messageOf(error), 500);
  }
  if (!secretKey) {
    return fail(`${provider.name.toUpperCase()}_SECRET_KEY is not set`, 500);
  }

  const rawBody = await req.text();

  if (!(await provider.verifySignature(rawBody, req.headers, secretKey))) {
    console.warn("rejected webhook with a bad signature", { provider: provider.name });
    return fail("Invalid signature", 401);
  }

  let event;
  try {
    event = provider.parseEvent(rawBody);
  } catch (error) {
    return fail(messageOf(error), 400);
  }

  if (event.kind === "ignored") {
    // 200 or the provider will keep retrying an event we will never act on.
    return json({ ignored: event.type });
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("mark_payment_paid", {
    _provider: provider.name,
    _reference: event.reference,
    _amount_minor: event.amountMinor,
    _currency: event.currency,
    _target_type: event.targetType,
    _target_id: event.targetId,
  });

  if (error) {
    console.error("could not settle payment", {
      provider: provider.name,
      reference: event.reference,
      error: error.message,
    });
    // 4xx: retrying will not help — the amount or the reference is wrong.
    return fail(error.message, 422);
  }

  const settled = (Array.isArray(data) ? data[0] : data) as
    | { target_type: string; target_id: string; already_paid: boolean }
    | undefined;

  console.log("payment settled", { provider: provider.name, reference: event.reference, settled });
  return json({ ok: true, ...settled });
});
