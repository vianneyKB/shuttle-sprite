import React from "react";
import { Check } from "lucide-react";
import { formatStepTime, rideTimeline, type RideTimelineInput } from "@/lib/rideTimeline";
import { cn } from "@/lib/utils";

/**
 * Horizontal progress line for one ride request. A cancelled ride keeps the
 * steps it reached but is muted, with the Cancelled note rendered by the card.
 */
export const RideTimeline: React.FC<{ request: RideTimelineInput }> = ({ request }) => {
  const steps = rideTimeline(request);
  const cancelled = request.status === "cancelled";

  return (
    <ol className="flex items-start gap-1" aria-label="Ride status">
      {steps.map((step, i) => {
        const reached = step.state !== "upcoming";
        return (
          <li key={step.key} className="flex-1 min-w-0">
            <p className="flex items-center gap-1" aria-hidden="true">
              <span
                className={cn(
                  "w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center",
                  reached && !cancelled && "bg-primary-600 border-primary-600 text-white",
                  reached && cancelled && "bg-secondary-300 border-secondary-300 text-white",
                  !reached && "border-secondary-200"
                )}
              >
                {reached && <Check className="w-3 h-3" />}
              </span>
              {i < steps.length - 1 && (
                <span
                  className={cn(
                    "h-0.5 flex-1",
                    steps[i + 1].state !== "upcoming" && !cancelled ? "bg-primary-600" : "bg-secondary-200"
                  )}
                />
              )}
            </p>
            <p
              className={cn(
                "mt-1 text-xs truncate",
                step.state === "current" && !cancelled ? "font-semibold text-secondary-900" : "text-secondary-500"
              )}
            >
              {step.label}
              {step.state === "current" && !cancelled && <span className="sr-only"> (current status)</span>}
            </p>
            {step.at && reached && (
              <p className="text-[11px] text-secondary-400 truncate">{formatStepTime(step.at)}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
};
