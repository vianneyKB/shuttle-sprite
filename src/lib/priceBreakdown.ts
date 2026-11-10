/**
 * Turning a server price breakdown into the rows a passenger reads.
 *
 * Every number here comes from Postgres — `calculate_booking_price()` for a
 * booking, `quote_ride_fare()` for a ride request. Nothing is priced in the
 * browser. What this module owns is the *presentation*: which rows appear, in
 * what order, and with what label. It lives outside the component so the
 * arithmetic in those labels can be tested, and so the "does the breakdown
 * still add up?" check below can be run against the exact numbers the SQL
 * produces.
 */

import { formatMoney } from "@/lib/money";
import type { PriceBreakdown, RideFareQuote } from "@/types";

export type BreakdownRow = {
  /** Stable id for the key prop and for tests; not shown. */
  id: string;
  label: string;
  value: string;
  /** Rule above the row — separates the line items from the totals. */
  rule?: boolean;
  /** The row the passenger actually pays. */
  strong?: boolean;
};

/** Cents, the way `round(x, 2)` does it in Postgres. */
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Booking pricing summary. The base-rate and additional-stop rows are the
 * line items *before* the recurring multiplier, which is why the multiplier
 * gets a row of its own rather than being folded into them: the passenger can
 * follow the arithmetic from the hourly rate to the total.
 */
export const bookingBreakdownRows = (b: PriceBreakdown): BreakdownRow[] => {
  const rows: BreakdownRow[] = [
    {
      id: "base",
      label: `Base rate (${b.duration}h × ${formatMoney(b.hourlyRate, b.currency)})`,
      value: formatMoney(round2(b.hourlyRate * b.duration), b.currency),
    },
  ];
  if (b.additionalStops > 0) {
    rows.push({
      id: "stops",
      label: `Additional stops (${b.additionalStops} × ${formatMoney(b.additionalStopFee, b.currency)})`,
      value: formatMoney(b.additionalStopsCost, b.currency),
    });
  }
  if (b.recurringMultiplier > 1) {
    rows.push({
      id: "recurring",
      label: `Recurring (${b.recurringMultiplier} days / week)`,
      value: `× ${b.recurringMultiplier}`,
    });
  }
  if (b.taxRate > 0) {
    rows.push({
      id: "subtotal",
      label: `Subtotal${b.pricesIncludeTax ? " (excl. tax)" : ""}`,
      value: formatMoney(b.subtotal, b.currency),
      rule: true,
    });
    rows.push({
      id: "tax",
      label: `${b.taxLabel} (${b.taxRate}%)`,
      value: formatMoney(b.taxAmount, b.currency),
    });
  }
  rows.push({
    id: "total",
    label: "Total",
    value: formatMoney(b.finalTotal, b.currency),
    rule: true,
    strong: true,
  });
  return rows;
};

/**
 * Ride request fare summary. `passengers` is read off the quote, not off the
 * form: the seat count in the label has to be the one the server priced, or
 * the row would read "3 × R18" beside a two-seat subtotal.
 */
export const rideQuoteRows = (q: RideFareQuote): BreakdownRow[] => {
  if (q.total == null) return [];
  const rows: BreakdownRow[] = [
    {
      id: "seats",
      label: `${q.passengers} × ${formatMoney(q.farePerSeat ?? 0, q.currency)} per seat`,
      value: formatMoney(q.subtotal ?? 0, q.currency),
    },
  ];
  if (q.taxAmount != null && q.taxAmount > 0) {
    rows.push({
      id: "tax",
      label: `${q.taxLabel} (${q.taxRate}%)${q.pricesIncludeTax ? " incl." : ""}`,
      value: formatMoney(q.taxAmount, q.currency),
    });
  }
  rows.push({
    id: "total",
    label: "Fare",
    value: formatMoney(q.total, q.currency),
    rule: true,
    strong: true,
  });
  return rows;
};

/**
 * Does a server breakdown add up on its own terms? Mirrors the arithmetic in
 * `calculate_booking_price()`: line items × the recurring multiplier reach the
 * subtotal (or the total, when the operator's listed prices already include
 * tax), and subtotal + tax is what the passenger pays.
 *
 * Used by the tests to pin the relationship the display assumes. A breakdown
 * that fails this would render rows that visibly do not sum.
 */
export const bookingBreakdownReconciles = (b: PriceBreakdown): boolean => {
  const gross = round2((b.hourlyRate * b.duration + b.additionalStopsCost) * b.recurringMultiplier);
  const taxedSide = b.pricesIncludeTax ? b.finalTotal : b.subtotal;
  return round2(gross) === round2(taxedSide) && round2(b.subtotal + b.taxAmount) === round2(b.finalTotal);
};

/** The same check for a ride fare quote: seats × seat fare, then tax. */
export const rideQuoteReconciles = (q: RideFareQuote): boolean => {
  if (q.total == null || q.subtotal == null || q.farePerSeat == null) return false;
  const gross = round2(q.farePerSeat * q.passengers);
  const taxedSide = q.pricesIncludeTax ? q.total : q.subtotal;
  return round2(gross) === round2(taxedSide) && round2(q.subtotal + (q.taxAmount ?? 0)) === round2(q.total);
};
