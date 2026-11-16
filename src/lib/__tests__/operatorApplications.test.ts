import { describe, expect, it } from "vitest";
import {
  APPLICATION_STATUS_LABEL,
  NOTE_MAX_LENGTH,
  accountLabel,
  daysWaiting,
  groupApplications,
  rejectionNoteError,
} from "../operatorApplications";
import type { OperatorApplication, OperatorApplicationStatus } from "@/types";

const app = (
  id: string,
  status: OperatorApplicationStatus,
  requested: string,
  decided?: string
): OperatorApplication => ({
  id,
  userId: `user-${id}`,
  status,
  requestedAt: new Date(requested),
  decidedAt: decided ? new Date(decided) : undefined,
});

describe("rejectionNoteError", () => {
  it("insists on a reason, matching the RPC's own refusal", () => {
    expect(rejectionNoteError("")).toBe("Give a reason for the rejection");
    expect(rejectionNoteError("   ")).toBe("Give a reason for the rejection");
  });

  it("measures the trimmed reason against the column's bounds", () => {
    expect(rejectionNoteError("  ab  ")).toBe("At least 3 characters");
    expect(rejectionNoteError("  abc  ")).toBeUndefined();
    expect(rejectionNoteError("x".repeat(NOTE_MAX_LENGTH))).toBeUndefined();
    expect(rejectionNoteError("x".repeat(NOTE_MAX_LENGTH + 1))).toBe("At most 500 characters");
  });
});

describe("groupApplications", () => {
  const apps = [
    app("new", "pending", "2026-10-05T08:00:00Z"),
    app("old", "pending", "2026-10-01T08:00:00Z"),
    app("ok-early", "approved", "2026-09-01T08:00:00Z", "2026-09-02T08:00:00Z"),
    app("ok-late", "approved", "2026-09-10T08:00:00Z", "2026-09-20T08:00:00Z"),
    app("no", "rejected", "2026-09-05T08:00:00Z", "2026-09-06T08:00:00Z"),
  ];

  it("puts the longest wait first and the newest decision first", () => {
    const groups = groupApplications(apps);
    expect(groups.pending.map((a) => a.id)).toEqual(["old", "new"]);
    expect(groups.approved.map((a) => a.id)).toEqual(["ok-late", "ok-early"]);
    expect(groups.rejected.map((a) => a.id)).toEqual(["no"]);
  });

  it("does not drop or duplicate an application", () => {
    const groups = groupApplications(apps);
    expect(groups.pending.length + groups.approved.length + groups.rejected.length).toBe(
      apps.length
    );
  });

  it("handles an empty list", () => {
    expect(groupApplications([])).toEqual({ pending: [], approved: [], rejected: [] });
  });
});

describe("accountLabel", () => {
  it("prefers the display name", () => {
    const names = new Map([["abcdef12-0000", { displayName: "Ada Lovelace" }]]);
    expect(accountLabel("abcdef12-0000", names)).toBe("Ada Lovelace");
  });

  it("falls back to a short id when the profile is missing or blank", () => {
    expect(accountLabel("abcdef12-3456-7890", new Map())).toBe("Account abcdef12");
    const blank = new Map([["abcdef12-3456-7890", { displayName: "   " }]]);
    expect(accountLabel("abcdef12-3456-7890", blank)).toBe("Account abcdef12");
  });
});

describe("daysWaiting", () => {
  const now = new Date("2026-10-10T12:00:00Z");

  it("counts whole days and never goes negative", () => {
    expect(daysWaiting(new Date("2026-10-10T11:00:00Z"), now)).toBe(0);
    expect(daysWaiting(new Date("2026-10-07T12:00:00Z"), now)).toBe(3);
    expect(daysWaiting(new Date("2026-10-11T12:00:00Z"), now)).toBe(0);
  });
});

describe("APPLICATION_STATUS_LABEL", () => {
  it("labels every status the enum can hold", () => {
    expect(Object.keys(APPLICATION_STATUS_LABEL).sort()).toEqual([
      "approved",
      "pending",
      "rejected",
    ]);
  });
});
