import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Loader2 } from "lucide-react";
import type { PaymentMethod, RouteStop, ShuttleRoute } from "@/types";
import { useCreateRideRequest } from "@/hooks/useRideRequests";
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
  const [destinationStopId, setDestinationStopId] = useState("");
  const [passengers, setPassengers] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [notes, setNotes] = useState("");

  const destStops = route.stops.filter((s) => s.id !== originStop.id);

  const submit = async () => {
    const dest = destStops.find((s) => s.id === destinationStopId);
    if (!dest) {
      toast.error("Select a destination stop");
      return;
    }
    try {
      await create.mutateAsync({
        routeId: route.id,
        originName: originStop.name,
        originLat: originStop.lat,
        originLng: originStop.lng,
        destinationName: dest.name,
        destinationLat: dest.lat,
        destinationLng: dest.lng,
        passengers,
        paymentMethod,
        notes: notes || undefined,
      });
      toast.success("Ride request submitted — awaiting pickup");
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
