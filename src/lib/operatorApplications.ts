/**
 * Operator-application rules kept out of the components, so the admin screen
 * refuses the same things the database refuses and the lists are ordered the
 * same way wherever they are shown.
 */
import type { OperatorApplication, OperatorApplicationStatus } from "@/types";

/** Matches the `decision_note` check constraint on operator_applications. */
export const NOTE_MIN_LENGTH = 3;
export const NOTE_MAX_LENGTH = 500;

/**
 * Why a rejection cannot be submitted yet, or undefined when it can.
 * review_operator_application() refuses a rejection without a reason; saying
 * so in the form is cheaper than a round trip.
 */
export const rejectionNoteError = (note: string): string | undefined => {
  const trimmed = note.trim();
  if (trimmed.length === 0) return "Give a reason for the rejection";
  if (trimmed.length < NOTE_MIN_LENGTH) return `At least ${NOTE_MIN_LENGTH} characters`;
  if (trimmed.length > NOTE_MAX_LENGTH) return `At most ${NOTE_MAX_LENGTH} characters`;
  return undefined;
};

export const APPLICATION_STATUS_LABEL: Record<OperatorApplicationStatus, string> = {
  pending: "Waiting",
  approved: "Approved",
  rejected: "Rejected",
};

export const APPLICATION_STATUS_COLOR: Record<OperatorApplicationStatus, string> = {
  pending: "bg-orange-100 text-orange-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

const decidedTime = (a: OperatorApplication) => a.decidedAt?.getTime() ?? 0;

/**
 * Applications split by status: those waiting oldest-first, so the longest
 * wait is at the top of the admin's list; those decided newest-first, because
 * what matters there is what happened recently.
 */
export const groupApplications = (apps: OperatorApplication[]) => ({
  pending: apps
    .filter((a) => a.status === "pending")
    .sort((a, b) => a.requestedAt.getTime() - b.requestedAt.getTime()),
  approved: apps
    .filter((a) => a.status === "approved")
    .sort((a, b) => decidedTime(b) - decidedTime(a)),
  rejected: apps
    .filter((a) => a.status === "rejected")
    .sort((a, b) => decidedTime(b) - decidedTime(a)),
});

/**
 * A readable name for an account. An admin can read every profile, but a
 * display name is nullable and a row can be missing, so the id is the
 * fallback rather than an empty cell.
 */
export const accountLabel = (
  userId: string,
  names: Map<string, { displayName: string }>
): string => {
  const name = names.get(userId)?.displayName.trim();
  return name ? name : `Account ${userId.slice(0, 8)}`;
};

/** Whole days an application has been waiting, for the "waiting N days" line. */
export const daysWaiting = (requestedAt: Date, now: Date = new Date()): number =>
  Math.max(0, Math.floor((now.getTime() - requestedAt.getTime()) / 86_400_000));
