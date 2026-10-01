/**
 * The passenger side of a hosted checkout: when "Pay now" may be offered, how
 * the provider's return URL is read, and what the passenger is told about it.
 *
 * Pure on purpose. `canPayNow` mirrors start_payment()'s refusals so the button
 * is only shown when the RPC would actually accept the payment, and the return
 * URL is parsed here rather than in a component so the odd shapes providers
 * use (Paystack sends `reference` *and* `trxref`) are covered by tests.
 */
import type { PaymentMethod, PaymentStatus } from "@/types";
import { formatMoney } from "@/lib/money";

export type PaymentTargetType = "booking" | "ride_request";

/** The little a checkout needs to know about a booking or a ride request. */
export type Payable = {
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  /** Snapshotted total; a ride with no fare set is paid on board. */
  totalPrice?: number;
  /** Booking / ride status: a cancelled one is never payable. */
  status?: string;
};

/**
 * Mirrors start_payment(): prepay, still pending, a real amount, not
 * cancelled. Anything else and the Edge Function would refuse, so the button
 * stays hidden rather than promising something the server will reject.
 */
export const canPayNow = (p: Payable): boolean =>
  p.paymentMethod === "prepay" &&
  p.paymentStatus === "pending" &&
  (p.totalPrice ?? 0) > 0 &&
  p.status !== "cancelled";

/** "Pay R 62,10" when the amount is known — the passenger sees it before leaving the app. */
export const payNowLabel = (totalPrice?: number, currency?: string): string =>
  totalPrice != null && totalPrice > 0 ? `Pay ${formatMoney(totalPrice, currency)}` : "Pay now";

/** Query keys a provider may add to the return URL, cleared once read. */
const RETURN_PARAMS = ["reference", "trxref", "payment"];

export type PaymentReturn = {
  /** Our reference, echoed back by the provider. */
  reference?: string;
  /**
   * What the redirect itself claims. Paystack says nothing — it returns the
   * passenger to the same URL whether they paid or cancelled — so `unknown`
   * is the common case and the row's payment_status decides.
   */
  claim: "paid" | "cancelled" | "unknown";
};

/** Reads a provider return URL's query string, or null when this is an ordinary visit. */
export const readPaymentReturn = (search: string): PaymentReturn | null => {
  const params = new URLSearchParams(search);
  const reference = params.get("reference") || params.get("trxref") || "";
  const flag = (params.get("payment") ?? "").toLowerCase();
  const claim: PaymentReturn["claim"] =
    flag === "cancelled" || flag === "canceled"
      ? "cancelled"
      : flag === "success" || flag === "paid"
        ? "paid"
        : "unknown";
  if (!reference && claim === "unknown") return null;
  return { ...(reference ? { reference } : {}), claim };
};

/** The same query string without the payment keys, so a refresh does not re-toast. */
export const stripPaymentReturn = (search: string): string => {
  const params = new URLSearchParams(search);
  RETURN_PARAMS.forEach((key) => params.delete(key));
  const rest = params.toString();
  return rest ? `?${rest}` : "";
};

/**
 * `pending` covers two cases we cannot tell apart from the browser: the
 * passenger abandoned the checkout, or the webhook has not landed yet. The
 * message has to be true of both.
 */
export type PaymentOutcome = "paid" | "pending" | "cancelled" | "unmatched";

export type PaymentNotice = { kind: "success" | "info"; message: string };

export const paymentReturnMessage = (outcome: PaymentOutcome): PaymentNotice => {
  switch (outcome) {
    case "paid":
      return { kind: "success", message: "Payment received — thank you." };
    case "cancelled":
      return { kind: "info", message: "Payment cancelled — you have not been charged." };
    case "unmatched":
      return {
        kind: "info",
        message: "We could not match that payment to one of your rides or bookings.",
      };
    default:
      return {
        kind: "info",
        message:
          "We have not had confirmation of that payment yet. If you completed it this will update shortly; otherwise use Pay now to try again.",
      };
  }
};

/**
 * The Edge Functions answer `{ "error": "…" }`, but supabase-js only reports
 * "non-2xx status code" and hands the Response over on `context`. Read ours,
 * so the passenger sees "This booking is already paid" rather than an HTTP code.
 */
export const checkoutErrorMessage = async (error: unknown): Promise<string> => {
  const context = (error as { context?: unknown } | null)?.context as Response | undefined;
  if (context && typeof context.json === "function") {
    try {
      const body = (await context.json()) as { error?: unknown } | null;
      const message = body?.error;
      if (typeof message === "string" && message.trim() !== "") return message.trim();
    } catch {
      // Not JSON (a gateway error page, say) — fall through.
    }
  }
  const message = (error as { message?: unknown } | null)?.message;
  if (typeof message === "string" && message.trim() !== "") return message;
  return "Could not start the payment. Please try again.";
};
