import React from "react";
import { useFareAdjustments } from "@/hooks/useRideRequests";
import { formatMoney } from "@/lib/money";
import type { RideRequest } from "@/types";
import { Badge } from "@/components/ui/badge";

/**
 * Shown on a passenger's ride card only when an operator has corrected the
 * fare. The passenger was quoted a price, so the change and its reason are
 * theirs to see — silently swapping the number would be the wrong thing.
 */
export const FareAdjustedNote: React.FC<{ request: RideRequest }> = ({ request }) => {
  const { data: adjustments = [] } = useFareAdjustments(request.id);
  const latest = adjustments[0];
  if (!latest) return null;

  return (
    <p className="text-xs text-secondary-600 flex flex-wrap items-center gap-1.5">
      <Badge className="bg-amber-100 text-amber-900">Fare adjusted</Badge>
      {latest.oldTotal != null && (
        <span className="line-through text-secondary-400">
          {formatMoney(latest.oldTotal, latest.currency)}
        </span>
      )}
      <span>{formatMoney(latest.newTotal, latest.currency)}</span>
      <span className="text-secondary-500">· {latest.reason}</span>
    </p>
  );
};
