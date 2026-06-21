import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import type { RouteStop, ShuttleRoute } from "@/types";

type DbRoute = {
  id: string;
  operator_id: string;
  name: string;
  description: string | null;
  operating_hours: string | null;
  geometry: GeoJSON.LineString;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type DbRouteStop = {
  id: string;
  route_id: string;
  name: string;
  description: string | null;
  stop_order: number;
  lat: number;
  lng: number;
};

const mapStop = (s: DbRouteStop): RouteStop => ({
  id: s.id,
  routeId: s.route_id,
  name: s.name,
  description: s.description ?? undefined,
  stopOrder: s.stop_order,
  lat: Number(s.lat),
  lng: Number(s.lng),
});

const mapRoute = (r: DbRoute, stops: DbRouteStop[]): ShuttleRoute => ({
  id: r.id,
  operatorId: r.operator_id,
  name: r.name,
  description: r.description ?? undefined,
  operatingHours: r.operating_hours ?? undefined,
  geometry: r.geometry ?? { type: "LineString", coordinates: [] },
  isActive: r.is_active,
  stops: stops
    .filter((s) => s.route_id === r.id)
    .sort((a, b) => a.stop_order - b.stop_order)
    .map(mapStop),
  createdAt: new Date(r.created_at),
  updatedAt: new Date(r.updated_at),
});

const fetchRoutesWithStops = async (routes: DbRoute[]): Promise<ShuttleRoute[]> => {
  if (routes.length === 0) return [];
  const ids = routes.map((r) => r.id);
  const { data: stops, error } = await supabase
    .from("route_stops")
    .select("*")
    .in("route_id", ids);
  if (error) throw error;
  return routes.map((r) => mapRoute(r, (stops ?? []) as unknown as DbRouteStop[]));
};

export const useShuttleRoutes = () =>
  useQuery({
    queryKey: ["shuttle_routes", "all"],
    queryFn: async (): Promise<ShuttleRoute[]> => {
      const { data, error } = await supabase
        .from("shuttle_routes")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return fetchRoutesWithStops((data ?? []) as unknown as DbRoute[]);
    },
  });

export const useMyRoutes = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["shuttle_routes", "mine", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<ShuttleRoute[]> => {
      const { data, error } = await supabase
        .from("shuttle_routes")
        .select("*")
        .eq("operator_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return fetchRoutesWithStops((data ?? []) as unknown as DbRoute[]);
    },
  });
};

export type RouteInput = {
  name: string;
  description?: string;
  operatingHours?: string;
  isActive?: boolean;
  geometry?: GeoJSON.LineString;
};

export type RouteStopInput = {
  name: string;
  description?: string;
  lat: number;
  lng: number;
};

export const useUpsertRoute = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: RouteInput }) => {
      if (!user) throw new Error("Not authenticated");
      const payload = {
        operator_id: user.id,
        name: input.name,
        description: input.description ?? null,
        operating_hours: input.operatingHours ?? null,
        is_active: input.isActive ?? true,
        geometry: input.geometry ?? { type: "LineString", coordinates: [] },
      };
      if (id) {
        const { error } = await supabase
          .from("shuttle_routes")
          .update(payload)
          .eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase
        .from("shuttle_routes")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shuttle_routes"] }),
  });
};

export const useSaveRouteStops = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      routeId,
      stops,
    }: {
      routeId: string;
      stops: RouteStopInput[];
    }) => {
      await supabase.from("route_stops").delete().eq("route_id", routeId);
      if (stops.length === 0) return;
      const coords: [number, number][] = [];
      const payload = stops.map((s, i) => {
        coords.push([s.lng, s.lat]);
        return {
          route_id: routeId,
          name: s.name,
          description: s.description ?? null,
          stop_order: i,
          lat: s.lat,
          lng: s.lng,
        };
      });
      const { error } = await supabase.from("route_stops").insert(payload);
      if (error) throw error;
      const geometry: GeoJSON.LineString = { type: "LineString", coordinates: coords };
      const { error: geoErr } = await supabase
        .from("shuttle_routes")
        .update({ geometry })
        .eq("id", routeId);
      if (geoErr) throw geoErr;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shuttle_routes"] }),
  });
};

export const useDeleteRoute = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shuttle_routes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shuttle_routes"] }),
  });
};
