import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import type { OperatorApplication, OperatorApplicationStatus } from "@/types";

export type DbOperatorApplication = {
  id: string;
  user_id: string;
  status: OperatorApplicationStatus;
  requested_at: string;
  decided_at: string | null;
  decided_by: string | null;
  decision_note: string | null;
};

export const mapOperatorApplication = (a: DbOperatorApplication): OperatorApplication => ({
  id: a.id,
  userId: a.user_id,
  status: a.status,
  requestedAt: new Date(a.requested_at),
  decidedAt: a.decided_at ? new Date(a.decided_at) : undefined,
  decidedBy: a.decided_by ?? undefined,
  decisionNote: a.decision_note ?? undefined,
});

/**
 * Every operator application, oldest first so the longest wait is at the top.
 * `operator_applications_select` gives a non-admin only their own row, so this
 * is the admin list.
 */
export const useOperatorApplications = () => {
  const { user, isAdmin } = useAuth();
  return useQuery({
    queryKey: ["operator_applications", "all"],
    enabled: !!user && isAdmin,
    queryFn: async (): Promise<OperatorApplication[]> => {
      const { data, error } = await supabase
        .from("operator_applications")
        .select("*")
        .order("requested_at", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as DbOperatorApplication[]).map(mapOperatorApplication);
    },
  });
};

/** The signed-in account's own application, or null if it never applied. */
export const useMyOperatorApplication = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["operator_applications", "mine", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<OperatorApplication | null> => {
      const { data, error } = await supabase
        .from("operator_applications")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data ? mapOperatorApplication(data as DbOperatorApplication) : null;
    },
  });
};

export type ReviewInput = {
  userId: string;
  approve: boolean;
  /** Required when rejecting; the RPC refuses a refusal without one. */
  note?: string;
};

/**
 * Approve or reject an application. review_operator_application() is the only
 * path: it stamps the decision and inserts the operator role as one unit, so
 * an approved application and a granted role cannot drift apart.
 */
export const useReviewOperatorApplication = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, approve, note }: ReviewInput): Promise<OperatorApplication> => {
      const { data, error } = await supabase.rpc("review_operator_application", {
        _user_id: userId,
        _approve: approve,
        _note: note?.trim() ? note.trim() : null,
      });
      if (error) throw error;
      return mapOperatorApplication(data as unknown as DbOperatorApplication);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["operator_applications"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
};
