/**
 * What completing a ride or a fleet booking does to the money, and when it
 * may happen at all. Mirrored from settle_payment_on_complete() in SQL
 * (20260930041122) so the button the operator sees and the rule the
 * database enforces cannot disagree.
 */
import type { PaymentMethod, PaymentStatus } from "@/types";
import { formatMoney } from "./money";

/** What the thing being completed is called in a message to the operator. */
export type SettleNoun = "ride" | "booking";

/** Prepay, and the money has not arrived: `not_required` here is a fault, not a waiver. */
export const isPrepayUnpaid = (method: PaymentMethod, status: PaymentStatus): boolean =>
  method === "prepay" && status !== "paid";

/** Completing this will record the cash fare as collected. */
export const collectsCashOnComplete = (method: PaymentMethod, status: PaymentStatus): boolean =>
  method === "cash" && status !== "paid";

/**
 * Why Complete is unavailable, or undefined when it is allowed. The text
 * matches the exception the trigger raises, so a stale page and the
 * database give the operator the same answer.
 */
export const completeBlockedReason = (
  method: PaymentMethod,
  status: PaymentStatus,
  noun: SettleNoun = "ride"
): string | undefined =>
  isPrepayUnpaid(method, status)
    ? `This ${noun} has not been paid for yet, so it cannot be completed. Wait for the payment, or cancel it.`
    : undefined;

/** The short form of the same thing, for a hint beside the disabled button. */
export const completeBlockedHint = (
  method: PaymentMethod,
  status: PaymentStatus
): string | undefined => (isPrepayUnpaid(method, status) ? "awaiting payment" : undefined);

/**
 * The confirmation shown before completing a cash ride: the operator is
 * asserting they have the money, because completing records it as paid.
 * A ride with no fare set still needs the confirmation — the driver was
 * handed something — but there is no amount to name.
 */
export const cashCollectedPrompt = (
  amount: number | undefined | null,
  currency: string,
  noun: SettleNoun = "ride"
): string =>
  amount != null && amount > 0
    ? `Collect ${formatMoney(amount, currency)} in cash before completing this ${noun}. Completing it records the fare as paid.`
    : `Completing this ${noun} records its cash fare as collected.`;
