import React from "react";
import { Polyline } from "react-leaflet";
import type { PolylineOptions } from "leaflet";
import { isDrawablePath, routePositions, type LatLngTuple } from "@/lib/routePath";
import type { StopPoint } from "@/lib/routeStops";

/** Dimmed when another route is selected; dashed while the shape is still a draft. */
export type RoutePolylineVariant = "active" | "muted" | "draft";

const STYLES: Record<RoutePolylineVariant, PolylineOptions> = {
  active: { color: "#3b6fd4", weight: 5, opacity: 0.9 },
  muted: { color: "#94a3b8", weight: 3, opacity: 0.5 },
  // Dashed so an unsaved editor path never reads as a surveyed road.
  draft: { color: "#3b6fd4", weight: 4, opacity: 0.85, dashArray: "8 6" },
};

type RoutePolylineProps = {
  /** Saved GeoJSON LineString, when there is one. */
  geometry?: { coordinates?: number[][] } | null;
  /** Stops in pickup order — the fallback path, and all the editor has. */
  stops: readonly StopPoint[];
  variant?: RoutePolylineVariant;
};

/**
 * The line through a route, for the public map and the editor alike. Takes the
 * geometry when it has one and the stops when it does not, and renders nothing
 * at all below two points.
 */
export const RoutePolyline: React.FC<RoutePolylineProps> = ({
  geometry,
  stops,
  variant = "active",
}) => {
  const positions: LatLngTuple[] = routePositions({ geometry, stops });
  if (!isDrawablePath(positions)) return null;
  return <Polyline positions={positions} pathOptions={STYLES[variant]} />;
};
