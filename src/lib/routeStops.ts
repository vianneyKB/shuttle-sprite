/**
 * Pure helpers for the route stop editor. Ordering, coordinate hygiene and the
 * starting viewport live here so the rules are testable without a map: Leaflet
 * needs a real DOM, the decisions it drives do not.
 */

import { DEFAULT_MAP_CENTER } from "@/lib/leaflet";

export type StopPoint = { lat: number; lng: number };

/** Web Mercator tiles stop short of the poles; clamp so a dragged marker stays on the map. */
export const clampLat = (lat: number): number => Math.min(85, Math.max(-85, lat));

/** Normalise a longitude onto [-180, 180) so a marker dragged past the date line stays valid. */
export const wrapLng = (lng: number): number => (((lng + 180) % 360) + 360) % 360 - 180;

/** A coordinate typed into a number input: keep `fallback` for blank or nonsense values. */
export const toCoord = (value: string, fallback: number): number => {
  if (value.trim() === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/** Snap a point from the map (or the inputs) into the valid range. */
export const normalizePoint = (lat: number, lng: number): StopPoint => ({
  lat: clampLat(lat),
  lng: wrapLng(lng),
});

/** Five decimals ≈ 1 m — enough for a kerbside stop, short enough to read. */
export const formatCoord = (n: number): string => n.toFixed(5);

/**
 * Move the stop at `index` by `delta` places. Returns the original array when
 * the move would fall off either end, so the caller can keep the same state.
 */
export const moveStop = <T>(stops: T[], index: number, delta: number): T[] => {
  const target = index + delta;
  if (index < 0 || index >= stops.length || target < 0 || target >= stops.length) return stops;
  const next = [...stops];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  return next;
};

/**
 * Where an "Add stop" button (no map click to go on) should drop the next stop:
 * just off the last one so the markers don't stack, else the default centre.
 */
export const nextStopSeed = (stops: StopPoint[]): StopPoint => {
  const last = [...stops].reverse().find((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
  if (!last) return { lat: DEFAULT_MAP_CENTER[0], lng: DEFAULT_MAP_CENTER[1] };
  return normalizePoint(last.lat + 0.005, last.lng + 0.005);
};

/** Corner-to-corner bounds covering every placed stop; null when there is nothing to fit. */
export const stopBounds = (
  stops: StopPoint[]
): [[number, number], [number, number]] | null => {
  const points = stops.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
  if (points.length === 0) return null;
  const lats = points.map((s) => s.lat);
  const lngs = points.map((s) => s.lng);
  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ];
};
