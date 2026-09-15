import { describe, expect, it } from "vitest";
import { mapBooking, type DbBooking, type DbStop } from "../useBookings";
import { mapRoute, type DbRoute, type DbRouteStop } from "../useRoutes";
import { mapRideRequest, type DbRideRequest } from "../useRideRequests";
import { mapVehicle, type DbVehicle } from "../useVehicles";

// Postgres numeric columns arrive from PostgREST as strings; the mappers must coerce them.
const num = (s: string) => s as unknown as number;

describe("mapBooking", () => {
  const row: DbBooking = {
    id: "b1",
    vehicle_id: "v1",
    customer_id: "c1",
    customer_name: "Ada",
    customer_email: "ada@example.com",
    customer_phone: "+27 11 000 0000",
    passengers: 3,
    start_date: "2026-10-01",
    end_date: null,
    days_of_week: ["Monday", "Wednesday"],
    time: "08:00",
    duration: num("2.5"),
    total_price: num("250.00"),
    price_breakdown: {
      hourlyRate: 50,
      duration: 2.5,
      subtotal: 125,
      additionalStops: 0,
      additionalStopsCost: 0,
      recurringMultiplier: 2,
      finalTotal: 250,
    },
    status: "pending",
    special_requests: null,
    is_recurring: true,
    payment_method: "prepay",
    payment_status: "pending",
    created_at: "2026-09-15T08:00:00Z",
    updated_at: "2026-09-15T08:00:00Z",
  };
  const stops: DbStop[] = [
    { id: "s2", booking_id: "b1", address: "Sandton", type: "dropoff", stop_order: 1, notes: null },
    { id: "s1", booking_id: "b1", address: "Rosebank", type: "pickup", stop_order: 0, notes: "Gate B" },
    { id: "sx", booking_id: "other", address: "Elsewhere", type: "stop", stop_order: 0, notes: null },
  ];

  it("coerces numerics, orders stops, and ignores stops from other bookings", () => {
    const b = mapBooking(row, stops);
    expect(b.duration).toBe(2.5);
    expect(b.totalPrice).toBe(250);
    expect(b.stops.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(b.stops[0].notes).toBe("Gate B");
    expect(b.paymentMethod).toBe("prepay");
    expect(b.paymentStatus).toBe("pending");
    expect(b.createdAt).toBeInstanceOf(Date);
  });

  it("maps the pricing snapshot (currency, subtotal, tax)", () => {
    const b = mapBooking(
      {
        ...row,
        currency: "ZAR",
        subtotal: num("217.39"),
        tax_rate: num("15.00"),
        tax_amount: num("32.61"),
        total_price: num("250.00"),
        price_breakdown: { ...row.price_breakdown, currency: "ZAR", taxRate: 15, taxLabel: "VAT", taxAmount: 32.61, subtotal: 217.39 },
      },
      []
    );
    expect(b.currency).toBe("ZAR");
    expect(b.subtotal).toBe(217.39);
    expect(b.taxRate).toBe(15);
    expect(b.taxAmount).toBe(32.61);
    expect(b.totalPrice).toBe(250);
    expect(b.basePriceBreakdown.taxLabel).toBe("VAT");
    expect(b.basePriceBreakdown.currency).toBe("ZAR");
  });

  it("defaults payment and pricing fields for legacy rows without them", () => {
    const { payment_method: _pm, payment_status: _ps, ...legacy } = row;
    const b = mapBooking(legacy as DbBooking, []);
    expect(b.paymentMethod).toBe("cash");
    expect(b.paymentStatus).toBe("not_required");
    // No snapshot columns → whole total is the subtotal, no tax, platform default currency.
    expect(b.currency).toBe("ZAR");
    expect(b.subtotal).toBe(250);
    expect(b.taxRate).toBe(0);
    expect(b.taxAmount).toBe(0);
    expect(b.basePriceBreakdown.currency).toBe("ZAR");
    expect(b.basePriceBreakdown.additionalStopFee).toBe(0);
  });
});

describe("mapRoute", () => {
  const route: DbRoute = {
    id: "r1",
    operator_id: "o1",
    name: "Airport shuttle",
    description: null,
    operating_hours: "06:00–22:00",
    geometry: { type: "LineString", coordinates: [[28.24, -26.13], [28.05, -26.2]] },
    is_active: true,
    created_at: "2026-09-15T08:00:00Z",
    updated_at: "2026-09-15T08:00:00Z",
  };
  const stops: DbRouteStop[] = [
    { id: "b", route_id: "r1", name: "CBD", description: null, stop_order: 1, lat: num("-26.2041"), lng: num("28.0473") },
    { id: "a", route_id: "r1", name: "OR Tambo", description: "Terminal A", stop_order: 0, lat: -26.1367, lng: 28.2411 },
  ];

  it("sorts stops by order and coerces coordinates to numbers", () => {
    const r = mapRoute(route, stops);
    expect(r.stops.map((s) => s.name)).toEqual(["OR Tambo", "CBD"]);
    expect(r.stops[1].lat).toBe(-26.2041);
    expect(typeof r.stops[1].lng).toBe("number");
    expect(r.operatingHours).toBe("06:00–22:00");
    expect(r.description).toBeUndefined();
  });

  it("falls back to an empty LineString when geometry is missing", () => {
    const r = mapRoute({ ...route, geometry: null as unknown as GeoJSON.LineString }, []);
    expect(r.geometry).toEqual({ type: "LineString", coordinates: [] });
  });
});

describe("mapRideRequest", () => {
  it("maps nullable columns to undefined and coerces coordinates", () => {
    const row: DbRideRequest = {
      id: "q1",
      customer_id: "c1",
      route_id: null,
      origin_name: "Mall A",
      origin_lat: num("-26.1"),
      origin_lng: num("28.1"),
      destination_name: "Mall B",
      destination_lat: -26.2,
      destination_lng: 28.2,
      passengers: 2,
      payment_method: "cash",
      payment_status: "not_required",
      status: "awaiting",
      scheduled_at: null,
      notes: null,
      created_at: "2026-09-15T08:00:00Z",
      updated_at: "2026-09-15T08:00:00Z",
    };
    const r = mapRideRequest(row);
    expect(r.routeId).toBeUndefined();
    expect(r.scheduledAt).toBeUndefined();
    expect(r.notes).toBeUndefined();
    expect(r.originLat).toBe(-26.1);
    expect(r.status).toBe("awaiting");
  });
});

describe("mapVehicle", () => {
  it("coerces prices and rating, and defaults image/features", () => {
    const row: DbVehicle = {
      id: "v1",
      operator_id: "o1",
      make: "Toyota",
      model: "Quantum",
      year: 2022,
      capacity: 14,
      price_per_hour: num("45.50"),
      price_per_day: num("320"),
      location: "Johannesburg",
      features: null as unknown as string[],
      image: null,
      available: true,
      rating: num("4.5"),
      reviews: 12,
      created_at: "2026-09-15T08:00:00Z",
      updated_at: "2026-09-15T08:00:00Z",
    };
    const v = mapVehicle(row);
    expect(v.currency).toBe("ZAR");
    expect(mapVehicle(row, "USD").currency).toBe("USD");
    expect(v.pricePerHour).toBe(45.5);
    expect(v.pricePerDay).toBe(320);
    expect(v.rating).toBe(4.5);
    expect(v.features).toEqual([]);
    expect(v.image).toBe("");
    expect(v.operatorName).toBe("Operator");
  });
});
