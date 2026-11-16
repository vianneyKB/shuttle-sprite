/**
 * Provider registry. One entry per provider; no caller names a provider in
 * code. A checkout uses the provider the database resolved for the operator
 * (start_payment returns it), and a webhook is attributed by the signature
 * header it arrives with.
 */

import { paystack } from "./paystack.ts";
import { stripe } from "./stripe.ts";
import type { PaymentProvider } from "./types.ts";

/** Used for an operator with no settings row, and as the webhook fallback. */
export const DEFAULT_PROVIDER = "paystack";

const REGISTRY: Record<string, PaymentProvider> = {
  [paystack.name]: paystack,
  [stripe.name]: stripe,
};

export const providerNames = (): string[] => Object.keys(REGISTRY);

export const getProvider = (name?: string | null): PaymentProvider => {
  const key = (name || DEFAULT_PROVIDER).trim().toLowerCase();
  const provider = REGISTRY[key];
  if (!provider) {
    throw new Error(`Unknown payment provider "${key}" (have: ${providerNames().join(", ")})`);
  }
  return provider;
};

/**
 * Which provider sent this webhook. Each one signs with its own header, so the
 * header identifies the sender — and the signature check that follows, against
 * that provider's own secret, is what proves it.
 */
export const providerFromHeaders = (headers: Headers): PaymentProvider | null => {
  for (const provider of Object.values(REGISTRY)) {
    if (headers.get(provider.signatureHeader)) return provider;
  }
  return null;
};

export type { CheckoutRequest, CheckoutSession, PaymentEvent, PaymentProvider, PaymentTargetType } from "./types.ts";
