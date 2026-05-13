import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import type { Booking, BookingStatus, BookingStop } from "@/types";

type DbBooking = {
  id: string;
  vehicle_id: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  passengers: number;
  start_date: string;
  end_date: string | null;
  days_of_week: string[];
  time: string;
  duration: number;
  total_price: number;
  price_breakdown: any;
  status: BookingStatus;
  special_requests: string | null;
  is_recurring: boolean;
  created_at: string;
  updated_at: string;
};

type DbStop = {
  id: string;
  booking_id: string;
  address: string;
  type: "pickup" | "dropoff" | "stop";
  stop_order: number;
  notes: string | null;
};

const mapBooking = (b: DbBooking, stops: DbStop[]): Booking => ({
  id: b.id,
  vehicleId: b.vehicle_id,
  customerName: b.customer_name,
  customerEmail: b.customer_email,
  customerPhone: b.customer_phone,
  passengers: b.passengers,
  stops: stops
    .filter((s) => s.booking_id === b.id)
    .sort((a, c) => a.stop_order - c.stop_order)
    .map((s) => ({
      id: s.id,
      address: s.address,
      type: s.type,
      order: s.stop_order,
      notes: s.notes ?? undefined,
    })),
  startDate: b.start_date,
  endDate: b.end_date ?? undefined,
  daysOfWeek: b.days_of_week,
  time: b.time,
  duration: Number(b.duration),
  totalPrice: Number(b.total_price),
  basePriceBreakdown: b.price_breakdown ?? {
    hourlyRate: 0,
    duration: 0,
    subtotal: 0,
    additionalStops: 0,
    additionalStopsCost: 0,
    recurringMultiplier: 1,
    finalTotal: Number(b.total_price),
  },
  status: b.status,
  specialRequests: b.special_requests ?? undefined,
  isRecurring: b.is_recurring,
  createdAt: new Date(b.created_at),
  updatedAt: new Date(b.updated_at),
});

const fetchBookingsWithStops = async (bookings: DbBooking[]): Promise<Booking[]> => {
  if (bookings.length === 0) return [];
  const ids = bookings.map((b) => b.id);
  const { data: stops, error } = await supabase
    .from("booking_stops")
    .select("*")
    .in("booking_id", ids);
  if (error) throw error;
  return bookings.map((b) => mapBooking(b, (stops ?? []) as DbStop[]));
};

export const useMyBookings = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["bookings", "mine", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Booking[]> => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("customer_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return fetchBookingsWithStops((data ?? []) as DbBooking[]);
    },
  });
};

export const useVendorBookings = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["bookings", "vendor", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Booking[]> => {
      const { data: vehicles, error: vErr } = await supabase
        .from("vehicles")
        .select("id")
        .eq("vendor_id", user!.id);
      if (vErr) throw vErr;
      const vehicleIds = (vehicles ?? []).map((v) => v.id);
      if (vehicleIds.length === 0) return [];
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .in("vehicle_id", vehicleIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return fetchBookingsWithStops((data ?? []) as DbBooking[]);
    },
  });
};

export type BookingInput = {
  vehicleId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  passengers: number;
  stops: BookingStop[];
  startDate: string;
  time: string;
  duration: number;
  specialRequests?: string;
  daysOfWeek?: string[];
};

export const useCalculatePrice = () =>
  useMutation({
    mutationFn: async (args: {
      vehicleId: string;
      duration: number;
      stopCount: number;
      daysOfWeekCount: number;
    }) => {
      const { data, error } = await supabase.rpc("calculate_booking_price", {
        _vehicle_id: args.vehicleId,
        _duration: args.duration,
        _stop_count: args.stopCount,
        _days_of_week_count: args.daysOfWeekCount,
      });
      if (error) throw error;
      return data as {
        hourlyRate: number;
        duration: number;
        subtotal: number;
        additionalStops: number;
        additionalStopsCost: number;
        recurringMultiplier: number;
        finalTotal: number;
      };
    },
  });

export const useCreateBooking = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: BookingInput) => {
      if (!user) throw new Error("Not authenticated");
      const days = input.daysOfWeek ?? [];
      // Compute price server-side for security
      const { data: priceData, error: priceErr } = await supabase.rpc(
        "calculate_booking_price",
        {
          _vehicle_id: input.vehicleId,
          _duration: input.duration,
          _stop_count: input.stops.length,
          _days_of_week_count: days.length,
        }
      );
      if (priceErr) throw priceErr;
      const price = priceData as { finalTotal: number };

      const { data: created, error } = await supabase
        .from("bookings")
        .insert({
          vehicle_id: input.vehicleId,
          customer_id: user.id,
          customer_name: input.customerName,
          customer_email: input.customerEmail,
          customer_phone: input.customerPhone,
          passengers: input.passengers,
          start_date: input.startDate,
          time: input.time,
          duration: input.duration,
          days_of_week: days,
          is_recurring: days.length > 0,
          special_requests: input.specialRequests ?? null,
          total_price: price.finalTotal,
          price_breakdown: priceData as any,
          status: "pending",
        })
        .select("id")
        .single();
      if (error) throw error;

      const stopsPayload = input.stops.map((s, idx) => ({
        booking_id: created.id,
        address: s.address,
        type: s.type,
        stop_order: idx,
        notes: s.notes ?? null,
      }));
      const { error: stopsErr } = await supabase.from("booking_stops").insert(stopsPayload);
      if (stopsErr) throw stopsErr;
      return created.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookings"] }),
  });
};

export const useUpdateBookingStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: BookingStatus }) => {
      const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookings"] }),
  });
};

export const useCancelBooking = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Customers can update pending → cancelled via RLS
      const { error } = await supabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookings"] }),
  });
};