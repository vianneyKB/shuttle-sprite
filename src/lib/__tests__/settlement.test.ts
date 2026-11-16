import { describe, expect, it } from "vitest";
import {
  cashCollectedPrompt,
  collectsCashOnComplete,
  completeBlockedHint,
  completeBlockedReason,
  isPrepayUnpaid,
} from "../settlement";

describe("isPrepayUnpaid", () => {
  it("is true for a prepay row that is still pending", () => {
    expect(isPrepayUnpaid("prepay", "pending")).toBe(true);
  });

  it("treats not_required on a prepay row as unpaid, not waived", () => {
    expect(isPrepayUnpaid("prepay", "not_required")).toBe(true);
  });

  it("is false once the prepayment lands", () => {
    expect(isPrepayUnpaid("prepay", "paid")).toBe(false);
  });

  it("never blocks a cash row", () => {
    expect(isPrepayUnpaid("cash", "pending")).toBe(false);
    expect(isPrepayUnpaid("cash", "not_required")).toBe(false);
  });
});

describe("collectsCashOnComplete", () => {
  it("is true for cash that has not been recorded yet", () => {
    expect(collectsCashOnComplete("cash", "not_required")).toBe(true);
    expect(collectsCashOnComplete("cash", "pending")).toBe(true);
  });

  it("does not ask twice for cash already recorded", () => {
    expect(collectsCashOnComplete("cash", "paid")).toBe(false);
  });

  it("is false for prepay, which is settled by the provider", () => {
    expect(collectsCashOnComplete("prepay", "pending")).toBe(false);
  });
});

describe("completeBlockedReason", () => {
  it("names the ride and says what to do instead", () => {
    expect(completeBlockedReason("prepay", "pending")).toBe(
      "This ride has not been paid for yet, so it cannot be completed. Wait for the payment, or cancel it."
    );
  });

  it("names a booking when that is what is being completed", () => {
    expect(completeBlockedReason("prepay", "pending", "booking")).toContain("This booking");
  });

  it("is undefined when completing is allowed", () => {
    expect(completeBlockedReason("prepay", "paid")).toBeUndefined();
    expect(completeBlockedReason("cash", "pending")).toBeUndefined();
  });

  it("has a short hint that tracks it", () => {
    expect(completeBlockedHint("prepay", "pending")).toBe("awaiting payment");
    expect(completeBlockedHint("cash", "pending")).toBeUndefined();
  });
});

describe("cashCollectedPrompt", () => {
  it("names the amount in the row's own currency", () => {
    const prompt = cashCollectedPrompt(120, "ZAR");
    expect(prompt).toContain("120");
    expect(prompt).toContain("ride");
    expect(prompt).not.toContain("undefined");
  });

  it("uses the operator's currency, not a hard-coded symbol", () => {
    expect(cashCollectedPrompt(120, "KES")).not.toContain("R1");
    expect(cashCollectedPrompt(120, "KES")).toMatch(/120/);
  });

  it("falls back when no fare was ever set", () => {
    expect(cashCollectedPrompt(undefined, "ZAR")).toBe(
      "Completing this ride records its cash fare as collected."
    );
    expect(cashCollectedPrompt(0, "ZAR", "booking")).toContain("booking");
  });
});
