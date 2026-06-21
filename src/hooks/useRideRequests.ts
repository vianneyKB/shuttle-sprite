import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import type { PassengerQueueGroup, PaymentMethod, RideRequest, RideRequestStatus } from "@/types";

type DbRideRequest = {
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
  created_at: string;
  updated_at: string;
};

const mapRideRequest = (r: DbRideRequest): RideRequest => ({
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

export const usePassengerQueue = () =>
  useQuery({
    queryKey: ["passenger_queue"],
    queryFn: async (): Promise<PassengerQueueGroup[]> => {
      const { data, error } = await supabase.rpc("get_passenger_queue");
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => ({
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

export const useUpdateRideRequestStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: RideRequestStatus }) => {
      const { error } = await supabase
        .from("ride_requests")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ride_requests"] });
      qc.invalidateQueries({ queryKey: ["passenger_queue"] });
    },
  });
};
