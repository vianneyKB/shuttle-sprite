/// <reference lib="deno.ns" />
/**
 * POST /functions/v1/create-checkout-session
 *
 * Body: { "targetType": "booking" | "ride_request", "targetId": "<uuid>" }
 * Auth: the passenger's Supabase JWT (Authorization: Bearer …).
 *
 * The caller says *what* to pay for, never *how much*. We verify the JWT,
 * hand the resolved user id to start_payment(), and that RPC answers with the
 * amount stored on the row — so a tampered request can only ever pay the real
 * price of something the caller actually owns.
 *
 * Returns: { url, reference, provider }
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, fail, json, messageOf } from "../_shared/http.ts";
import { DEFAULT_PROVIDER, getProvider } from "../_shared/providers/index.ts";
import type { PaymentTargetType } from "../_shared/providers/index.ts";

const TARGET_TYPES: PaymentTargetType[] = ["booking", "ride_request"];

type StartPaymentRow = {
  target_type: PaymentTargetType;
  target_id: string;
  amount: number;
  currency: string;
  customer_email: string | null;
  customer_name: string | null;
  description: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return fail("Use POST", 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const providerName = Deno.env.get("PAYMENT_PROVIDER") ?? DEFAULT_PROVIDER;
  const callbackUrl = Deno.env.get("PAYMENT_CALLBACK_URL") ?? null;

  if (!supabaseUrl || !anonKey || !serviceKey) {
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

  // --- who is asking -------------------------------------------------------
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return fail("Sign in to pay", 401);

  const asCaller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await asCaller.auth.getUser();
  if (userError || !userData?.user) return fail("Sign in to pay", 401);

  // --- what are they paying for -------------------------------------------
  let body: { targetType?: string; targetId?: string };
  try {
    body = await req.json();
  } catch {
    return fail("Body must be JSON");
  }
  const targetType = body.targetType as PaymentTargetType;
  const targetId = body.targetId ?? "";
  if (!TARGET_TYPES.includes(targetType)) {
    return fail(`targetType must be one of: ${TARGET_TYPES.join(", ")}`);
  }
  if (!targetId) return fail("targetId is required");

  // --- reserve the reference and read the amount from the database ---------
  const reference = crypto.randomUUID();
  const asService = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data, error } = await asService.rpc("start_payment", {
    _user_id: userData.user.id,
    _target_type: targetType,
    _target_id: targetId,
    _provider: provider.name,
    _reference: reference,
  });
  if (error) return fail(error.message, 400);

  const payable = (Array.isArray(data) ? data[0] : data) as StartPaymentRow | undefined;
  if (!payable) return fail("Nothing to pay for", 404);

  const email = payable.customer_email ?? userData.user.email ?? "";
  if (!email) return fail("Add an email address to your profile before paying", 400);

  // --- hand off to the provider -------------------------------------------
  try {
    const session = await provider.createCheckout(
      {
        reference,
        amount: Number(payable.amount),
        currency: payable.currency,
        customerEmail: email,
        customerName: payable.customer_name,
        description: payable.description,
        targetType: payable.target_type,
        targetId: payable.target_id,
        callbackUrl,
      },
      secretKey,
    );
    return json({ url: session.url, reference: session.reference, provider: provider.name });
  } catch (error) {
    console.error("checkout failed", { provider: provider.name, reference, error });
    return fail(messageOf(error), 502);
  }
});
