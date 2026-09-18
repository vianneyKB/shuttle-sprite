/**
 * The passenger-facing view of where a ride request has got to:
 * requested → confirmed → on the way → completed, with the timestamp the
 * dispatch RPC stamped for each step. Kept pure so it can be tested
 * without a database or a render.
 */
import type { RideRequest, RideRequestStatus } from "@/types";

export type RideTimelineStepKey = "requested" | "confirmed" | "in_progress" | "completed";

export type RideTimelineStep = {
  key: RideTimelineStepKey;
  label: string;
  /** When the step happened; undefined while it is still ahead. */
  at?: Date;
  /** `current` is the step the ride is at now — done, but the latest one. */
  state: "done" | "current" | "upcoming";
};

/** Only the fields the timeline reads, so tests need not build a whole request. */
export type RideTimelineInput = Pick<
  RideRequest,
  "status" | "createdAt" | "assignedAt" | "startedAt" | "completedAt"
>;

const STEPS: { key: RideTimelineStepKey; label: string; status: RideRequestStatus }[] = [
  { key: "requested", label: "Requested", status: "awaiting" },
  { key: "confirmed", label: "Confirmed", status: "confirmed" },
  { key: "in_progress", label: "On the way", status: "in_progress" },
  { key: "completed", label: "Completed", status: "completed" },
];

const timestampOf = (key: RideTimelineStepKey, r: RideTimelineInput) =>
  ({
    requested: r.createdAt,
    confirmed: r.assignedAt,
    in_progress: r.startedAt,
    completed: r.completedAt,
  })[key];

/**
 * A cancelled ride has no place on the status ladder, so how far it got is
 * read back from the timestamps dispatch stamped before the cancellation.
 */
const reachedIndex = (r: RideTimelineInput): number => {
  if (r.status !== "cancelled") {
    const i = STEPS.findIndex((s) => s.status === r.status);
    return i === -1 ? 0 : i;
  }
  if (r.startedAt) return 2;
  if (r.assignedAt) return 1;
  return 0;
};

export const rideTimeline = (r: RideTimelineInput): RideTimelineStep[] => {
  const reached = reachedIndex(r);
  return STEPS.map((step, i) => ({
    key: step.key,
    label: step.label,
    at: timestampOf(step.key, r),
    // A cancelled ride stops rather than sits at a step, so nothing is `current`.
    state: i < reached ? "done" : i === reached ? (r.status === "cancelled" ? "done" : "current") : "upcoming",
  }));
};

/** Short time for a timeline step: "14:32" today, "17 Sep 14:32" otherwise. */
export const formatStepTime = (at: Date, now = new Date()): string =>
  at.toDateString() === now.toDateString()
    ? at.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : at.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
