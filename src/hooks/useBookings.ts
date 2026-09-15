import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import type { Booking, BookingStatus, BookingStop, PaymentMethod, PriceBreakdown } from "@/types";
import { DEFAULT_CURRENCY } from "@/lib/money";

export type DbBooking = {
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
  currency?: string;
  subtotal?: number;
  tax_rate?: number;
  tax_amount?: number;
  price_breakdown: Record<string, unknown>;
  status: BookingStatus;
  special_requests: string | null;
  is_recurring: boolean;
  payment_method?: PaymentMethod;
  payment_status?: string;
  created_at: string;
  updated_at: string;
};

export type DbStop = {
  id: string;
  booking_id: string;
  address: string;
  type: "pickup" | "dropoff" | "stop";
  stop_order: number;
  notes: string | null;
};

export const mapBooking = (b: DbBooking, stops: DbStop[]): Booking => ({
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
  currency: b.currency ?? DEFAULT_CURRENCY,
  // Rows created before pricing snapshots were added: whole total, no tax.
  subtotal: b.subtotal != null ? Number(b.subtotal) : Number(b.total_price),
  taxRate: Number(b.tax_rate ?? 0),
  taxAmount: Number(b.tax_amount ?? 0),
  totalPrice: Number(b.total_price),
  paymentMethod: b.payment_method ?? "cash",
  paymentStatus: (b.payment_status as Booking["paymentStatus"]) ?? "not_required",
  basePriceBreakdown: normaliseBreakdown(b),
  status: b.status,
  specialRequests: b.special_requests ?? undefined,
  isRecurring: b.is_recurring,
  createdAt: new Date(b.created_at),
  updatedAt: new Date(b.updated_at),
});

/** price_breakdown from older rows lacks the currency/tax keys; fill them from the row. */
const normaliseBreakdown = (b: DbBooking): PriceBreakdown => {
  const raw = (b.price_breakdown ?? {}) as Partial<PriceBreakdown>;
  const total = Number(b.total_price);
  return {
    currency: raw.currency ?? b.currency ?? DEFAULT_CURRENCY,
    hourlyRate: Number(raw.hourlyRate ?? 0),
    duration: Number(raw.duration ?? b.duration ?? 0),
    additionalStops: Number(raw.additionalStops ?? 0),
    additionalStopFee: Number(raw.additionalStopFee ?? 0),
    additionalStopsCost: Number(raw.additionalStopsCost ?? 0),
    recurringMultiplier: Number(raw.recurringMultiplier ?? 1),
    pricesIncludeTax: Boolean(raw.pricesIncludeTax ?? false),
    subtotal: Number(raw.subtotal ?? b.subtotal ?? total),
    taxRate: Number(raw.taxRate ?? b.tax_rate ?? 0),
    taxLabel: raw.taxLabel ?? "Tax",
    taxAmount: Number(raw.taxAmount ?? b.tax_amount ?? 0),
    finalTotal: Number(raw.finalTotal ?? total),
  };
};

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

export const useOperatorBookings = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["bookings", "operator", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Booking[]> => {
      const { data: vehicles, error: vErr } = await supabase
        .from("vehicles")
        .select("id")
        .eq("operator_id", user!.id);
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
  paymentMethod?: PaymentMethod;
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
      return data as unknown as PriceBreakdown;
    },
  });

export const useCreateBooking = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: BookingInput) => {
      if (!user) throw new Error("Not authenticated");
      // Pricing, validation and the booking + stops insert all happen inside
      // create_booking (SECURITY DEFINER); the client never sends a price.
      const { data, error } = await supabase.rpc("create_booking", {
        _vehicle_id: input.vehicleId,
        _customer_name: input.customerName,
        _customer_email: input.customerEmail,
        _customer_phone: input.customerPhone,
        _passengers: input.passengers,
        _start_date: input.startDate,
        _time: input.time,
        _duration: input.duration,
        _stops: input.stops.map((s) => ({
          address: s.address,
          type: s.type,
          notes: s.notes ?? null,
        })),
        _days_of_week: input.daysOfWeek ?? [],
        _special_requests: input.specialRequests ?? null,
        _payment_method: input.paymentMethod ?? "cash",
      });
      if (error) throw error;
      return data as string;
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
      const { error } = await supabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookings"] }),
  });
};
