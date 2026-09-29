import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import {
  checkoutErrorMessage,
  paymentReturnMessage,
  readPaymentReturn,
  stripPaymentReturn,
  type PaymentOutcome,
  type PaymentReturn,
  type PaymentTargetType,
} from "@/lib/payments";

export type CheckoutSession = { url: string; reference: string; provider: string };

/**
 * Starts a hosted checkout for one booking or ride request.
 *
 * The body says *what* is being paid for, never how much: create-checkout-session
 * verifies the caller owns the row and reads the amount from the database. The
 * provider is chosen server-side from the PAYMENT_PROVIDER secret and echoed back.
 */
export const useStartCheckout = () =>
  useMutation({
    mutationFn: async (target: {
      targetType: PaymentTargetType;
      targetId: string;
    }): Promise<CheckoutSession> => {
      const { data, error } = await supabase.functions.invoke<CheckoutSession>(
        "create-checkout-session",
        { body: { targetType: target.targetType, targetId: target.targetId } }
      );
      if (error) throw new Error(await checkoutErrorMessage(error));
      if (!data?.url) throw new Error("The payment provider did not return a checkout page");
      return data;
    },
  });

/** How long we keep asking whether the webhook has landed: 5 looks, ~12 s. */
const POLL_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 3000;

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export type PaymentLookup = {
  outcome: Exclude<PaymentOutcome, "cancelled">;
  targetType?: PaymentTargetType;
  targetId?: string;
};

/** One look at the passenger's own rows for this provider reference. */
const lookUpReference = async (userId: string, reference: string): Promise<PaymentLookup> => {
  const { data: rides, error: rideError } = await supabase
    .from("ride_requests")
    .select("id, payment_status")
    .eq("customer_id", userId)
    .eq("payment_ref", reference)
    .limit(1);
  if (rideError) throw rideError;
  const ride = rides?.[0];
  if (ride) {
    return {
      outcome: ride.payment_status === "paid" ? "paid" : "pending",
      targetType: "ride_request",
      targetId: ride.id,
    };
  }

  const { data: bookings, error: bookingError } = await supabase
    .from("bookings")
    .select("id, payment_status")
    .eq("customer_id", userId)
    .eq("payment_ref", reference)
    .limit(1);
  if (bookingError) throw bookingError;
  const booking = bookings?.[0];
  if (booking) {
    return {
      outcome: booking.payment_status === "paid" ? "paid" : "pending",
      targetType: "booking",
      targetId: booking.id,
    };
  }

  return { outcome: "unmatched" };
};

/**
 * Resolves a provider reference against the passenger's own rows.
 *
 * `payment_status` is flipped by the webhook, which can land after the
 * passenger is redirected back, so a pending answer is re-asked a few times
 * before we settle on it. The query resolves only once the outcome is final.
 */
export const usePaymentByReference = (reference: string | undefined) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["payment_reference", reference, user?.id],
    enabled: !!user && !!reference,
    staleTime: Infinity,
    retry: false,
    queryFn: async (): Promise<PaymentLookup> => {
      let last = await lookUpReference(user!.id, reference!);
      for (let attempt = 1; attempt < POLL_ATTEMPTS && last.outcome === "pending"; attempt += 1) {
        await sleep(POLL_INTERVAL_MS);
        last = await lookUpReference(user!.id, reference!);
      }
      return last;
    },
  });
};

export type PaymentReturnState = {
  /** True when this page load came back from a provider's checkout page. */
  isReturn: boolean;
  /** Undefined until the reference has been resolved. */
  outcome?: PaymentOutcome;
};

/**
 * Every return already announced in this page's lifetime. A ref would be
 * enough but for StrictMode's double mount, which would toast twice in dev.
 */
const announced = new Set<string>();

/**
 * Handles the provider's return URL: reads it once, clears the payment keys
 * from the address bar so a refresh cannot replay the toast, then tells the
 * passenger what happened and refreshes their rides when the money arrived.
 */
export const usePaymentReturn = (): PaymentReturnState => {
  const qc = useQueryClient();
  const [ret] = useState<PaymentReturn | null>(() =>
    typeof window === "undefined" ? null : readPaymentReturn(window.location.search)
  );
  // The reference is held in component state; the URL is tidied immediately.
  useEffect(() => {
    if (!ret || typeof window === "undefined") return;
    const clean = `${window.location.pathname}${stripPaymentReturn(window.location.search)}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", clean);
  }, [ret]);

  const verify = ret && ret.claim !== "cancelled" ? ret.reference : undefined;
  const { data: lookup, isError } = usePaymentByReference(verify);

  let outcome: PaymentOutcome | undefined;
  if (ret) {
    if (ret.claim === "cancelled") outcome = "cancelled";
    // Only our own return URLs carry `payment=success`, and then only when the
    // provider gives us no reference to check.
    else if (!verify) outcome = "paid";
    else if (isError) outcome = "pending";
    else outcome = lookup?.outcome;
  }

  const key = ret ? `${ret.claim}:${ret.reference ?? ""}` : "";

  useEffect(() => {
    if (!outcome || announced.has(key)) return;
    announced.add(key);
    const notice = paymentReturnMessage(outcome);
    if (notice.kind === "success") toast.success(notice.message);
    else toast.info(notice.message);
    if (outcome === "paid") {
      void qc.invalidateQueries({ queryKey: ["ride_requests"] });
      void qc.invalidateQueries({ queryKey: ["bookings"] });
    }
  }, [outcome, key, qc]);

  return { isReturn: !!ret, outcome };
};
