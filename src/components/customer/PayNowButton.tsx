import React from "react";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useStartCheckout } from "@/hooks/usePayments";
import { payNowLabel, type PaymentTargetType } from "@/lib/payments";

/**
 * Sends the passenger to the provider's hosted checkout for one booking or
 * ride request. The amount on the label is the snapshot on the row; the amount
 * actually charged is read from that same row by the Edge Function, never sent
 * from here. The provider returns them to the app, where usePaymentReturn()
 * picks the reference up again.
 */
export const PayNowButton: React.FC<{
  targetType: PaymentTargetType;
  targetId: string;
  totalPrice?: number;
  currency?: string;
}> = ({ targetType, targetId, totalPrice, currency }) => {
  const startCheckout = useStartCheckout();
  // Stays true while the browser is on its way to the provider.
  const [redirecting, setRedirecting] = React.useState(false);
  const busy = startCheckout.isPending || redirecting;

  return (
    <Button
      size="sm"
      disabled={busy}
      onClick={async () => {
        try {
          const session = await startCheckout.mutateAsync({ targetType, targetId });
          setRedirecting(true);
          window.location.assign(session.url);
        } catch (e: unknown) {
          setRedirecting(false);
          toast.error(e instanceof Error ? e.message : "Could not start the payment");
        }
      }}
    >
      {busy ? (
        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
      ) : (
        <CreditCard className="w-4 h-4 mr-1.5" />
      )}
      {busy ? "Opening checkout…" : payNowLabel(totalPrice, currency)}
    </Button>
  );
};
