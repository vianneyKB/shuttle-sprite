/**
 * Pure helpers for turning a route into the points a polyline draws through.
 *
 * Two callers want the same shape from different data: the public map has a
 * saved `geometry` (GeoJSON, so lng/lat), the editor has only the stops the
 * operator has placed so far. Deciding that here keeps `RoutePolyline` a thin
 * Leaflet wrapper, and keeps the decision testable without a DOM.
 */

import type { StopPoint } from "@/lib/routeStops";

/** Leaflet's order — lat first — which is the opposite of GeoJSON's. */
export type LatLngTuple = [number, number];

const isFinitePair = (lat: number, lng: number): boolean =>
  Number.isFinite(lat) && Number.isFinite(lng);

/**
 * A GeoJSON LineString's coordinates as Leaflet tuples. Positions are
 * `[lng, lat]`, so they are swapped; anything short or non-numeric is dropped
 * rather than drawn at the equator.
 */
export const geometryPositions = (
  geometry?: { coordinates?: number[][] } | null
): LatLngTuple[] =>
  (geometry?.coordinates ?? []).reduce<LatLngTuple[]>((acc, c) => {
    if (Array.isArray(c) && c.length >= 2 && isFinitePair(c[1], c[0])) acc.push([c[1], c[0]]);
    return acc;
  }, []);

/** Placed stops as Leaflet tuples, in the order given — that order is the route. */
export const stopPositions = (stops: readonly StopPoint[]): LatLngTuple[] =>
  stops.reduce<LatLngTuple[]>((acc, s) => {
    if (isFinitePair(s.lat, s.lng)) acc.push([s.lat, s.lng]);
    return acc;
  }, []);

/**
 * What to draw for a route: the surveyed geometry when there is a line in it,
 * otherwise straight hops between the stops. A one-point geometry is not a
 * line, so the stops win — that is the case the editor is in before saving.
 */
export const routePositions = (route: {
  geometry?: { coordinates?: number[][] } | null;
  stops: readonly StopPoint[];
}): LatLngTuple[] => {
  const fromGeometry = geometryPositions(route.geometry);
  return fromGeometry.length >= 2 ? fromGeometry : stopPositions(route.stops);
};

/** A polyline needs two points; below that there is nothing to draw. */
export const isDrawablePath = (positions: readonly LatLngTuple[]): boolean =>
  positions.length >= 2;
