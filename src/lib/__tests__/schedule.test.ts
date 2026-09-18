import { describe, expect, it } from "vitest";
import { earliestScheduleTime, fromLocalInputValue, toLocalInputValue } from "../schedule";

describe("schedule helpers", () => {
  it("rounds the earliest time up to the next 5 minutes after the lead time", () => {
    const now = new Date(2026, 8, 18, 14, 3, 40); // 14:03:40 local
    const t = earliestScheduleTime(now, 15);
    expect(toLocalInputValue(t)).toBe("2026-09-18T14:20"); // 14:18:40 -> 14:20
    expect(t.getSeconds()).toBe(0);
  });

  it("keeps an exact 5-minute boundary as is", () => {
    const now = new Date(2026, 8, 18, 14, 0, 0);
    expect(toLocalInputValue(earliestScheduleTime(now, 15))).toBe("2026-09-18T14:15");
  });

  it("round-trips a datetime-local value in the local zone", () => {
    const d = fromLocalInputValue("2026-09-18T15:30");
    expect(d).not.toBeNull();
    expect(toLocalInputValue(d!)).toBe("2026-09-18T15:30");
  });

  it("rejects empty or malformed input", () => {
    expect(fromLocalInputValue("")).toBeNull();
    expect(fromLocalInputValue("tomorrow")).toBeNull();
    expect(fromLocalInputValue("2026-13-45T99:99")).toBeNull();
  });
});
