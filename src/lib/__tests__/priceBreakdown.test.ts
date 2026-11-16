import { describe, expect, it } from "vitest";
import {
  bookingBreakdownReconciles,
  bookingBreakdownRows,
  rideQuoteReconciles,
  rideQuoteRows,
  round2,
} from "../priceBreakdown";
import { formatMoney } from "../money";
import type { PriceBreakdown, RideFareQuote } from "@/types";

/** Money is asserted through formatMoney, so the test does not pin a locale. */
const zar = (n: number) => formatMoney(n, "ZAR");

/** What calculate_booking_price() returns for a 2-hour ZAR booking at 15% VAT. */
const breakdown = (over: Partial<PriceBreakdown> = {}): PriceBreakdown => ({
  currency: "ZAR",
  hourlyRate: 200,
  duration: 2,
  additionalStops: 0,
  additionalStopFee: 15,
  additionalStopsCost: 0,
  recurringMultiplier: 1,
  pricesIncludeTax: false,
  subtotal: 400,
  taxRate: 15,
  taxLabel: "VAT",
  taxAmount: 60,
  finalTotal: 460,
  ...over,
});

const rowsById = (rows: { id: string; label: string; value: string }[]) =>
  Object.fromEntries(rows.map((r) => [r.id, r]));

describe("bookingBreakdownRows", () => {
  it("shows base rate, subtotal, tax and total for the ordinary case", () => {
    const rows = bookingBreakdownRows(breakdown());
    expect(rows.map((r) => r.id)).toEqual(["base", "subtotal", "tax", "total"]);
    const by = rowsById(rows);
    expect(by.base.label).toBe(`Base rate (2h × ${zar(200)})`);
    expect(by.base.value).toBe(zar(400));
    expect(by.subtotal.label).toBe("Subtotal");
    expect(by.tax.label).toBe("VAT (15%)");
    expect(by.tax.value).toBe(zar(60));
    expect(by.total.value).toBe(zar(460));
  });

  it("only draws the subtotal and tax rows when the operator charges tax", () => {
    const rows = bookingBreakdownRows(breakdown({ taxRate: 0, taxAmount: 0, finalTotal: 400 }));
    expect(rows.map((r) => r.id)).toEqual(["base", "total"]);
    expect(rowsById(rows).total.value).toBe(zar(400));
  });

  it("names the subtotal as excluding tax when listed prices already include it", () => {
    const rows = bookingBreakdownRows(
      breakdown({ pricesIncludeTax: true, subtotal: 347.83, taxAmount: 52.17, finalTotal: 400 })
    );
    const by = rowsById(rows);
    expect(by.subtotal.label).toBe("Subtotal (excl. tax)");
    expect(by.base.value).toBe(zar(400)); // the listed price, tax and all
    expect(by.total.value).toBe(zar(400));
  });

  it("adds a row for extra stops, priced at the operator's stop fee", () => {
    const rows = bookingBreakdownRows(
      breakdown({ additionalStops: 2, additionalStopsCost: 30, subtotal: 430, taxAmount: 64.5, finalTotal: 494.5 })
    );
    const by = rowsById(rows);
    expect(by.stops.label).toBe(`Additional stops (2 × ${zar(15)})`);
    expect(by.stops.value).toBe(zar(30));
  });

  it("shows the recurring multiplier as its own row, since the line items are per trip", () => {
    const rows = bookingBreakdownRows(
      breakdown({ recurringMultiplier: 5, subtotal: 2000, taxAmount: 300, finalTotal: 2300 })
    );
    const by = rowsById(rows);
    expect(by.base.value).toBe(zar(400)); // one trip
    expect(by.recurring.value).toBe("× 5");
    expect(by.subtotal.value).toBe(zar(2000)); // five of them
  });

  it("uses the operator's own currency and tax label, never a hard-coded symbol", () => {
    const rows = bookingBreakdownRows(
      breakdown({ currency: "GBP", hourlyRate: 50, taxRate: 20, taxLabel: "VAT", subtotal: 100, taxAmount: 20, finalTotal: 120 })
    );
    const by = rowsById(rows);
    expect(by.base.label).toContain(formatMoney(50, "GBP"));
    expect(by.total.value).toBe(formatMoney(120, "GBP"));
    expect(by.tax.label).toBe("VAT (20%)");
  });

  it("puts the rule and the emphasis on the subtotal and total rows only", () => {
    const rows = bookingBreakdownRows(breakdown());
    expect(rows.filter((r) => r.rule).map((r) => r.id)).toEqual(["subtotal", "total"]);
    expect(rows.filter((r) => r.strong).map((r) => r.id)).toEqual(["total"]);
  });
});

describe("bookingBreakdownReconciles", () => {
  it("accepts the server's own arithmetic, tax on top", () => {
    expect(bookingBreakdownReconciles(breakdown())).toBe(true);
  });

  it("accepts a tax-inclusive breakdown, where the lines reach the total not the subtotal", () => {
    expect(
      bookingBreakdownReconciles(
        breakdown({ pricesIncludeTax: true, subtotal: 347.83, taxAmount: 52.17, finalTotal: 400 })
      )
    ).toBe(true);
  });

  it("accepts stops and a recurring multiplier together", () => {
    expect(
      bookingBreakdownReconciles(
        breakdown({
          additionalStops: 2,
          additionalStopsCost: 30,
          recurringMultiplier: 5,
          subtotal: 2150,
          taxAmount: 322.5,
          finalTotal: 2472.5,
        })
      )
    ).toBe(true);
  });

  it("rejects a total that is not subtotal plus tax", () => {
    expect(bookingBreakdownReconciles(breakdown({ finalTotal: 400 }))).toBe(false);
  });

  it("rejects a subtotal the line items cannot reach", () => {
    expect(bookingBreakdownReconciles(breakdown({ subtotal: 500, taxAmount: 75, finalTotal: 575 }))).toBe(false);
  });
});

/** What quote_ride_fare() returns for 2 seats at R18.50, 15% VAT. */
const quote = (over: Partial<RideFareQuote> = {}): RideFareQuote => ({
  source: "segment",
  farePerSeat: 18.5,
  passengers: 2,
  currency: "ZAR",
  subtotal: 37,
  taxRate: 15,
  taxLabel: "VAT",
  taxAmount: 5.55,
  pricesIncludeTax: false,
  total: 42.55,
  ...over,
});

describe("rideQuoteRows", () => {
  it("labels the seat row with the seat count the server priced", () => {
    const by = rowsById(rideQuoteRows(quote({ passengers: 3, subtotal: 55.5, taxAmount: 8.33, total: 63.83 })));
    expect(by.seats.label).toBe(`3 × ${zar(18.5)} per seat`);
    expect(by.seats.value).toBe(zar(55.5));
  });

  it("renders nothing at all when the route has no fare", () => {
    expect(rideQuoteRows(quote({ farePerSeat: undefined, subtotal: undefined, taxAmount: undefined, total: undefined }))).toEqual([]);
  });

  it("hides the tax row for a zero-tax operator", () => {
    const rows = rideQuoteRows(quote({ taxRate: 0, taxAmount: 0, total: 37 }));
    expect(rows.map((r) => r.id)).toEqual(["seats", "total"]);
  });

  it("marks the tax row as included when the operator's fares already contain it", () => {
    const by = rowsById(rideQuoteRows(quote({ pricesIncludeTax: true, subtotal: 32.17, taxAmount: 4.83, total: 37 })));
    expect(by.tax.label).toBe("VAT (15%) incl.");
    expect(by.total.value).toBe(zar(37));
  });
});

describe("rideQuoteReconciles", () => {
  it("accepts the server's own arithmetic both ways round", () => {
    expect(rideQuoteReconciles(quote())).toBe(true);
    expect(rideQuoteReconciles(quote({ pricesIncludeTax: true, subtotal: 32.17, taxAmount: 4.83, total: 37 }))).toBe(true);
  });

  it("rejects a quote whose seats and seat fare miss the subtotal", () => {
    expect(rideQuoteReconciles(quote({ passengers: 3 }))).toBe(false);
  });

  it("treats an unpriced quote as not reconciling rather than as free", () => {
    expect(rideQuoteReconciles(quote({ total: undefined }))).toBe(false);
    expect(rideQuoteReconciles(quote({ farePerSeat: undefined }))).toBe(false);
  });
});

describe("round2", () => {
  it("rounds to cents the way Postgres round(x, 2) does", () => {
    expect(round2(36.005)).toBe(36.01);
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(42.555)).toBe(42.56);
  });
});
