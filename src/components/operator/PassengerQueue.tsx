import React, { useMemo, useState } from "react";
import { useOperatorRideRequests, useDispatchRideRequest, type DispatchInput } from "@/hooks/useRideRequests";
import { useMyVehicles } from "@/hooks/useVehicles";
import { useRideRequestsRealtime } from "@/hooks/useRideRequestsRealtime";
import type { RideRequest, RideRequestStatus, Vehicle } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, MapPin, ArrowRight, Loader2, ChevronDown, ChevronUp, Bus, Play, Check, X, Clock } from "lucide-react";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const statusColor: Record<RideRequestStatus, string> = {
  awaiting: "bg-orange-100 text-orange-800",
  confirmed: "bg-blue-100 text-blue-800",
  in_progress: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const groupKey = (r: RideRequest) => `${r.originName}→${r.destinationName}`;

const formatWhen = (r: RideRequest) => {
  if (r.scheduledAt) {
    return `for ${new Date(r.scheduledAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}`;
  }
  const mins = Math.max(0, Math.round((Date.now() - r.createdAt.getTime()) / 60000));
  return mins < 1 ? "just now" : mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`;
};

const vehicleLabel = (v: Vehicle) => `${v.make} ${v.model} · ${v.capacity} seats`;

/* ------------------------------------------------------------------ */
/* Vehicle picker                                                      */
/* ------------------------------------------------------------------ */

const VehicleSelect: React.FC<{
  vehicles: Vehicle[];
  value?: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
}> = ({ vehicles, value, onChange, disabled, placeholder = "Assign vehicle" }) => (
  <Select value={value ?? ""} onValueChange={onChange} disabled={disabled || vehicles.length === 0}>
    <SelectTrigger className="h-9 min-w-[200px] text-xs sm:text-sm" aria-label="Assign vehicle">
      <SelectValue placeholder={vehicles.length === 0 ? "No vehicles in fleet" : placeholder} />
    </SelectTrigger>
    <SelectContent>
      {vehicles.map((v) => (
        <SelectItem key={v.id} value={v.id} disabled={!v.available}>
          {vehicleLabel(v)}
          {!v.available ? " (unavailable)" : ""}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

/* ------------------------------------------------------------------ */
/* One request row                                                     */
/* ------------------------------------------------------------------ */

const RequestRow: React.FC<{
  request: RideRequest;
  vehicles: Vehicle[];
  busy: boolean;
  onDispatch: (input: DispatchInput, successMsg: string) => void;
}> = ({ request: r, vehicles, busy, onDispatch }) => {
  const vehicle = vehicles.find((v) => v.id === r.vehicleId);
  return (
    <li className="flex flex-col gap-3 py-3 border-t first:border-t-0 border-secondary-100">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <Badge className={statusColor[r.status]}>{r.status.replace("_", " ")}</Badge>
        <span className="flex items-center gap-1">
          <Users className="w-4 h-4 text-secondary-500" /> {r.passengers}
        </span>
        <span className="capitalize text-secondary-600">
          {r.paymentMethod} · {r.paymentStatus.replace("_", " ")}
        </span>
        <span className="flex items-center gap-1 text-secondary-500">
          <Clock className="w-3.5 h-3.5" /> {formatWhen(r)}
        </span>
        {vehicle && (
          <span className="flex items-center gap-1 text-secondary-700">
            <Bus className="w-4 h-4" /> {vehicle.make} {vehicle.model}
          </span>
        )}
      </p>
      {r.notes && <p className="text-xs text-secondary-500 italic">“{r.notes}”</p>}

      <p className="flex flex-wrap items-center gap-2">
        {r.status !== "completed" && r.status !== "cancelled" && (
          <VehicleSelect
            vehicles={vehicles}
            value={r.vehicleId}
            disabled={busy}
            placeholder={r.vehicleId ? undefined : "Assign vehicle"}
            onChange={(vehicleId) => onDispatch({ id: r.id, vehicleId }, "Vehicle assigned")}
          />
        )}
        {r.status === "awaiting" && (
          <Button size="sm" disabled={busy} onClick={() => onDispatch({ id: r.id, status: "confirmed" }, "Request confirmed")}>
            <Check className="w-4 h-4 mr-1" /> Confirm
          </Button>
        )}
        {r.status === "confirmed" && (
          <Button
            size="sm"
            disabled={busy || !r.vehicleId}
            title={r.vehicleId ? undefined : "Assign a vehicle first"}
            onClick={() => onDispatch({ id: r.id, status: "in_progress" }, "Ride started")}
          >
            <Play className="w-4 h-4 mr-1" /> Start
          </Button>
        )}
        {r.status === "in_progress" && (
          <Button size="sm" disabled={busy} onClick={() => onDispatch({ id: r.id, status: "completed" }, "Ride completed")}>
            <Check className="w-4 h-4 mr-1" /> Complete
          </Button>
        )}
        {(r.status === "awaiting" || r.status === "confirmed" || r.status === "in_progress") && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              if (confirm("Cancel this ride request?")) onDispatch({ id: r.id, status: "cancelled" }, "Request cancelled");
            }}
          >
            <X className="w-4 h-4 mr-1" /> Cancel
          </Button>
        )}
      </p>
    </li>
  );
};

/* ------------------------------------------------------------------ */
/* Waiting group (origin → destination)                                */
/* ------------------------------------------------------------------ */

const WaitingGroup: React.FC<{
  requests: RideRequest[];
  vehicles: Vehicle[];
  busy: boolean;
  onDispatch: (input: DispatchInput, successMsg: string) => void;
  onConfirmAll: (ids: string[], vehicleId: string | undefined) => void;
}> = ({ requests, vehicles, busy, onDispatch, onConfirmAll }) => {
  const [open, setOpen] = useState(false);
  const [bulkVehicle, setBulkVehicle] = useState<string | undefined>();
  const first = requests[0];
  const totalPassengers = requests.reduce((s, r) => s + r.passengers, 0);
  const bulkCapacity = vehicles.find((v) => v.id === bulkVehicle)?.capacity;

  return (
    <li>
      <Card className="h-full border-l-4 border-l-primary-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-start justify-between gap-2">
            <span className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-primary-600 shrink-0 mt-0.5" />
              <span className="leading-snug">
                {first.originName}
                <ArrowRight className="w-4 h-4 inline mx-1 text-secondary-400" />
                {first.destinationName}
              </span>
            </span>
            <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
              {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <p className="flex gap-6 text-sm">
            <span className="flex items-center gap-2">
              <Users className="w-4 h-4 text-secondary-500" />
              <strong className="text-lg text-primary-600">{totalPassengers}</strong> passenger{totalPassengers !== 1 ? "s" : ""}
            </span>
            <span className="text-secondary-600 self-center">
              {requests.length} request{requests.length !== 1 ? "s" : ""}
            </span>
          </p>

          <p className="flex flex-wrap items-center gap-2">
            <VehicleSelect vehicles={vehicles} value={bulkVehicle} onChange={setBulkVehicle} disabled={busy} placeholder="Vehicle for all" />
            <Button
              size="sm"
              disabled={busy}
              onClick={() => onConfirmAll(requests.map((r) => r.id), bulkVehicle)}
            >
              <Check className="w-4 h-4 mr-1" /> Confirm all
            </Button>
            {bulkCapacity !== undefined && totalPassengers > bulkCapacity && (
              <span className="text-xs text-orange-700">
                {totalPassengers} passengers &gt; {bulkCapacity} seats
              </span>
            )}
          </p>

          {open && (
            <ul className="list-none p-0 m-0">
              {requests.map((r) => (
                <RequestRow key={r.id} request={r} vehicles={vehicles} busy={busy} onDispatch={onDispatch} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </li>
  );
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export const PassengerQueue: React.FC = () => {
  const { data: requests = [], isLoading } = useOperatorRideRequests();
  const { data: vehicles = [] } = useMyVehicles();
  const dispatch = useDispatchRideRequest();

  // New requests and other operators' actions appear without a refresh.
  useRideRequestsRealtime("operator");

  const { waitingGroups, active } = useMemo(() => {
    const groups = new Map<string, RideRequest[]>();
    const active: RideRequest[] = [];
    for (const r of requests) {
      if (r.status === "awaiting") {
        const k = groupKey(r);
        groups.set(k, [...(groups.get(k) ?? []), r]);
      } else if (r.status === "confirmed" || r.status === "in_progress") {
        active.push(r);
      }
    }
    // Busiest direction first, like the old aggregated queue.
    const waitingGroups = [...groups.values()].sort(
      (a, b) => b.reduce((s, r) => s + r.passengers, 0) - a.reduce((s, r) => s + r.passengers, 0)
    );
    return { waitingGroups, active };
  }, [requests]);

  const onDispatch = async (input: DispatchInput, successMsg: string) => {
    try {
      await dispatch.mutateAsync(input);
      toast.success(successMsg);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const onConfirmAll = async (ids: string[], vehicleId: string | undefined) => {
    let ok = 0;
    for (const id of ids) {
      try {
        await dispatch.mutateAsync({ id, status: "confirmed", vehicleId });
        ok += 1;
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Update failed");
      }
    }
    if (ok > 0) toast.success(`${ok} request${ok !== 1 ? "s" : ""} confirmed`);
  };

  if (isLoading) {
    return (
      <p className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </p>
    );
  }

  return (
    <section className="space-y-8">
      <header className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-secondary-900">Passenger queue</h2>
        <p className="text-secondary-600 text-sm sm:text-base max-w-xl mx-auto">
          Passengers waiting by direction. Confirm a group, assign a vehicle, then start and complete the ride.
        </p>
      </header>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Waiting ({waitingGroups.reduce((s, g) => s + g.length, 0)})</h3>
        {waitingGroups.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-secondary-600">No passengers waiting right now.</CardContent>
          </Card>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 list-none p-0 m-0">
            {waitingGroups.map((g) => (
              <WaitingGroup
                key={groupKey(g[0])}
                requests={g}
                vehicles={vehicles}
                busy={dispatch.isPending}
                onDispatch={onDispatch}
                onConfirmAll={onConfirmAll}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Active rides ({active.length})</h3>
        {active.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-secondary-600">No confirmed or in-progress rides.</CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-4 sm:p-6">
              <ul className="list-none p-0 m-0">
                {active.map((r) => (
                  <li key={r.id} className="border-t first:border-t-0 border-secondary-100 pt-3 first:pt-0 mt-3 first:mt-0">
                    <p className="flex items-center gap-2 text-sm font-medium mb-1">
                      <MapPin className="w-4 h-4 text-primary-600 shrink-0" />
                      {r.originName}
                      <ArrowRight className="w-4 h-4 text-secondary-400" />
                      {r.destinationName}
                    </p>
                    <ul className="list-none p-0 m-0">
                      <RequestRow request={r} vehicles={vehicles} busy={dispatch.isPending} onDispatch={onDispatch} />
                    </ul>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>
    </section>
  );
};
