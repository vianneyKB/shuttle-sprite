/**
 * Stripe adapter.
 *
 * Docs: https://docs.stripe.com/api/checkout/sessions/create
 *       https://docs.stripe.com/webhooks/signature
 *
 * Two things differ from Paystack and both live here, not in the callers:
 *
 *  - the API is form-encoded, not JSON, and amounts are `unit_amount` in the
 *    currency's smallest unit on a one-line inline price;
 *  - webhooks are signed with a *separate* endpoint secret (whsec_…) as
 *    HMAC-SHA256 over `"<timestamp>.<raw body>"`, and the timestamp is part
 *    of the signature, so a captured body cannot be replayed indefinitely.
 */

import { equalsConstantTime, hexHmac } from "../crypto.ts";
import { toMinorUnits } from "../money.ts";
import type {
  CheckoutRequest,
  CheckoutSession,
  PaymentEvent,
  PaymentProvider,
  PaymentTargetType,
} from "./types.ts";

const API_BASE = "https://api.stripe.com/v1";
const SIGNATURE_HEADER = "stripe-signature";

/** How old a signed payload may be. Stripe's own default. */
export const SIGNATURE_TOLERANCE_SECONDS = 300;

/**
 * Exported for the unit tests: the exact form fields we post to
 * /checkout/sessions. Flat keys with Stripe's bracket syntax — the shape the
 * API expects once URL-encoded.
 */
export const buildCheckoutSessionFields = (request: CheckoutRequest): Record<string, string> => {
  if (!request.customerEmail) {
    throw new Error("Stripe requires a customer email address");
  }
  const amount = toMinorUnits(request.amount, request.currency);
  if (amount <= 0) {
    throw new Error("Amount must be greater than zero");
  }

  const fields: Record<string, string> = {
    mode: "payment",
    // Echoed back on the session, and what the webhook matches on.
    client_reference_id: request.reference,
    customer_email: request.customerEmail,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": (request.currency || "ZAR").toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(amount),
    "line_items[0][price_data][product_data][name]": request.description,
    "metadata[reference]": request.reference,
    "metadata[target_type]": request.targetType,
    "metadata[target_id]": request.targetId,
  };
  if (request.customerName) {
    fields["metadata[customer_name]"] = request.customerName;
  }
  if (request.callbackUrl) {
    // Stripe appends nothing by default; ask for the session id so the app can
    // show "we are confirming your payment" while the webhook lands.
    const sep = request.callbackUrl.includes("?") ? "&" : "?";
    fields.success_url = `${request.callbackUrl}${sep}session_id={CHECKOUT_SESSION_ID}`;
    fields.cancel_url = request.callbackUrl;
  }
  return fields;
};

/** `t=1699,v1=abc,v1=def` → the timestamp and every v1 digest offered. */
export const parseSignatureHeader = (
  header: string | null,
): { timestamp: number | null; signatures: string[] } => {
  const signatures: string[] = [];
  let timestamp: number | null = null;
  for (const part of (header ?? "").split(",")) {
    const [key, value] = part.split("=", 2);
    if (!key || value === undefined) continue;
    if (key.trim() === "t") {
      const parsed = Number(value.trim());
      timestamp = Number.isFinite(parsed) ? parsed : null;
    } else if (key.trim() === "v1") {
      signatures.push(value.trim());
    }
  }
  return { timestamp, signatures };
};

/**
 * Exported so the tests can pin "now": the tolerance window is the only part
 * of verification that depends on the clock.
 */
export const verifyStripeSignature = async (
  rawBody: string,
  header: string | null,
  webhookSecret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<boolean> => {
  if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  const { timestamp, signatures } = parseSignatureHeader(header);
  if (timestamp === null || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const expected = await hexHmac("SHA-256", webhookSecret, `${timestamp}.${rawBody}`);
  // Stripe sends several v1 digests while an endpoint secret is being rolled.
  return signatures.some((candidate) => equalsConstantTime(candidate, expected));
};

/** Stripe metadata values are always strings; take a uuid, ignore anything else. */
const readMetadata = (raw: unknown): Record<string, unknown> =>
  raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

/** `payment_intent` is an id, or the expanded object. Either way we want the id. */
const idOf = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "string") return id;
  }
  return null;
};

/** The events on which money has actually arrived. */
const PAID_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

export const stripe: PaymentProvider = {
  name: "stripe",
  apiKeyEnv: "STRIPE_SECRET_KEY",
  webhookSecretEnv: "STRIPE_WEBHOOK_SECRET",
  signatureHeader: SIGNATURE_HEADER,

  async createCheckout(request, secretKey, fetchImpl = fetch): Promise<CheckoutSession> {
    if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not configured");

    const response = await fetchImpl(`${API_BASE}/checkout/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        // A retried POST must not leave the passenger with two sessions.
        "Idempotency-Key": request.reference,
      },
      body: new URLSearchParams(buildCheckoutSessionFields(request)).toString(),
    });

    const payload = (await response.json().catch(() => null)) as {
      id?: string;
      url?: string | null;
      payment_intent?: unknown;
      client_reference_id?: string | null;
      error?: { message?: string };
    } | null;

    if (!response.ok || !payload?.url) {
      throw new Error(
        payload?.error?.message || `Stripe refused the checkout (HTTP ${response.status})`,
      );
    }

    return {
      url: payload.url,
      reference: payload.client_reference_id ?? request.reference,
      providerId: idOf(payload.payment_intent) ?? payload.id ?? null,
    };
  },

  verifySignature(rawBody, headers, webhookSecret): Promise<boolean> {
    return verifyStripeSignature(rawBody, headers.get(SIGNATURE_HEADER), webhookSecret);
  },

  parseEvent(rawBody): PaymentEvent {
    let body: {
      type?: string;
      data?: {
        object?: {
          id?: string;
          object?: string;
          amount_total?: number | null;
          currency?: string | null;
          payment_status?: string;
          status?: string;
          client_reference_id?: string | null;
          payment_intent?: unknown;
          metadata?: unknown;
        };
      };
    };
    try {
      body = JSON.parse(rawBody);
    } catch {
      throw new Error("Webhook body is not valid JSON");
    }

    const type = body.type ?? "unknown";
    const session = body.data?.object ?? {};

    // A completed session can still be unpaid: bank debits settle later and
    // arrive as async_payment_succeeded.
    if (!PAID_EVENTS.has(type) || session.payment_status !== "paid") {
      return { kind: "ignored", type };
    }

    const metadata = readMetadata(session.metadata);
    const reference =
      session.client_reference_id ??
      (typeof metadata.reference === "string" ? metadata.reference : null);
    if (!reference) {
      throw new Error(`${type} carried no reference`);
    }

    const targetType = metadata.target_type;

    return {
      kind: "payment_succeeded",
      reference,
      amountMinor: Number(session.amount_total ?? 0),
      currency: (session.currency ?? "ZAR").toUpperCase(),
      providerId: idOf(session.payment_intent) ?? session.id ?? null,
      targetType:
        targetType === "booking" || targetType === "ride_request"
          ? (targetType as PaymentTargetType)
          : null,
      targetId: typeof metadata.target_id === "string" ? metadata.target_id : null,
    };
  },
};
