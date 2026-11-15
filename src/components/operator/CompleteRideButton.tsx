import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Check, Coins } from "lucide-react";
import type { PaymentMethod, PaymentStatus } from "@/types";
import {
  cashCollectedPrompt,
  collectsCashOnComplete,
  completeBlockedHint,
  completeBlockedReason,
  type SettleNoun,
} from "@/lib/settlement";

type Props = {
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  /** Total owed, used only to name the amount in the cash confirmation. */
  amount?: number | null;
  currency: string;
  noun?: SettleNoun;
  busy?: boolean;
  onComplete: () => void;
};

/**
 * Complete, with the money rules attached: refused outright for a prepay
 * ride or booking that has not been paid for, and gated behind a **Cash
 * collected** confirmation otherwise, because completing records the cash
 * fare as paid. The same rules run in Postgres (#32) — this only saves the
 * operator a round trip and an error toast.
 */
export const CompleteRideButton: React.FC<Props> = ({
  paymentMethod,
  paymentStatus,
  amount,
  currency,
  noun = "ride",
  busy,
  onComplete,
}) => {
  const [confirming, setConfirming] = useState(false);
  const blocked = completeBlockedReason(paymentMethod, paymentStatus, noun);
  const needsCash = collectsCashOnComplete(paymentMethod, paymentStatus);

  return (
    <>
      <Button
        size="sm"
        disabled={busy || !!blocked}
        title={blocked}
        onClick={() => (needsCash ? setConfirming(true) : onComplete())}
      >
        <Check className="w-4 h-4 mr-1" /> Complete
      </Button>
      {blocked && (
        <span className="text-xs text-orange-700">
          {completeBlockedHint(paymentMethod, paymentStatus)}
        </span>
      )}

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-primary-600" /> Cash collected?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {cashCollectedPrompt(amount, currency, noun)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not yet</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirming(false);
                onComplete();
              }}
            >
              Cash collected · Complete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
