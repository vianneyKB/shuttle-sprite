import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import type { Vehicle } from "@/types";

type DbVehicle = {
  id: string;
  vendor_id: string;
  make: string;
  model: string;
  year: number;
  capacity: number;
  price_per_hour: number;
  price_per_day: number;
  location: string;
  features: string[];
  image: string | null;
  available: boolean;
  rating: number;
  reviews: number;
  created_at: string;
  updated_at: string;
};

const mapVehicle = (v: DbVehicle, vendorName = "Vendor"): Vehicle => ({
  id: v.id,
  vendorId: v.vendor_id,
  vendorName,
  make: v.make,
  model: v.model,
  year: v.year,
  capacity: v.capacity,
  pricePerHour: Number(v.price_per_hour),
  pricePerDay: Number(v.price_per_day),
  location: v.location,
  features: v.features ?? [],
  image: v.image ?? "",
  available: v.available,
  rating: Number(v.rating),
  reviews: v.reviews,
  createdAt: new Date(v.created_at),
  updatedAt: new Date(v.updated_at),
});

export const useVehicles = () =>
  useQuery({
    queryKey: ["vehicles", "all"],
    queryFn: async (): Promise<Vehicle[]> => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as DbVehicle[]).map((v) => mapVehicle(v));
    },
  });

export const useMyVehicles = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["vehicles", "mine", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Vehicle[]> => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("vendor_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as DbVehicle[]).map((v) => mapVehicle(v));
    },
  });
};

export type VehicleInput = {
  make: string;
  model: string;
  year: number;
  capacity: number;
  pricePerHour: number;
  pricePerDay: number;
  location: string;
  features: string[];
  image?: string;
  available?: boolean;
};

export const useUpsertVehicle = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: VehicleInput }) => {
      if (!user) throw new Error("Not authenticated");
      const payload = {
        vendor_id: user.id,
        make: input.make,
        model: input.model,
        year: input.year,
        capacity: input.capacity,
        price_per_hour: input.pricePerHour,
        price_per_day: input.pricePerDay,
        location: input.location,
        features: input.features,
        image: input.image ?? null,
        available: input.available ?? true,
      };
      if (id) {
        const { error } = await supabase.from("vehicles").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vehicles").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });
};

export const useToggleVehicleAvailability = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, available }: { id: string; available: boolean }) => {
      const { error } = await supabase.from("vehicles").update({ available }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicles"] }),
  });
};

export const useDeleteVehicle = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicles"] }),
  });
};