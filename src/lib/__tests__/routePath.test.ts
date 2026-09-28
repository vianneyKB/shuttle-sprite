import { describe, expect, it } from "vitest";
import {
  geometryPositions,
  isDrawablePath,
  routePositions,
  stopPositions,
} from "../routePath";

describe("geometryPositions", () => {
  it("swaps GeoJSON lng/lat into Leaflet lat/lng order", () => {
    expect(geometryPositions({ coordinates: [[28.0473, -26.2041], [28.05, -26.21]] })).toEqual([
      [-26.2041, 28.0473],
      [-26.21, 28.05],
    ]);
  });

  it("returns nothing for a missing, null or empty geometry", () => {
    expect(geometryPositions(undefined)).toEqual([]);
    expect(geometryPositions(null)).toEqual([]);
    expect(geometryPositions({ coordinates: [] })).toEqual([]);
  });

  it("drops short and non-numeric positions instead of drawing them at the equator", () => {
    const positions = geometryPositions({
      coordinates: [[28.0473, -26.2041], [28.05], [NaN, -26.3], [28.06, -26.22]],
    });
    expect(positions).toEqual([
      [-26.2041, 28.0473],
      [-26.22, 28.06],
    ]);
  });
});

describe("stopPositions", () => {
  it("keeps the given order — that order is the route", () => {
    expect(
      stopPositions([
        { lat: -26.2, lng: 28.0 },
        { lat: -26.1, lng: 28.1 },
      ])
    ).toEqual([
      [-26.2, 28.0],
      [-26.1, 28.1],
    ]);
  });

  it("skips stops without a usable coordinate", () => {
    expect(
      stopPositions([
        { lat: -26.2, lng: 28.0 },
        { lat: Number.NaN, lng: 28.1 },
        { lat: -26.1, lng: Number.POSITIVE_INFINITY },
      ])
    ).toEqual([[-26.2, 28.0]]);
  });
});

describe("routePositions", () => {
  const stops = [
    { lat: -26.2, lng: 28.0 },
    { lat: -26.1, lng: 28.1 },
  ];

  it("prefers a saved geometry over the stops", () => {
    expect(
      routePositions({
        geometry: { coordinates: [[28.5, -26.5], [28.6, -26.6]] },
        stops,
      })
    ).toEqual([
      [-26.5, 28.5],
      [-26.6, 28.6],
    ]);
  });

  it("falls back to the stops when there is no geometry — the editor's case", () => {
    expect(routePositions({ stops })).toEqual([
      [-26.2, 28.0],
      [-26.1, 28.1],
    ]);
  });

  it("falls back to the stops when the geometry holds fewer than two points", () => {
    expect(routePositions({ geometry: { coordinates: [[28.5, -26.5]] }, stops })).toEqual([
      [-26.2, 28.0],
      [-26.1, 28.1],
    ]);
  });

  it("has nothing to draw for a single stop and no geometry", () => {
    expect(routePositions({ stops: [{ lat: -26.2, lng: 28.0 }] })).toEqual([[-26.2, 28.0]]);
  });
});

describe("isDrawablePath", () => {
  it("needs two points", () => {
    expect(isDrawablePath([])).toBe(false);
    expect(isDrawablePath([[-26.2, 28.0]])).toBe(false);
    expect(isDrawablePath([[-26.2, 28.0], [-26.1, 28.1]])).toBe(true);
  });
});
