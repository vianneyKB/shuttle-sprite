import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

type Scope = "customer" | "operator";

/**
 * Subscribes to postgres_changes on ride_requests and invalidates the
 * TanStack queries that render them. RLS decides which rows a subscriber
 * receives, so operators need no filter; passengers filter to their own
 * rows to avoid a subscription that RLS would leave empty anyway.
 *
 * Invalidation is coalesced: a burst of events (e.g. "Confirm all") causes
 * one refetch, not one per row.
 */
export const useRideRequestsRealtime = (
  scope: Scope,
  onChange?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
) => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const timer = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!user) return;

    const invalidate = () => {
      if (timer.current !== null) return;
      timer.current = window.setTimeout(() => {
        timer.current = null;
        void qc.invalidateQueries({ queryKey: ["ride_requests"] });
        void qc.invalidateQueries({ queryKey: ["passenger_queue"] });
      }, 250);
    };

    // StrictMode mounts effects twice in dev; a unique channel name per
    // scope+user keeps the two subscriptions from colliding.
    const channel = supabase
      .channel(`ride_requests:${scope}:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ride_requests",
          ...(scope === "customer" ? { filter: `customer_id=eq.${user.id}` } : {}),
        },
        (payload) => {
          onChangeRef.current?.(payload);
          invalidate();
        }
      )
      .subscribe();

    return () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [qc, scope, user]);
};
