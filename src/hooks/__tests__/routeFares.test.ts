import { describe, expect, it } from "vitest";
import { fareInForce, mapQuote, mapRouteFare, resolveFare, type DbRouteFare } from "../useRouteFares";
import type { RouteFare } from "@/types";

const fare = (o: Partial<RouteFare> & { farePerSeat: number; effectiveFrom: string }): RouteFare => ({
  id: o.id ?? `${o.farePerSeat}-${o.effectiveFrom}`,
  routeId: "r1",
  createdAt: o.createdAt ?? new Date("2026-09-01T00:00:00Z"),
  ...o,
});

describe("fareInForce", () => {
  it("is inclusive at both ends and open-ended when effectiveTo is missing", () => {
    const f = fare({ farePerSeat: 15, effectiveFrom: "2026-09-10", effectiveTo: "2026-09-20" });
    expect(fareInForce(f, "2026-09-09")).toBe(false);
    expect(fareInForce(f, "2026-09-10")).toBe(true);
    expect(fareInForce(f, "2026-09-20")).toBe(true);
    expect(fareInForce(f, "2026-09-21")).toBe(false);
    expect(fareInForce(fare({ farePerSeat: 1, effectiveFrom: "2026-01-01" }), "2030-01-01")).toBe(true);
  });
});

describe("resolveFare", () => {
  const fares = [
    fare({ id: "route-old", farePerSeat: 15, effectiveFrom: "2026-01-01" }),
    fare({ id: "route-new", farePerSeat: 18, effectiveFrom: "2026-10-01" }),
    fare({ id: "seg", farePerSeat: 10, effectiveFrom: "2026-01-01", fromStopId: "a", toStopId: "b" }),
  ];

  it("prefers a segment fare over the route fare", () => {
    expect(resolveFare(fares, "a", "b", "2026-09-18")?.id).toBe("seg");
  });

  it("falls back to the route fare for other segments", () => {
    expect(resolveFare(fares, "b", "c", "2026-09-18")?.id).toBe("route-old");
  });

  it("uses the scheduled increase once its date arrives, not before", () => {
    expect(resolveFare(fares, undefined, undefined, "2026-09-30")?.farePerSeat).toBe(15);
    expect(resolveFare(fares, undefined, undefined, "2026-10-01")?.farePerSeat).toBe(18);
  });

  it("returns undefined when nothing is in force", () => {
    expect(resolveFare([fare({ farePerSeat: 9, effectiveFrom: "2027-01-01" })], undefined, undefined, "2026-09-18")).toBeUndefined();
  });
});

describe("mapRouteFare / mapQuote", () => {
  it("coerces numerics and maps nulls to undefined", () => {
    const row: DbRouteFare = {
      id: "f1", route_id: "r1", from_stop_id: null, to_stop_id: null,
      fare_per_seat: "18.50" as unknown as number, effective_from: "2026-10-01", effective_to: null,
      created_at: "2026-09-18T10:00:00Z",
    };
    const f = mapRouteFare(row);
    expect(f.farePerSeat).toBe(18.5);
    expect(f.fromStopId).toBeUndefined();
    expect(f.effectiveTo).toBeUndefined();
  });

  it("maps a 'none' quote with no total and a priced quote with tax", () => {
    const none = mapQuote({ source: "none", passengers: 2, currency: "ZAR", taxRate: 15, taxLabel: "VAT", total: null });
    expect(none.total).toBeUndefined();
    expect(none.farePerSeat).toBeUndefined();
    const q = mapQuote({ source: "route", farePerSeat: "18", passengers: 2, currency: "ZAR", subtotal: "36", taxRate: "15", taxLabel: "VAT", taxAmount: "5.4", total: "41.4" });
    expect(q.total).toBe(41.4);
    expect(q.farePerSeat).toBe(18);
    expect(q.source).toBe("route");
  });
});
