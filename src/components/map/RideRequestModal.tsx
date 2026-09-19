import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Loader2, Zap, CalendarClock } from "lucide-react";
import type { PaymentMethod, RouteStop, ShuttleRoute } from "@/types";
import { useCreateRideRequest } from "@/hooks/useRideRequests";
import { useMyProfile, useUpdateMyProfile } from "@/hooks/useProfile";
import { useRideFareQuote } from "@/hooks/useRouteFares";
import { formatMoney } from "@/lib/money";
import { earliestScheduleTime, fromLocalInputValue, toLocalInputValue } from "@/lib/schedule";
import { toast } from "sonner";

type RideRequestModalProps = {
  route: ShuttleRoute;
  originStop: RouteStop;
  onClose: () => void;
};

export const RideRequestModal: React.FC<RideRequestModalProps> = ({
  route,
  originStop,
  onClose,
}) => {
  const create = useCreateRideRequest();
  const { data: profile } = useMyProfile();
  const updateProfile = useUpdateMyProfile();
  const needsPhone = !!profile && !profile.phone;
  const [phone, setPhone] = useState("");
  const [destinationStopId, setDestinationStopId] = useState("");
  const [passengers, setPassengers] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [notes, setNotes] = useState("");
  const [when, setWhen] = useState<"now" | "later">("now");
  const [scheduledLocal, setScheduledLocal] = useState(() => toLocalInputValue(earliestScheduleTime()));

  const destStops = route.stops.filter((s) => s.id !== originStop.id);

  const scheduledIso = when === "later" ? fromLocalInputValue(scheduledLocal)?.toISOString() : undefined;
  const quote = useRideFareQuote({
    routeId: route.id,
    fromStopId: originStop.id,
    toStopId: destinationStopId || undefined,
    passengers,
    at: scheduledIso,
  });

  const submit = async () => {
    const dest = destStops.find((s) => s.id === destinationStopId);
    if (!dest) {
      toast.error("Select a destination stop");
      return;
    }
    if (needsPhone && !/^\+?[0-9 ()-]{7,20}$/.test(phone.trim())) {
      toast.error("Add a mobile number so the driver can reach you");
      return;
    }
    let scheduledAt: string | undefined;
    if (when === "later") {
      const d = fromLocalInputValue(scheduledLocal);
      if (!d) {
        toast.error("Pick a date and time for the ride");
        return;
      }
      if (d.getTime() < earliestScheduleTime().getTime()) {
        toast.error("Scheduled rides need at least 15 minutes' notice");
        return;
      }
      scheduledAt = d.toISOString();
    }
    try {
      if (needsPhone) await updateProfile.mutateAsync({ phone });
      await create.mutateAsync({
        routeId: route.id,
        originStopId: originStop.id,
        destinationStopId: dest.id,
        passengers,
        paymentMethod,
        notes: notes || undefined,
        scheduledAt,
      });
      toast.success(scheduledAt ? "Ride scheduled — we'll confirm closer to the time" : "Ride request submitted — awaiting pickup");
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to submit request");
    }
  };

  return (
    <section className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <section className="bg-white rounded-t-2xl sm:rounded-2xl max-w-md w-full p-6 space-y-4">
        <header className="flex justify-between items-start gap-3">
          <>
            <h2 className="text-xl font-bold">Request a ride</h2>
            <p className="text-sm text-secondary-600 mt-1">
              From <strong>{originStop.name}</strong> on {route.name}
            </p>
          </>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="w-5 h-5" />
          </Button>
        </header>

        <fieldset className="space-y-2 border-0 p-0">
          <Label>Destination</Label>
          <Select value={destinationStopId} onValueChange={setDestinationStopId}>
            <SelectTrigger>
              <SelectValue placeholder="Where are you going?" />
            </SelectTrigger>
            <SelectContent>
              {destStops.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </fieldset>

        <fieldset className="space-y-2 border-0 p-0">
          <Label>When</Label>
          <p className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={when === "now" ? "default" : "outline"}
              onClick={() => setWhen("now")}
              aria-pressed={when === "now"}
            >
              <Zap className="w-4 h-4 mr-1" /> Now
            </Button>
            <Button
              type="button"
              variant={when === "later" ? "default" : "outline"}
              onClick={() => setWhen("later")}
              aria-pressed={when === "later"}
            >
              <CalendarClock className="w-4 h-4 mr-1" /> Later
            </Button>
          </p>
          {when === "later" && (
            <>
              <Input
                id="scheduledAt"
                aria-label="Pickup date and time"
                type="datetime-local"
                min={toLocalInputValue(earliestScheduleTime())}
                value={scheduledLocal}
                onChange={(e) => setScheduledLocal(e.target.value)}
              />
              <p className="text-xs text-secondary-500">
                Pickup time at {originStop.name}
                {route.operatingHours ? ` · route runs ${route.operatingHours}` : ""}
              </p>
            </>
          )}
        </fieldset>

        {needsPhone && (
          <fieldset className="space-y-2 border-0 p-0">
            <Label htmlFor="rr-phone">Mobile number</Label>
            <Input
              id="rr-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="So the driver can reach you"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </fieldset>
        )}

        <fieldset className="space-y-2 border-0 p-0">
          <Label htmlFor="passengers">Passengers</Label>
          <Input
            id="passengers"
            type="number"
            min={1}
            max={50}
            value={passengers}
            onChange={(e) => setPassengers(Number(e.target.value))}
          />
        </fieldset>

        <fieldset className="space-y-2 border-0 p-0">
          <Label>Payment</Label>
          <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Pay cash on board</SelectItem>
              <SelectItem value="prepay">Pay in advance</SelectItem>
            </SelectContent>
          </Select>
        </fieldset>

        <fieldset className="space-y-2 border-0 p-0">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </fieldset>

        <section className="rounded-xl bg-primary-50 p-3 text-sm" aria-live="polite">
          {!destinationStopId ? (
            <p className="text-secondary-600">Choose a destination to see the fare.</p>
          ) : quote.isLoading ? (
            <p className="flex items-center gap-2 text-secondary-600"><Loader2 className="w-4 h-4 animate-spin" /> Getting fare…</p>
          ) : quote.data && quote.data.total != null ? (
            <>
              <p className="flex justify-between">
                <span>{passengers} × {formatMoney(quote.data.farePerSeat ?? 0, quote.data.currency)} per seat</span>
                <span>{formatMoney(quote.data.subtotal ?? 0, quote.data.currency)}</span>
              </p>
              {quote.data.taxAmount != null && quote.data.taxAmount > 0 && (
                <p className="flex justify-between text-secondary-600">
                  <span>{quote.data.taxLabel} ({quote.data.taxRate}%){quote.data.pricesIncludeTax ? " incl." : ""}</span>
                  <span>{formatMoney(quote.data.taxAmount, quote.data.currency)}</span>
                </p>
              )}
              <p className="flex justify-between font-semibold text-base pt-1 border-t border-primary-200 mt-1">
                <span>Fare</span>
                <span>{formatMoney(quote.data.total, quote.data.currency)}</span>
              </p>
            </>
          ) : (
            <p className="text-secondary-600">No fare set for this trip — pay the driver on board.</p>
          )}
        </section>

        <Button className="w-full" onClick={submit} disabled={create.isPending}>
          {create.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting…
            </>
          ) : (
            "Submit request"
          )}
        </Button>
      </section>
    </section>
  );
};
