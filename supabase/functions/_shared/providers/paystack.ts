/**
 * Paystack adapter.
 *
 * Docs: https://paystack.com/docs/api/transaction/#initialize
 *       https://paystack.com/docs/payments/webhooks/
 *
 * Paystack quotes amounts in the smallest currency unit and signs webhooks
 * with HMAC-SHA512 over the *raw* body using the same secret key as the API.
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

const API_BASE = "https://api.paystack.co";
const SIGNATURE_HEADER = "x-paystack-signature";

/** Exported for the unit tests: the exact JSON we post to /transaction/initialize. */
export const buildInitializeBody = (request: CheckoutRequest): Record<string, unknown> => {
  if (!request.customerEmail) {
    throw new Error("Paystack requires a customer email address");
  }
  const amount = toMinorUnits(request.amount, request.currency);
  if (amount <= 0) {
    throw new Error("Amount must be greater than zero");
  }
  return {
    email: request.customerEmail,
    amount,
    currency: (request.currency || "ZAR").toUpperCase(),
    reference: request.reference,
    ...(request.callbackUrl ? { callback_url: request.callbackUrl } : {}),
    metadata: {
      target_type: request.targetType,
      target_id: request.targetId,
      description: request.description,
      ...(request.customerName ? { customer_name: request.customerName } : {}),
    },
  };
};

/** Paystack hands metadata back as an object, or as a JSON string. Take either. */
const readMetadata = (raw: unknown): Record<string, unknown> => {
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
};

export const paystack: PaymentProvider = {
  name: "paystack",
  // One key does both jobs at Paystack: it signs API calls and webhooks.
  apiKeyEnv: "PAYSTACK_SECRET_KEY",
  webhookSecretEnv: "PAYSTACK_SECRET_KEY",
  signatureHeader: SIGNATURE_HEADER,

  async createCheckout(request, secretKey, fetchImpl = fetch): Promise<CheckoutSession> {
    if (!secretKey) throw new Error("PAYSTACK_SECRET_KEY is not configured");

    const response = await fetchImpl(`${API_BASE}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildInitializeBody(request)),
    });

    const payload = (await response.json().catch(() => null)) as {
      status?: boolean;
      message?: string;
      data?: { authorization_url?: string; access_code?: string; reference?: string };
    } | null;

    if (!response.ok || !payload?.status || !payload.data?.authorization_url) {
      throw new Error(payload?.message || `Paystack refused the checkout (HTTP ${response.status})`);
    }

    return {
      url: payload.data.authorization_url,
      reference: payload.data.reference ?? request.reference,
      providerId: payload.data.access_code ?? null,
    };
  },

  async verifySignature(rawBody, headers, secretKey): Promise<boolean> {
    if (!secretKey) throw new Error("PAYSTACK_SECRET_KEY is not configured");
    const provided = headers.get(SIGNATURE_HEADER);
    if (!provided) return false;
    return equalsConstantTime(provided, await hexHmac("SHA-512", secretKey, rawBody));
  },

  parseEvent(rawBody): PaymentEvent {
    let body: {
      event?: string;
      data?: {
        id?: number | string;
        reference?: string;
        amount?: number;
        currency?: string;
        status?: string;
        metadata?: unknown;
      };
    };
    try {
      body = JSON.parse(rawBody);
    } catch {
      throw new Error("Webhook body is not valid JSON");
    }

    const type = body.event ?? "unknown";
    const data = body.data ?? {};

    // charge.success is the only event that moves money into our account.
    if (type !== "charge.success" || data.status !== "success") {
      return { kind: "ignored", type };
    }
    if (!data.reference) {
      throw new Error("charge.success carried no reference");
    }

    const metadata = readMetadata(data.metadata);
    const targetType = metadata.target_type;

    return {
      kind: "payment_succeeded",
      reference: data.reference,
      amountMinor: Number(data.amount ?? 0),
      currency: (data.currency ?? "ZAR").toUpperCase(),
      providerId: data.id != null ? String(data.id) : null,
      targetType:
        targetType === "booking" || targetType === "ride_request"
          ? (targetType as PaymentTargetType)
          : null,
      targetId: typeof metadata.target_id === "string" ? metadata.target_id : null,
    };
  },
};
