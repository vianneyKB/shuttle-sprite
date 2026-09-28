import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFareAdjustments } from "@/hooks/useRideRequests";
import { formatMoney } from "@/lib/money";
import { previewFare, fareChangeError } from "@/lib/fareAdjust";
import type { RideRequest } from "@/types";
import { Loader2, History } from "lucide-react";

type Props = {
  request: RideRequest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  onSubmit: (farePerSeat: number, reason: string) => void;
};

export const FareAdjustDialog: React.FC<Props> = ({ request: r, open, onOpenChange, busy, onSubmit }) => {
  const [fare, setFare] = useState(r.farePerSeat != null ? String(r.farePerSeat) : "");
  const [reason, setReason] = useState("");
  const { data: history = [], isLoading } = useFareAdjustments(open ? r.id : undefined);

  const error = fareChangeError(fare, reason);
  const preview = error ? undefined : previewFare(Number(fare), r.passengers, r.taxRate);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adjust fare</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-secondary-600">
          {r.originName} → {r.destinationName} · {r.passengers} passenger{r.passengers !== 1 ? "s" : ""}
          <span className="block mt-1">
            Currently{" "}
            {r.totalPrice != null ? (
              <strong>{formatMoney(r.totalPrice, r.currency)}</strong>
            ) : (
              <strong>no fare set</strong>
            )}
            {r.farePerSeat != null ? ` (${formatMoney(r.farePerSeat, r.currency)} per seat)` : ""}
          </span>
        </p>

        <fieldset className="space-y-2 border-0 p-0">
          <Label htmlFor="adj-fare">New fare per seat ({r.currency})</Label>
          <Input
            id="adj-fare"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.5"
            value={fare}
            onChange={(e) => setFare(e.target.value)}
          />
        </fieldset>

        <fieldset className="space-y-2 border-0 p-0">
          <Label htmlFor="adj-reason">Reason</Label>
          <Input
            id="adj-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. association increase from today"
          />
          <p className="text-xs text-secondary-500">
            The passenger sees the new amount and this reason.
          </p>
        </fieldset>

        {preview && (
          <p className="rounded-xl bg-primary-50 p-3 text-sm" aria-live="polite">
            <span className="flex justify-between">
              <span>{r.passengers} × {formatMoney(preview.farePerSeat, r.currency)}</span>
              <span>{formatMoney(preview.subtotal, r.currency)}</span>
            </span>
            {preview.taxAmount > 0 && (
              <span className="flex justify-between text-secondary-600">
                <span>Tax ({r.taxRate}%)</span>
                <span>{formatMoney(preview.taxAmount, r.currency)}</span>
              </span>
            )}
            <span className="flex justify-between font-semibold pt-1 mt-1 border-t border-primary-200">
              <span>New total</span>
              <span>{formatMoney(preview.total, r.currency)}</span>
            </span>
          </p>
        )}

        {error && reason !== "" && <p className="text-xs text-destructive">{error}</p>}

        <Button
          className="w-full"
          disabled={busy || !!error}
          onClick={() => onSubmit(Number(fare), reason.trim())}
        >
          {busy ? "Saving…" : "Change fare"}
        </Button>

        <section className="space-y-1">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <History className="w-4 h-4 text-secondary-500" /> Previous corrections
          </h3>
          {isLoading ? (
            <p className="flex justify-center py-3">
              <Loader2 className="w-4 h-4 animate-spin text-primary-600" />
            </p>
          ) : history.length === 0 ? (
            <p className="text-xs text-secondary-500">None — this fare is as quoted.</p>
          ) : (
            <ul className="list-none p-0 m-0 text-xs space-y-2">
              {history.map((a) => (
                <li key={a.id} className="border-t border-secondary-100 pt-2 first:border-t-0 first:pt-0">
                  <span className="block">
                    {a.oldTotal != null ? formatMoney(a.oldTotal, a.currency) : "no fare"} →{" "}
                    <strong>{formatMoney(a.newTotal, a.currency)}</strong>
                  </span>
                  <span className="block text-secondary-500">
                    {a.changedAt.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })} · {a.reason}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
};
