import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import type { AssignedVehicle, PassengerQueueGroup, PaymentMethod, RideRequest, RideRequestStatus } from "@/types";

export type DbRideRequest = {
  id: string;
  customer_id: string;
  route_id: string | null;
  origin_name: string;
  origin_lat: number;
  origin_lng: number;
  destination_name: string;
  destination_lat: number;
  destination_lng: number;
  passengers: number;
  payment_method: PaymentMethod;
  payment_status: string;
  status: RideRequestStatus;
  scheduled_at: string | null;
  notes: string | null;
  operator_id?: string | null;
  vehicle_id?: string | null;
  assigned_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
};

export const mapRideRequest = (r: DbRideRequest): RideRequest => ({
  id: r.id,
  customerId: r.customer_id,
  routeId: r.route_id ?? undefined,
  originName: r.origin_name,
  originLat: Number(r.origin_lat),
  originLng: Number(r.origin_lng),
  destinationName: r.destination_name,
  destinationLat: Number(r.destination_lat),
  destinationLng: Number(r.destination_lng),
  passengers: r.passengers,
  paymentMethod: r.payment_method,
  paymentStatus: r.payment_status as RideRequest["paymentStatus"],
  status: r.status,
  scheduledAt: r.scheduled_at ?? undefined,
  notes: r.notes ?? undefined,
  operatorId: r.operator_id ?? undefined,
  vehicleId: r.vehicle_id ?? undefined,
  assignedAt: r.assigned_at ? new Date(r.assigned_at) : undefined,
  startedAt: r.started_at ? new Date(r.started_at) : undefined,
  completedAt: r.completed_at ? new Date(r.completed_at) : undefined,
  createdAt: new Date(r.created_at),
  updatedAt: new Date(r.updated_at),
});

export type RideRequestInput = {
  routeId?: string;
  originName: string;
  originLat: number;
  originLng: number;
  destinationName: string;
  destinationLat: number;
  destinationLng: number;
  passengers: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  /** ISO instant for a ride booked for later; omit for "as soon as possible". */
  scheduledAt?: string;
};

export const useMyRideRequests = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["ride_requests", "mine", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<RideRequest[]> => {
      const { data, error } = await supabase
        .from("ride_requests")
        .select("*")
        .eq("customer_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as DbRideRequest[]).map(mapRideRequest);
    },
  });
};

export type DbAssignedVehicle = {
  vehicle_id: string;
  make: string;
  model: string;
  year: number;
  capacity: number;
};

export const mapAssignedVehicle = (v: DbAssignedVehicle): AssignedVehicle => ({
  id: v.vehicle_id,
  make: v.make,
  model: v.model,
  year: Number(v.year),
  capacity: Number(v.capacity),
});

/**
 * The vehicles assigned to the passenger's own ride requests, keyed by id.
 * RLS on `vehicles` hides any vehicle the operator has marked unavailable,
 * so this goes through get_my_ride_vehicles() instead. The key sits under
 * ["ride_requests", ...] so the Realtime invalidation refreshes it too.
 */
export const useMyRideVehicles = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["ride_requests", "vehicles", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Map<string, AssignedVehicle>> => {
      const { data, error } = await supabase.rpc("get_my_ride_vehicles");
      if (error) throw error;
      const rows = (data ?? []) as unknown as DbAssignedVehicle[];
      return new Map(rows.map((row) => [row.vehicle_id, mapAssignedVehicle(row)]));
    },
  });
};

/** Individual requests an operator can act on: waiting, confirmed, or under way. RLS scopes to their routes / their own. */
export const useOperatorRideRequests = () => {
  const { user, isOperator, isAdmin } = useAuth();
  return useQuery({
    queryKey: ["ride_requests", "operator", user?.id],
    enabled: !!user && (isOperator || isAdmin),
    queryFn: async (): Promise<RideRequest[]> => {
      const { data, error } = await supabase
        .from("ride_requests")
        .select("*")
        .in("status", ["awaiting", "confirmed", "in_progress"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as unknown as DbRideRequest[]).map(mapRideRequest);
    },
  });
};

export const usePassengerQueue = () =>
  useQuery({
    queryKey: ["passenger_queue"],
    queryFn: async (): Promise<PassengerQueueGroup[]> => {
      const { data, error } = await (supabase.rpc as unknown as (fn: string) => Promise<{ data: Record<string, unknown>[] | null; error: unknown }>)("get_passenger_queue");
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
        originName: row.origin_name as string,
        destinationName: row.destination_name as string,
        originLat: Number(row.origin_lat),
        originLng: Number(row.origin_lng),
        destinationLat: Number(row.destination_lat),
        destinationLng: Number(row.destination_lng),
        requestCount: Number(row.request_count),
        totalPassengers: Number(row.total_passengers),
      }));
    },
  });

export const useCreateRideRequest = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: RideRequestInput) => {
      if (!user) throw new Error("Not authenticated");
      const paymentStatus = input.paymentMethod === "prepay" ? "pending" : "not_required";
      const { error } = await supabase.from("ride_requests").insert({
        customer_id: user.id,
        route_id: input.routeId ?? null,
        origin_name: input.originName,
        origin_lat: input.originLat,
        origin_lng: input.originLng,
        destination_name: input.destinationName,
        destination_lat: input.destinationLat,
        destination_lng: input.destinationLng,
        passengers: input.passengers,
        payment_method: input.paymentMethod,
        payment_status: paymentStatus,
        status: "awaiting",
        notes: input.notes ?? null,
        scheduled_at: input.scheduledAt ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ride_requests"] });
      qc.invalidateQueries({ queryKey: ["passenger_queue"] });
    },
  });
};

export const useCancelRideRequest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ride_requests")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ride_requests"] });
      qc.invalidateQueries({ queryKey: ["passenger_queue"] });
    },
  });
};

export type DispatchInput = {
  id: string;
  /** New status; omit to only (re)assign a vehicle. */
  status?: RideRequestStatus;
  /** Vehicle from the operator's own fleet; omit to leave unchanged. */
  vehicleId?: string;
};

/** All operator-side changes go through dispatch_ride_request, which enforces the status state machine. */
export const useDispatchRideRequest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, vehicleId }: DispatchInput): Promise<RideRequest> => {
      const { data, error } = await supabase.rpc("dispatch_ride_request", {
        _id: id,
        _status: status ?? null,
        _vehicle_id: vehicleId ?? null,
      });
      if (error) throw error;
      return mapRideRequest(data as unknown as DbRideRequest);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ride_requests"] });
      qc.invalidateQueries({ queryKey: ["passenger_queue"] });
    },
  });
};
