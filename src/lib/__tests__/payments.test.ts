import { describe, expect, it } from "vitest";
import {
  canPayNow,
  checkoutErrorMessage,
  payNowLabel,
  paymentReturnMessage,
  readPaymentReturn,
  stripPaymentReturn,
} from "../payments";

describe("canPayNow", () => {
  it("offers a checkout for a prepay ride that still owes money", () => {
    expect(
      canPayNow({ paymentMethod: "prepay", paymentStatus: "pending", totalPrice: 62.1, status: "awaiting" })
    ).toBe(true);
    // An unpaid prepay booking stays payable after the operator confirms it.
    expect(
      canPayNow({ paymentMethod: "prepay", paymentStatus: "pending", totalPrice: 480, status: "confirmed" })
    ).toBe(true);
  });

  it("refuses exactly what start_payment refuses", () => {
    const base = { paymentMethod: "prepay", paymentStatus: "pending", totalPrice: 100 } as const;
    expect(canPayNow({ ...base, paymentMethod: "cash" })).toBe(false);
    expect(canPayNow({ ...base, paymentStatus: "paid" })).toBe(false);
    expect(canPayNow({ ...base, paymentStatus: "not_required" })).toBe(false);
    expect(canPayNow({ ...base, totalPrice: 0 })).toBe(false);
    expect(canPayNow({ ...base, totalPrice: undefined })).toBe(false);
    expect(canPayNow({ ...base, status: "cancelled" })).toBe(false);
  });
});

describe("payNowLabel", () => {
  it("shows the amount before the passenger leaves the app", () => {
    // formatMoney picks the runtime locale, so assert on the money, not the separators.
    expect(payNowLabel(1234.5, "USD")).toMatch(/^Pay \D*1\D?234[.,]50$/);
  });

  it("falls back to a plain label when there is no amount to show", () => {
    expect(payNowLabel(undefined, "ZAR")).toBe("Pay now");
    expect(payNowLabel(0, "ZAR")).toBe("Pay now");
  });
});

describe("readPaymentReturn", () => {
  it("takes either key Paystack sends, preferring reference", () => {
    expect(readPaymentReturn("?reference=abc-123&trxref=abc-123")).toEqual({
      reference: "abc-123",
      claim: "unknown",
    });
    expect(readPaymentReturn("?trxref=only-this")).toEqual({
      reference: "only-this",
      claim: "unknown",
    });
  });

  it("reads an explicit success or cancel flag from our own return URL", () => {
    expect(readPaymentReturn("?payment=cancelled")).toEqual({ claim: "cancelled" });
    expect(readPaymentReturn("?payment=canceled")).toEqual({ claim: "cancelled" });
    expect(readPaymentReturn("?payment=success&reference=abc-123")).toEqual({
      reference: "abc-123",
      claim: "paid",
    });
  });

  it("is null on an ordinary visit", () => {
    expect(readPaymentReturn("")).toBeNull();
    expect(readPaymentReturn("?tab=rides")).toBeNull();
    expect(readPaymentReturn("?payment=")).toBeNull();
  });
});

describe("stripPaymentReturn", () => {
  it("clears the payment keys and keeps everything else", () => {
    expect(stripPaymentReturn("?reference=abc&trxref=abc&payment=success")).toBe("");
    expect(stripPaymentReturn("?tab=rides&reference=abc")).toBe("?tab=rides");
    expect(stripPaymentReturn("")).toBe("");
  });
});

describe("paymentReturnMessage", () => {
  it("only claims success when the row says paid", () => {
    expect(paymentReturnMessage("paid").kind).toBe("success");
    expect(paymentReturnMessage("pending").kind).toBe("info");
    expect(paymentReturnMessage("cancelled").kind).toBe("info");
    expect(paymentReturnMessage("unmatched").kind).toBe("info");
  });

  it("covers both an abandoned checkout and a webhook still in flight", () => {
    // The browser cannot tell the two apart, so the wording must fit either.
    expect(paymentReturnMessage("pending").message).toMatch(/not had confirmation/i);
    expect(paymentReturnMessage("pending").message).toMatch(/Pay now/);
  });
});

describe("checkoutErrorMessage", () => {
  const withBody = (body: unknown) => ({
    message: "Edge Function returned a non-2xx status code",
    context: { json: async () => body },
  });

  it("surfaces the Edge Function's own message", async () => {
    await expect(checkoutErrorMessage(withBody({ error: "This booking is already paid" }))).resolves.toBe(
      "This booking is already paid"
    );
  });

  it("falls back to the error message when the body is not ours", async () => {
    const error = Object.assign(new Error("Failed to fetch"), {});
    await expect(checkoutErrorMessage(error)).resolves.toBe("Failed to fetch");
    await expect(checkoutErrorMessage(withBody({ nope: true }))).resolves.toBe(
      "Edge Function returned a non-2xx status code"
    );
    await expect(
      checkoutErrorMessage({
        message: "boom",
        context: {
          json: async () => {
            throw new Error("not JSON");
          },
        },
      })
    ).resolves.toBe("boom");
  });

  it("never leaves the passenger without a message", async () => {
    await expect(checkoutErrorMessage(null)).resolves.toMatch(/Could not start the payment/);
    await expect(checkoutErrorMessage({})).resolves.toMatch(/Could not start the payment/);
  });
});
