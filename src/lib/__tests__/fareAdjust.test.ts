import { describe, expect, it } from "vitest";
import { canAdjustFare, fareChangeError, previewFare } from "../fareAdjust";

describe("previewFare", () => {
  it("adds tax on top and rounds to cents", () => {
    const p = previewFare(18, 3, 15);
    expect(p.subtotal).toBe(54);
    expect(p.taxAmount).toBe(8.1);
    expect(p.total).toBe(62.1);
  });

  it("backs tax out when the operator's prices include it", () => {
    const p = previewFare(18, 3, 15, true);
    expect(p.total).toBe(54); // what the passenger pays, unchanged
    expect(p.subtotal).toBe(46.96);
    expect(p.taxAmount).toBe(7.04);
    expect(p.subtotal + p.taxAmount).toBeCloseTo(p.total, 2);
  });

  it("handles a zero-tax operator and a free ride", () => {
    expect(previewFare(20, 2, 0)).toEqual({ farePerSeat: 20, subtotal: 40, taxAmount: 0, total: 40 });
    expect(previewFare(0, 4, 15).total).toBe(0);
  });

  it("rounds the seat fare before multiplying, as the SQL does", () => {
    expect(previewFare(18.005, 2, 0).subtotal).toBe(36.02);
  });
});

describe("canAdjustFare", () => {
  it("allows a correction while the ride is live and unpaid", () => {
    expect(canAdjustFare("awaiting", "not_required")).toBe(true);
    expect(canAdjustFare("confirmed", "pending")).toBe(true);
    expect(canAdjustFare("in_progress", "not_required")).toBe(true);
  });

  it("refuses once the ride is over or the money has been taken", () => {
    expect(canAdjustFare("completed", "paid")).toBe(false);
    expect(canAdjustFare("cancelled", "not_required")).toBe(false);
    expect(canAdjustFare("confirmed", "paid")).toBe(false);
  });
});

describe("fareChangeError", () => {
  it("passes a valid fare and reason", () => {
    expect(fareChangeError("18", "association increase")).toBeUndefined();
    expect(fareChangeError(" 0 ", "promo day")).toBeUndefined();
  });

  it("requires a number", () => {
    expect(fareChangeError("", "a reason")).toBe("Enter the new fare per seat");
    expect(fareChangeError("abc", "a reason")).toBe("Enter the new fare per seat");
  });

  it("refuses a negative fare", () => {
    expect(fareChangeError("-5", "a reason")).toBe("A fare cannot be negative");
  });

  it("requires a real reason", () => {
    expect(fareChangeError("18", "")).toBe("Give a reason for the fare change");
    expect(fareChangeError("18", " x ")).toBe("Give a reason for the fare change");
    expect(fareChangeError("18", "x".repeat(501))).toMatch(/at most 500/);
  });
});
