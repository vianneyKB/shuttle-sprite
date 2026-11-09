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

export type ProfileSummary = {
  id: string;
  displayName: string;
  phone: string;
};

/**
 * Names and numbers for a set of accounts, keyed by id. `profiles_select` only
 * returns rows other than your own to an admin, so this is empty for everyone
 * else — callers fall back to the id.
 */
export const useProfileSummaries = (userIds: string[]) => {
  const ids = [...new Set(userIds)].sort();
  return useQuery({
    queryKey: ["profile", "summaries", ids],
    enabled: ids.length > 0,
    queryFn: async (): Promise<Map<string, ProfileSummary>> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, phone")
        .in("id", ids);
      if (error) throw error;
      return new Map(
        (data ?? []).map((r) => [
          r.id,
          { id: r.id, displayName: r.display_name ?? "", phone: r.phone ?? "" },
        ])
      );
    },
  });
};
