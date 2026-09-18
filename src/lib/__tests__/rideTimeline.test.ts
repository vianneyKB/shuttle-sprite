import { describe, expect, it } from "vitest";
import { formatStepTime, rideTimeline, type RideTimelineInput } from "../rideTimeline";

const base: RideTimelineInput = {
  status: "awaiting",
  createdAt: new Date("2026-09-17T08:00:00Z"),
};

const states = (r: RideTimelineInput) => rideTimeline(r).map((s) => s.state);

describe("rideTimeline", () => {
  it("puts a new request at the first step", () => {
    expect(states(base)).toEqual(["current", "upcoming", "upcoming", "upcoming"]);
    expect(rideTimeline(base)[0].at).toEqual(base.createdAt);
    expect(rideTimeline(base)[1].at).toBeUndefined();
  });

  it("advances with the status and carries each step's timestamp", () => {
    const confirmed: RideTimelineInput = {
      ...base,
      status: "confirmed",
      assignedAt: new Date("2026-09-17T08:05:00Z"),
    };
    expect(states(confirmed)).toEqual(["done", "current", "upcoming", "upcoming"]);
    expect(rideTimeline(confirmed)[1].at?.toISOString()).toBe("2026-09-17T08:05:00.000Z");

    const started: RideTimelineInput = { ...confirmed, status: "in_progress", startedAt: new Date("2026-09-17T08:10:00Z") };
    expect(states(started)).toEqual(["done", "done", "current", "upcoming"]);

    const done: RideTimelineInput = { ...started, status: "completed", completedAt: new Date("2026-09-17T08:40:00Z") };
    expect(states(done)).toEqual(["done", "done", "done", "current"]);
    expect(rideTimeline(done)[3].at?.toISOString()).toBe("2026-09-17T08:40:00.000Z");
  });

  it("reads how far a cancelled ride got from its timestamps, with no current step", () => {
    const cancelledEarly: RideTimelineInput = { ...base, status: "cancelled" };
    expect(states(cancelledEarly)).toEqual(["done", "upcoming", "upcoming", "upcoming"]);

    const cancelledAfterConfirm: RideTimelineInput = {
      ...base,
      status: "cancelled",
      assignedAt: new Date("2026-09-17T08:05:00Z"),
    };
    expect(states(cancelledAfterConfirm)).toEqual(["done", "done", "upcoming", "upcoming"]);

    const cancelledUnderWay: RideTimelineInput = {
      ...cancelledAfterConfirm,
      startedAt: new Date("2026-09-17T08:10:00Z"),
    };
    expect(states(cancelledUnderWay)).toEqual(["done", "done", "done", "upcoming"]);
  });

  it("always returns the four steps in order", () => {
    expect(rideTimeline(base).map((s) => s.key)).toEqual(["requested", "confirmed", "in_progress", "completed"]);
    expect(rideTimeline(base).map((s) => s.label)).toEqual(["Requested", "Confirmed", "On the way", "Completed"]);
  });
});

describe("formatStepTime", () => {
  // Compared against the step's own date so the assertion holds in any timezone.
  const at = new Date("2026-09-17T08:05:00Z");

  it("shows time only on the same day, and adds the date otherwise", () => {
    const sameDay = formatStepTime(at, at);
    const laterDay = formatStepTime(at, new Date(at.getTime() + 5 * 24 * 60 * 60 * 1000));
    expect(laterDay).not.toBe(sameDay);
    expect(laterDay.length).toBeGreaterThan(sameDay.length);
  });
});
