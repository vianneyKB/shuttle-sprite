import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAddRouteFare, useEndRouteFare, useRouteFares, fareInForce, resolveFare } from "@/hooks/useRouteFares";
import { useMyOperatorSettings } from "@/hooks/useOperatorSettings";
import { formatMoney } from "@/lib/money";
import type { RouteFare, ShuttleRoute } from "@/types";
import { Loader2, Plus, Ban } from "lucide-react";
import { toast } from "sonner";

const todayIso = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

type Props = { route: ShuttleRoute; open: boolean; onOpenChange: (o: boolean) => void };

export const RouteFaresDialog: React.FC<Props> = ({ route, open, onOpenChange }) => {
  const { data: fares = [], isLoading } = useRouteFares(open ? route.id : undefined);
  const { data: settings } = useMyOperatorSettings();
  const currency = settings?.currency;
  const add = useAddRouteFare();
  const end = useEndRouteFare();

  const [scope, setScope] = useState<"route" | "segment">("route");
  const [fromStopId, setFromStopId] = useState("");
  const [toStopId, setToStopId] = useState("");
  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState(todayIso());

  const stopName = (id?: string) => route.stops.find((s) => s.id === id)?.name ?? "?";
  const today = todayIso();

  const { current, upcoming, past } = useMemo(() => {
    const cur = fares.filter((f) => fareInForce(f, today));
    const up = fares.filter((f) => f.effectiveFrom > today);
    const pa = fares.filter((f) => !fareInForce(f, today) && f.effectiveFrom <= today);
    return { current: cur, upcoming: up, past: pa };
  }, [fares, today]);

  const routeFareNow = resolveFare(fares, undefined, undefined, today);

  const submit = async () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Enter a fare of 0 or more");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || from < today) {
      toast.error("The start date must be today or later");
      return;
    }
    if (scope === "segment" && (!fromStopId || !toStopId || fromStopId === toStopId)) {
      toast.error("Pick two different stops for a segment fare");
      return;
    }
    try {
      await add.mutateAsync({
        routeId: route.id,
        fromStopId: scope === "segment" ? fromStopId : undefined,
        toStopId: scope === "segment" ? toStopId : undefined,
        farePerSeat: Math.round(n * 100) / 100,
        effectiveFrom: from,
      });
      toast.success(from === today ? "Fare set" : `Fare scheduled from ${fmtDate(from)}`);
      setAmount("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not save fare");
    }
  };

  const endFare = async (f: RouteFare) => {
    const starts = f.effectiveFrom > today;
    if (!confirm(starts ? "Remove this scheduled fare?" : "End this fare today? Rides already requested keep the fare they were quoted.")) return;
    try {
      await end.mutateAsync({ fare: f, effectiveTo: today });
      toast.success(starts ? "Scheduled fare removed" : "Fare ended");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not update fare");
    }
  };

  const FareRow = ({ f, canEnd }: { f: RouteFare; canEnd: boolean }) => (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2 border-t first:border-t-0 border-secondary-100 text-sm">
      <span>
        {f.fromStopId ? (
          <span>{stopName(f.fromStopId)} → {stopName(f.toStopId)}</span>
        ) : (
          <span className="font-medium">Whole route</span>
        )}
        <span className="block text-xs text-secondary-500">
          from {fmtDate(f.effectiveFrom)}{f.effectiveTo ? ` to ${fmtDate(f.effectiveTo)}` : ""}
        </span>
      </span>
      <span className="flex items-center gap-2">
        <strong>{formatMoney(f.farePerSeat, currency)}</strong>
        <span className="text-xs text-secondary-500">/ seat</span>
        {canEnd && (
          <Button variant="ghost" size="sm" aria-label="End fare" onClick={() => endFare(f)} disabled={end.isPending}>
            <Ban className="w-4 h-4" />
          </Button>
        )}
      </span>
    </li>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fares · {route.name}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-secondary-600">
          Per seat, in {currency ?? "your currency"}; {settings?.taxRate ? `${settings.taxLabel} ${settings.taxRate}% is ${settings.pricesIncludeTax ? "included" : "added"} at checkout. ` : ""}
          A fare increase is a new fare with a start date — passengers who already requested keep what they were quoted.
        </p>

        {isLoading ? (
          <p className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-primary-600" /></p>
        ) : (
          <>
            <section>
              <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
                Current
                {routeFareNow ? (
                  <Badge className="bg-green-100 text-green-800">{formatMoney(routeFareNow.farePerSeat, currency)} / seat</Badge>
                ) : (
                  <Badge className="bg-orange-100 text-orange-800">no route fare — passengers pay on board</Badge>
                )}
              </h3>
              {current.length > 0 && (
                <ul className="list-none p-0 m-0">
                  {current.map((f) => <FareRow key={f.id} f={f} canEnd />)}
                </ul>
              )}
            </section>

            {upcoming.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold mb-1">Scheduled</h3>
                <ul className="list-none p-0 m-0">
                  {upcoming.map((f) => <FareRow key={f.id} f={f} canEnd />)}
                </ul>
              </section>
            )}

            {past.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-secondary-600">Past fares ({past.length})</summary>
                <ul className="list-none p-0 m-0 mt-1 opacity-70">
                  {past.map((f) => <FareRow key={f.id} f={f} canEnd={false} />)}
                </ul>
              </details>
            )}
          </>
        )}

        <section className="rounded-xl border border-secondary-200 p-3 space-y-3">
          <h3 className="text-sm font-semibold">Add a fare</h3>
          <p className="grid grid-cols-2 gap-2">
            <Button type="button" size="sm" variant={scope === "route" ? "default" : "outline"} onClick={() => setScope("route")}>Whole route</Button>
            <Button type="button" size="sm" variant={scope === "segment" ? "default" : "outline"} onClick={() => setScope("segment")}>One segment</Button>
          </p>
          {scope === "segment" && (
            <p className="grid grid-cols-2 gap-2">
              <Select value={fromStopId} onValueChange={setFromStopId}>
                <SelectTrigger aria-label="From stop"><SelectValue placeholder="From" /></SelectTrigger>
                <SelectContent>{route.stops.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={toStopId} onValueChange={setToStopId}>
                <SelectTrigger aria-label="To stop"><SelectValue placeholder="To" /></SelectTrigger>
                <SelectContent>{route.stops.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </p>
          )}
          <p className="grid grid-cols-2 gap-2">
            <span>
              <Label htmlFor="fare-amount">Fare per seat ({currency ?? "…"})</Label>
              <Input id="fare-amount" type="number" inputMode="decimal" min={0} step="0.5" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 18" />
            </span>
            <span>
              <Label htmlFor="fare-from">Applies from</Label>
              <Input id="fare-from" type="date" min={today} value={from} onChange={(e) => setFrom(e.target.value)} />
            </span>
          </p>
          <Button type="button" size="sm" onClick={submit} disabled={add.isPending || amount === ""}>
            <Plus className="w-4 h-4 mr-1" /> {add.isPending ? "Saving…" : "Add fare"}
          </Button>
        </section>
      </DialogContent>
    </Dialog>
  );
};
