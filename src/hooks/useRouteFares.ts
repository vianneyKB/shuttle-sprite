import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import type { RideFareQuote, RouteFare } from "@/types";

export type DbRouteFare = {
  id: string;
  route_id: string;
  from_stop_id: string | null;
  to_stop_id: string | null;
  fare_per_seat: number;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
};

export const mapRouteFare = (f: DbRouteFare): RouteFare => ({
  id: f.id,
  routeId: f.route_id,
  fromStopId: f.from_stop_id ?? undefined,
  toStopId: f.to_stop_id ?? undefined,
  farePerSeat: Number(f.fare_per_seat),
  effectiveFrom: f.effective_from,
  effectiveTo: f.effective_to ?? undefined,
  createdAt: new Date(f.created_at),
});

const todayIso = () => new Date().toISOString().slice(0, 10);

/** Is this fare in force on `day` (YYYY-MM-DD)? */
export const fareInForce = (f: Pick<RouteFare, "effectiveFrom" | "effectiveTo">, day = todayIso()) =>
  f.effectiveFrom <= day && (!f.effectiveTo || f.effectiveTo >= day);

/**
 * Which fare applies for an origin → destination on `day`: the segment fare
 * if one is in force, else the whole-route fare. Mirrors quote_ride_fare()
 * so the operator's fare table can show "current" without a round trip.
 */
export const resolveFare = (
  fares: RouteFare[],
  fromStopId: string | undefined,
  toStopId: string | undefined,
  day = todayIso()
): RouteFare | undefined => {
  const inForce = fares.filter((f) => fareInForce(f, day));
  const latest = (list: RouteFare[]) =>
    [...list].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (fromStopId && toStopId) {
    const seg = latest(inForce.filter((f) => f.fromStopId === fromStopId && f.toStopId === toStopId));
    if (seg) return seg;
  }
  return latest(inForce.filter((f) => !f.fromStopId && !f.toStopId));
};

export const useRouteFares = (routeId: string | undefined) =>
  useQuery({
    queryKey: ["route_fares", routeId],
    enabled: !!routeId,
    queryFn: async (): Promise<RouteFare[]> => {
      const { data, error } = await supabase
        .from("route_fares")
        .select("*")
        .eq("route_id", routeId!)
        .order("effective_from", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as DbRouteFare[]).map(mapRouteFare);
    },
  });

export type RouteFareInput = {
  routeId: string;
  fromStopId?: string;
  toStopId?: string;
  farePerSeat: number;
  effectiveFrom: string; // YYYY-MM-DD
};

/** Adds a fare row. Fares are history: an increase is a new row, never an edit. */
export const useAddRouteFare = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: RouteFareInput) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("route_fares").insert({
        route_id: input.routeId,
        from_stop_id: input.fromStopId ?? null,
        to_stop_id: input.toStopId ?? null,
        fare_per_seat: input.farePerSeat,
        effective_from: input.effectiveFrom,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["route_fares", v.routeId] }),
  });
};

/** Ends a fare on `effectiveTo` (or deletes it if it hasn't started yet). */
export const useEndRouteFare = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ fare, effectiveTo }: { fare: RouteFare; effectiveTo: string }) => {
      if (fare.effectiveFrom > todayIso()) {
        const { error } = await supabase.from("route_fares").delete().eq("id", fare.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("route_fares").update({ effective_to: effectiveTo }).eq("id", fare.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["route_fares", v.fare.routeId] }),
  });
};

export const mapQuote = (raw: Record<string, unknown>): RideFareQuote => ({
  source: (raw.source as RideFareQuote["source"]) ?? "none",
  farePerSeat: raw.farePerSeat == null ? undefined : Number(raw.farePerSeat),
  passengers: Number(raw.passengers ?? 1),
  currency: (raw.currency as string) ?? "ZAR",
  subtotal: raw.subtotal == null ? undefined : Number(raw.subtotal),
  taxRate: Number(raw.taxRate ?? 0),
  taxLabel: (raw.taxLabel as string) ?? "Tax",
  taxAmount: raw.taxAmount == null ? undefined : Number(raw.taxAmount),
  pricesIncludeTax: Boolean(raw.pricesIncludeTax ?? false),
  total: raw.total == null ? undefined : Number(raw.total),
});

/** Live quote for the ride request form. Re-runs when any argument changes. */
export const useRideFareQuote = (args: {
  routeId: string;
  fromStopId?: string;
  toStopId?: string;
  passengers: number;
  at?: string;
}) =>
  useQuery({
    queryKey: ["ride_fare_quote", args.routeId, args.fromStopId, args.toStopId, args.passengers, args.at ?? null],
    enabled: !!args.fromStopId && !!args.toStopId && args.passengers >= 1,
    staleTime: 30_000,
    queryFn: async (): Promise<RideFareQuote> => {
      const { data, error } = await supabase.rpc("quote_ride_fare", {
        _route_id: args.routeId,
        _from_stop_id: args.fromStopId!,
        _to_stop_id: args.toStopId!,
        _passengers: args.passengers,
        ...(args.at ? { _at: args.at } : {}),
      });
      if (error) throw error;
      return mapQuote((data ?? {}) as Record<string, unknown>);
    },
  });
