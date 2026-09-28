/**
 * The arithmetic and validation behind an operator's fare correction.
 * Kept pure and mirrored from dispatch_ride_request's fare branch, so the
 * preview the operator sees is the amount the database will store.
 */
import type { RideRequestStatus } from "@/types";

export const FARE_REASON_MIN = 3;
export const FARE_REASON_MAX = 500;

export type FarePreview = {
  farePerSeat: number;
  subtotal: number;
  taxAmount: number;
  total: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Tax-exclusive by default, matching the common case; `pricesIncludeTax`
 * backs the tax out of the seat price instead, as the SQL does.
 */
export const previewFare = (
  farePerSeat: number,
  passengers: number,
  taxRate: number,
  pricesIncludeTax = false
): FarePreview => {
  const seat = round2(farePerSeat);
  const gross = round2(seat * passengers);
  if (pricesIncludeTax) {
    const subtotal = round2(gross / (1 + taxRate / 100));
    return { farePerSeat: seat, subtotal, taxAmount: round2(gross - subtotal), total: gross };
  }
  const taxAmount = round2(gross * (taxRate / 100));
  return { farePerSeat: seat, subtotal: gross, taxAmount, total: round2(gross + taxAmount) };
};

/** A ride whose money is settled, or which is over, cannot be re-priced. */
export const canAdjustFare = (status: RideRequestStatus, paymentStatus: string): boolean =>
  status !== "completed" && status !== "cancelled" && paymentStatus !== "paid";

/**
 * Why the form cannot be submitted yet, or undefined when it can.
 * Messages match the errors the RPC raises, so the two never disagree.
 */
export const fareChangeError = (fare: string, reason: string): string | undefined => {
  const trimmed = fare.trim();
  if (trimmed === "") return "Enter the new fare per seat";
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return "Enter the new fare per seat";
  if (n < 0) return "A fare cannot be negative";
  const r = reason.trim();
  if (r.length < FARE_REASON_MIN) return "Give a reason for the fare change";
  if (r.length > FARE_REASON_MAX) return `A reason is at most ${FARE_REASON_MAX} characters`;
  return undefined;
};
