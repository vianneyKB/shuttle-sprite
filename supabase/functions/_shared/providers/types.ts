/**
 * The payment provider seam.
 *
 * `create-checkout-session` and `payment-webhook` only ever talk to this
 * interface: adding a provider means adding one file and one entry in the
 * registry. A provider also declares which secrets it needs and which header
 * carries its webhook signature, so neither function builds an env-var name
 * out of a provider name.
 */

export type PaymentTargetType = "booking" | "ride_request";

/** Everything a checkout needs. The amount comes from the database, never the client. */
export type CheckoutRequest = {
  /** Our reference; the provider echoes it back on the webhook. */
  reference: string;
  /** Major units, as stored on the booking / ride request. */
  amount: number;
  /** ISO 4217, from the same row. */
  currency: string;
  customerEmail: string;
  customerName?: string | null;
  description: string;
  targetType: PaymentTargetType;
  targetId: string;
  /** Where the provider sends the passenger afterwards. Server-configured. */
  callbackUrl?: string | null;
};

export type CheckoutSession = {
  /** The hosted payment page to send the passenger to. */
  url: string;
  reference: string;
  /** The provider's own id for the transaction, when it gives one up front. */
  providerId: string | null;
};

/**
 * A webhook, normalised. Anything that is not a completed payment is
 * `ignored` — providers send a lot of events we have no opinion about.
 */
export type PaymentEvent =
  | {
      kind: "payment_succeeded";
      reference: string;
      /** Smallest currency unit, as the provider reports it. */
      amountMinor: number;
      currency: string;
      providerId: string | null;
      /**
       * What was being paid for, echoed back from the checkout metadata.
       * The reference alone is not enough: a passenger can finish an
       * abandoned checkout after starting a newer one, and by then the row
       * carries the newer reference.
       */
      targetType: PaymentTargetType | null;
      targetId: string | null;
    }
  | { kind: "ignored"; type: string };

export interface PaymentProvider {
  readonly name: string;
  /** Edge Function secret holding the API key used to create a checkout. */
  readonly apiKeyEnv: string;
  /**
   * Edge Function secret the webhook signature is verified against. The same
   * key as `apiKeyEnv` for Paystack; a separate endpoint secret for Stripe.
   */
  readonly webhookSecretEnv: string;
  /** Request header carrying the signature; how a webhook is attributed. */
  readonly signatureHeader: string;
  /** Create a hosted checkout and return its URL. */
  createCheckout(
    request: CheckoutRequest,
    secretKey: string,
    fetchImpl?: typeof fetch,
  ): Promise<CheckoutSession>;
  /** True when the raw body really came from the provider. */
  verifySignature(rawBody: string, headers: Headers, webhookSecret: string): Promise<boolean>;
  /** Normalise a verified raw body into a PaymentEvent. */
  parseEvent(rawBody: string): PaymentEvent;
}
