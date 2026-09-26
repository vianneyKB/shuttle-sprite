/**
 * Provider registry. One entry per provider; callers never name a provider
 * in code, they read PAYMENT_PROVIDER from the environment.
 */

import { paystack } from "./paystack.ts";
import type { PaymentProvider } from "./types.ts";

export const DEFAULT_PROVIDER = "paystack";

const REGISTRY: Record<string, PaymentProvider> = {
  [paystack.name]: paystack,
  // Stripe lands here in #45.
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

export type { CheckoutRequest, CheckoutSession, PaymentEvent, PaymentProvider, PaymentTargetType } from "./types.ts";
