/**
 * @vitest-environment node
 *
 * The Edge Functions themselves need Deno, but everything that decides what
 * gets charged and what a webhook means is plain TypeScript — so it is tested
 * here with the rest of the suite.
 */
import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { currencyDecimals, fromMinorUnits, toMinorUnits } from "../money.ts";
import { DEFAULT_PROVIDER, getProvider, providerFromHeaders } from "../providers/index.ts";
import { buildInitializeBody, paystack } from "../providers/paystack.ts";
import {
  buildCheckoutSessionFields,
  parseSignatureHeader,
  stripe,
  verifyStripeSignature,
} from "../providers/stripe.ts";
import type { CheckoutRequest } from "../providers/types.ts";

const request: CheckoutRequest = {
  reference: "b2c3d4e5-0000-4000-8000-000000000001",
  amount: 129.99,
  currency: "ZAR",
  customerEmail: "rider@example.com",
  customerName: "Thandi",
  description: "ShuttleBook booking 1a2b3c4d",
  targetType: "ride_request",
  targetId: "11111111-2222-4333-8444-555555555555",
  callbackUrl: "https://example.test/paid",
};

describe("minor units", () => {
  it("uses two decimals for ordinary currencies", () => {
    expect(currencyDecimals("ZAR")).toBe(2);
    expect(toMinorUnits(12.5, "ZAR")).toBe(1250);
    expect(toMinorUnits(129.99, "NGN")).toBe(12999);
  });

  it("uses none for zero-decimal currencies Paystack settles in", () => {
    expect(currencyDecimals("XOF")).toBe(0);
    expect(toMinorUnits(1500, "XOF")).toBe(1500);
    expect(toMinorUnits(1000, "JPY")).toBe(1000);
  });

  it("uses three for the Gulf currencies", () => {
    expect(toMinorUnits(1.234, "KWD")).toBe(1234);
  });

  it("rounds rather than truncating, so no cent is lost", () => {
    expect(toMinorUnits(0.005, "ZAR")).toBe(1);
    expect(toMinorUnits(19.999, "ZAR")).toBe(2000);
  });

  it("falls back to the platform currency and is case-insensitive", () => {
    expect(toMinorUnits(10, undefined)).toBe(1000);
    expect(toMinorUnits(10, "jpy")).toBe(10);
  });

  it("round-trips", () => {
    expect(fromMinorUnits(toMinorUnits(129.99, "ZAR"), "ZAR")).toBe(129.99);
    expect(fromMinorUnits(toMinorUnits(1500, "XOF"), "XOF")).toBe(1500);
  });

  it("refuses a non-numeric amount", () => {
    expect(() => toMinorUnits(Number.NaN, "ZAR")).toThrow();
  });
});

describe("provider registry", () => {
  it("defaults to Paystack and is case-insensitive", () => {
    expect(getProvider().name).toBe(DEFAULT_PROVIDER);
    expect(getProvider("PayStack").name).toBe("paystack");
    expect(getProvider(null).name).toBe("paystack");
  });

  it("has an adapter for Stripe", () => {
    expect(getProvider("stripe").name).toBe("stripe");
    expect(getProvider(" Stripe ").name).toBe("stripe");
  });

  it("refuses a provider it has no adapter for", () => {
    expect(() => getProvider("worldpay")).toThrow(/Unknown payment provider/);
  });

  it("attributes a webhook by the signature header it arrives with", () => {
    expect(providerFromHeaders(new Headers({ "x-paystack-signature": "abc" }))?.name).toBe(
      "paystack",
    );
    expect(providerFromHeaders(new Headers({ "stripe-signature": "t=1,v1=abc" }))?.name).toBe(
      "stripe",
    );
    // No known header: the caller falls back to PAYMENT_PROVIDER.
    expect(providerFromHeaders(new Headers())).toBeNull();
    expect(providerFromHeaders(new Headers({ "x-other-signature": "abc" }))).toBeNull();
  });

  it("names the secrets each provider needs", () => {
    expect(getProvider("paystack")).toMatchObject({
      apiKeyEnv: "PAYSTACK_SECRET_KEY",
      // Paystack signs webhooks with the same key as the API.
      webhookSecretEnv: "PAYSTACK_SECRET_KEY",
    });
    expect(getProvider("stripe")).toMatchObject({
      apiKeyEnv: "STRIPE_SECRET_KEY",
      webhookSecretEnv: "STRIPE_WEBHOOK_SECRET",
    });
  });
});

describe("paystack checkout body", () => {
  it("sends the amount in minor units with our reference and target metadata", () => {
    expect(buildInitializeBody(request)).toEqual({
      email: "rider@example.com",
      amount: 12999,
      currency: "ZAR",
      reference: request.reference,
      callback_url: "https://example.test/paid",
      metadata: {
        target_type: "ride_request",
        target_id: request.targetId,
        description: request.description,
        customer_name: "Thandi",
      },
    });
  });

  it("omits the callback when none is configured", () => {
    const body = buildInitializeBody({ ...request, callbackUrl: null });
    expect(body).not.toHaveProperty("callback_url");
  });

  it("refuses a zero amount or a missing email", () => {
    expect(() => buildInitializeBody({ ...request, amount: 0 })).toThrow(/greater than zero/);
    expect(() => buildInitializeBody({ ...request, customerEmail: "" })).toThrow(/email/);
  });

  it("returns the hosted URL and fails loudly when Paystack says no", async () => {
    const ok = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: true,
          data: { authorization_url: "https://checkout.paystack.com/abc", access_code: "abc" },
        }),
        { status: 200 },
      ),
    );
    await expect(paystack.createCheckout(request, "sk_test", ok)).resolves.toEqual({
      url: "https://checkout.paystack.com/abc",
      reference: request.reference,
      providerId: "abc",
    });

    const refused = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: false, message: "Invalid key" }), { status: 401 }),
    );
    await expect(paystack.createCheckout(request, "sk_test", refused)).rejects.toThrow("Invalid key");
  });
});

describe("paystack webhook", () => {
  const secret = "sk_test_secret";
  const sign = (body: string) => createHmac("sha512", secret).update(body).digest("hex");

  const charge = JSON.stringify({
    event: "charge.success",
    data: {
      id: 302961,
      reference: request.reference,
      amount: 12999,
      currency: "ZAR",
      status: "success",
      metadata: { target_type: "ride_request", target_id: request.targetId },
    },
  });

  it("accepts a body signed with the secret key", async () => {
    const headers = new Headers({ "x-paystack-signature": sign(charge) });
    await expect(paystack.verifySignature(charge, headers, secret)).resolves.toBe(true);
  });

  it("rejects a tampered body, a wrong key and a missing header", async () => {
    const headers = new Headers({ "x-paystack-signature": sign(charge) });
    const tampered = charge.replace("12999", "1");
    await expect(paystack.verifySignature(tampered, headers, secret)).resolves.toBe(false);
    await expect(paystack.verifySignature(charge, headers, "sk_other")).resolves.toBe(false);
    await expect(paystack.verifySignature(charge, new Headers(), secret)).resolves.toBe(false);
  });

  it("normalises a successful charge, carrying the target through", () => {
    expect(paystack.parseEvent(charge)).toEqual({
      kind: "payment_succeeded",
      reference: request.reference,
      amountMinor: 12999,
      currency: "ZAR",
      providerId: "302961",
      targetType: "ride_request",
      targetId: request.targetId,
    });
  });

  it("reads metadata whether Paystack sends it as an object or a string", () => {
    const stringified = JSON.stringify({
      event: "charge.success",
      data: {
        reference: "abc12345",
        amount: 100,
        currency: "ZAR",
        status: "success",
        metadata: JSON.stringify({ target_type: "booking", target_id: request.targetId }),
      },
    });
    const event = paystack.parseEvent(stringified);
    expect(event).toMatchObject({ targetType: "booking", targetId: request.targetId });
  });

  it("leaves the target null when metadata is missing or unrecognised", () => {
    const bare = JSON.stringify({
      event: "charge.success",
      data: { reference: "abc12345", amount: 100, currency: "ZAR", status: "success" },
    });
    const bogus = JSON.stringify({
      event: "charge.success",
      data: {
        reference: "abc12345",
        amount: 100,
        currency: "ZAR",
        status: "success",
        metadata: { target_type: "invoice", target_id: 7 },
      },
    });
    expect(paystack.parseEvent(bare)).toMatchObject({ targetType: null, targetId: null });
    expect(paystack.parseEvent(bogus)).toMatchObject({ targetType: null, targetId: null });
  });

  it("ignores everything that is not money arriving", () => {
    const failed = JSON.stringify({ event: "charge.failed", data: { status: "failed" } });
    const transfer = JSON.stringify({ event: "transfer.success", data: { status: "success" } });
    expect(paystack.parseEvent(failed)).toEqual({ kind: "ignored", type: "charge.failed" });
    expect(paystack.parseEvent(transfer)).toEqual({ kind: "ignored", type: "transfer.success" });
  });

  it("throws on a body it cannot read or a charge with no reference", () => {
    expect(() => paystack.parseEvent("not json")).toThrow(/valid JSON/);
    const noRef = JSON.stringify({ event: "charge.success", data: { status: "success", amount: 1 } });
    expect(() => paystack.parseEvent(noRef)).toThrow(/no reference/);
  });
});

describe("stripe checkout body", () => {
  it("sends an inline one-line price in minor units with our reference", () => {
    expect(buildCheckoutSessionFields(request)).toEqual({
      mode: "payment",
      client_reference_id: request.reference,
      customer_email: "rider@example.com",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "zar",
      "line_items[0][price_data][unit_amount]": "12999",
      "line_items[0][price_data][product_data][name]": request.description,
      "metadata[reference]": request.reference,
      "metadata[target_type]": "ride_request",
      "metadata[target_id]": request.targetId,
      "metadata[customer_name]": "Thandi",
      success_url: "https://example.test/paid?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://example.test/paid",
    });
  });

  it("keeps an existing query string on the return URL", () => {
    const fields = buildCheckoutSessionFields({
      ...request,
      callbackUrl: "https://example.test/paid?from=app",
    });
    expect(fields.success_url).toBe(
      "https://example.test/paid?from=app&session_id={CHECKOUT_SESSION_ID}",
    );
  });

  it("omits the return URLs when none is configured", () => {
    const fields = buildCheckoutSessionFields({ ...request, callbackUrl: null });
    expect(fields).not.toHaveProperty("success_url");
    expect(fields).not.toHaveProperty("cancel_url");
  });

  it("charges whole units for a zero-decimal currency", () => {
    const fields = buildCheckoutSessionFields({ ...request, amount: 1500, currency: "XOF" });
    expect(fields["line_items[0][price_data][unit_amount]"]).toBe("1500");
    expect(fields["line_items[0][price_data][currency]"]).toBe("xof");
  });

  it("refuses a zero amount or a missing email", () => {
    expect(() => buildCheckoutSessionFields({ ...request, amount: 0 })).toThrow(
      /greater than zero/,
    );
    expect(() => buildCheckoutSessionFields({ ...request, customerEmail: "" })).toThrow(/email/);
  });

  it("posts form-encoded with an idempotency key and returns the hosted URL", async () => {
    const ok = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "cs_test_123",
          url: "https://checkout.stripe.com/c/pay/cs_test_123",
          payment_intent: "pi_test_456",
          client_reference_id: request.reference,
        }),
        { status: 200 },
      ),
    );
    await expect(stripe.createCheckout(request, "sk_test", ok)).resolves.toEqual({
      url: "https://checkout.stripe.com/c/pay/cs_test_123",
      reference: request.reference,
      providerId: "pi_test_456",
    });

    const [url, init] = ok.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.stripe.com/v1/checkout/sessions");
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(headers["Idempotency-Key"]).toBe(request.reference);
    expect(new URLSearchParams(init.body as string).get("client_reference_id")).toBe(
      request.reference,
    );
  });

  it("falls back to the session id when the intent is not expanded yet", async () => {
    const ok = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "cs_1", url: "https://checkout.stripe.com/c/pay/cs_1" }), {
        status: 200,
      }),
    );
    await expect(stripe.createCheckout(request, "sk_test", ok)).resolves.toMatchObject({
      providerId: "cs_1",
      reference: request.reference,
    });
  });

  it("surfaces Stripe's own message when it says no", async () => {
    const refused = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "No such price" } }), { status: 400 }),
    );
    await expect(stripe.createCheckout(request, "sk_test", refused)).rejects.toThrow(
      "No such price",
    );
    await expect(stripe.createCheckout(request, "", vi.fn())).rejects.toThrow(
      /STRIPE_SECRET_KEY/,
    );
  });
});

describe("stripe webhook signature", () => {
  const secret = "whsec_test_secret";
  const now = 1_700_000_000;
  const body = JSON.stringify({ type: "checkout.session.completed" });
  const sign = (timestamp: number, raw: string) =>
    createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");

  it("reads the timestamp and every v1 digest offered", () => {
    expect(parseSignatureHeader("t=1700,v1=aaa,v1=bbb,v0=ccc")).toEqual({
      timestamp: 1700,
      signatures: ["aaa", "bbb"],
    });
    expect(parseSignatureHeader(null)).toEqual({ timestamp: null, signatures: [] });
    // A digest with no timestamp cannot be verified; verify treats it as unsigned.
    expect(parseSignatureHeader("v1=aaa")).toEqual({ timestamp: null, signatures: ["aaa"] });
  });

  it("accepts a body signed within the tolerance window", async () => {
    const header = `t=${now},v1=${sign(now, body)}`;
    await expect(verifyStripeSignature(body, header, secret, now)).resolves.toBe(true);
    await expect(verifyStripeSignature(body, header, secret, now + 120)).resolves.toBe(true);
  });

  it("accepts either digest while an endpoint secret is being rolled", async () => {
    const header = `t=${now},v1=${"0".repeat(64)},v1=${sign(now, body)}`;
    await expect(verifyStripeSignature(body, header, secret, now)).resolves.toBe(true);
  });

  it("rejects a tampered body, a wrong secret and a missing header", async () => {
    const header = `t=${now},v1=${sign(now, body)}`;
    await expect(verifyStripeSignature(`${body} `, header, secret, now)).resolves.toBe(false);
    await expect(verifyStripeSignature(body, header, "whsec_other", now)).resolves.toBe(false);
    await expect(verifyStripeSignature(body, null, secret, now)).resolves.toBe(false);
    await expect(verifyStripeSignature(body, `v1=${sign(now, body)}`, secret, now)).resolves.toBe(
      false,
    );
  });

  it("rejects a replay of an old payload even though the digest is right", async () => {
    const header = `t=${now},v1=${sign(now, body)}`;
    await expect(verifyStripeSignature(body, header, secret, now + 301)).resolves.toBe(false);
    // And a timestamp from the future, which is the same forgery backwards.
    await expect(verifyStripeSignature(body, header, secret, now - 301)).resolves.toBe(false);
  });

  it("refuses to verify at all without the endpoint secret", async () => {
    await expect(verifyStripeSignature(body, `t=${now},v1=x`, "", now)).rejects.toThrow(
      /STRIPE_WEBHOOK_SECRET/,
    );
  });

  it("verifies through the adapter, reading the header itself", async () => {
    const stamp = Math.floor(Date.now() / 1000);
    const headers = new Headers({ "stripe-signature": `t=${stamp},v1=${sign(stamp, body)}` });
    await expect(stripe.verifySignature(body, headers, secret)).resolves.toBe(true);
    await expect(stripe.verifySignature(body, new Headers(), secret)).resolves.toBe(false);
  });
});

describe("stripe webhook events", () => {
  const session = (over: Record<string, unknown> = {}, type = "checkout.session.completed") =>
    JSON.stringify({
      type,
      data: {
        object: {
          id: "cs_test_123",
          object: "checkout.session",
          amount_total: 12999,
          currency: "zar",
          payment_status: "paid",
          status: "complete",
          client_reference_id: request.reference,
          payment_intent: "pi_test_456",
          metadata: {
            reference: request.reference,
            target_type: "ride_request",
            target_id: request.targetId,
          },
          ...over,
        },
      },
    });

  it("normalises a completed session, carrying the target through", () => {
    expect(stripe.parseEvent(session())).toEqual({
      kind: "payment_succeeded",
      reference: request.reference,
      amountMinor: 12999,
      // Stripe quotes currency in lower case; mark_payment_paid compares upper.
      currency: "ZAR",
      providerId: "pi_test_456",
      targetType: "ride_request",
      targetId: request.targetId,
    });
  });

  it("settles a bank debit that cleared later", () => {
    expect(
      stripe.parseEvent(session({}, "checkout.session.async_payment_succeeded")),
    ).toMatchObject({ kind: "payment_succeeded", reference: request.reference });
  });

  it("takes the expanded payment intent, falling back to the session id", () => {
    expect(stripe.parseEvent(session({ payment_intent: { id: "pi_expanded" } }))).toMatchObject({
      providerId: "pi_expanded",
    });
    expect(stripe.parseEvent(session({ payment_intent: null }))).toMatchObject({
      providerId: "cs_test_123",
    });
  });

  it("reads the reference from metadata when there is no client_reference_id", () => {
    expect(stripe.parseEvent(session({ client_reference_id: null }))).toMatchObject({
      reference: request.reference,
    });
  });

  it("leaves the target null when metadata is missing or unrecognised", () => {
    expect(stripe.parseEvent(session({ metadata: { reference: "abc12345" } }))).toMatchObject({
      targetType: null,
      targetId: null,
    });
    expect(
      stripe.parseEvent(
        session({ metadata: { reference: "abc12345", target_type: "invoice", target_id: 7 } }),
      ),
    ).toMatchObject({ targetType: null, targetId: null });
  });

  it("ignores a completed session that has not been paid, and other events", () => {
    expect(stripe.parseEvent(session({ payment_status: "unpaid" }))).toEqual({
      kind: "ignored",
      type: "checkout.session.completed",
    });
    expect(stripe.parseEvent(session({}, "checkout.session.expired"))).toEqual({
      kind: "ignored",
      type: "checkout.session.expired",
    });
    expect(
      stripe.parseEvent(JSON.stringify({ type: "payment_intent.succeeded", data: { object: {} } })),
    ).toEqual({ kind: "ignored", type: "payment_intent.succeeded" });
  });

  it("throws on a body it cannot read or a paid session with no reference", () => {
    expect(() => stripe.parseEvent("not json")).toThrow(/valid JSON/);
    expect(() => stripe.parseEvent(session({ client_reference_id: null, metadata: {} }))).toThrow(
      /no reference/,
    );
  });
});
