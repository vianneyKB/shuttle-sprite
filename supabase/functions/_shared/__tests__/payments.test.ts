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
import { DEFAULT_PROVIDER, getProvider } from "../providers/index.ts";
import { buildInitializeBody, paystack } from "../providers/paystack.ts";
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

  it("refuses a provider it has no adapter for", () => {
    expect(() => getProvider("stripe")).toThrow(/Unknown payment provider/);
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
