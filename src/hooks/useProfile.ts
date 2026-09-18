import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export type Profile = {
  id: string;
  displayName: string;
  phone: string;
  email: string;
};

/** The signed-in user's own profile row plus their auth email. */
export const useMyProfile = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", "me", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, phone")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return {
        id: user!.id,
        displayName: data?.display_name ?? "",
        phone: data?.phone ?? "",
        email: user!.email ?? "",
      };
    },
  });
};

export const useUpdateMyProfile = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: Partial<Pick<Profile, "displayName" | "phone">>) => {
      if (!user) throw new Error("Not authenticated");
      const payload: { display_name?: string; phone?: string } = {};
      if (input.displayName !== undefined) payload.display_name = input.displayName.trim();
      if (input.phone !== undefined) payload.phone = input.phone.trim();
      const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
};
