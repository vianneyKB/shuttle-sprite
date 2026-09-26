import { describe, expect, it } from "vitest";
import {
  clampLat,
  formatCoord,
  moveStop,
  nextStopSeed,
  normalizePoint,
  stopBounds,
  toCoord,
  wrapLng,
} from "../routeStops";

describe("route stop ordering", () => {
  const stops = ["a", "b", "c"];

  it("moves a stop up and down without mutating the input", () => {
    expect(moveStop(stops, 2, -1)).toEqual(["a", "c", "b"]);
    expect(moveStop(stops, 0, 1)).toEqual(["b", "a", "c"]);
    expect(stops).toEqual(["a", "b", "c"]);
  });

  it("returns the same array when the move falls off either end", () => {
    expect(moveStop(stops, 0, -1)).toBe(stops);
    expect(moveStop(stops, 2, 1)).toBe(stops);
    expect(moveStop(stops, 7, -1)).toBe(stops);
  });
});

describe("route stop coordinates", () => {
  it("clamps latitude to the tiled range", () => {
    expect(clampLat(91)).toBe(85);
    expect(clampLat(-91)).toBe(-85);
    expect(clampLat(-26.2041)).toBe(-26.2041);
  });

  it("wraps longitude past the date line onto [-180, 180)", () => {
    expect(wrapLng(181)).toBe(-179);
    expect(wrapLng(-181)).toBe(179);
    expect(wrapLng(180)).toBe(-180);
    expect(wrapLng(28.0473)).toBeCloseTo(28.0473, 10);
  });

  it("normalises a dragged point in one step", () => {
    expect(normalizePoint(95, 200)).toEqual({ lat: 85, lng: -160 });
  });

  it("keeps the previous value when the coordinate input is blank or nonsense", () => {
    expect(toCoord("", -26.2041)).toBe(-26.2041);
    expect(toCoord("   ", -26.2041)).toBe(-26.2041);
    expect(toCoord("abc", -26.2041)).toBe(-26.2041);
    expect(toCoord("-26.5", -26.2041)).toBe(-26.5);
    expect(toCoord("0", -26.2041)).toBe(0);
  });

  it("formats a coordinate to metre precision", () => {
    expect(formatCoord(-26.2041)).toBe("-26.20410");
  });
});

describe("route stop viewport", () => {
  it("seeds the next stop just off the last one", () => {
    const seed = nextStopSeed([
      { lat: -26.3, lng: 28.0 },
      { lat: -26.2, lng: 28.04 },
    ]);
    expect(seed.lat).toBeCloseTo(-26.195, 6);
    expect(seed.lng).toBeCloseTo(28.045, 6);
  });

  it("falls back to the default centre when there is no placed stop", () => {
    const seed = nextStopSeed([]);
    expect(seed.lat).toBeCloseTo(-26.2041, 4);
    expect(seed.lng).toBeCloseTo(28.0473, 4);
  });

  it("bounds every placed stop and ignores broken ones", () => {
    expect(
      stopBounds([
        { lat: -26.2, lng: 28.1 },
        { lat: -25.8, lng: 27.9 },
        { lat: Number.NaN, lng: 28.0 },
      ])
    ).toEqual([
      [-26.2, 27.9],
      [-25.8, 28.1],
    ]);
    expect(stopBounds([])).toBeNull();
  });
});
