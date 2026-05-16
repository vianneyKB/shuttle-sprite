import React, { useMemo, useState } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from "react-leaflet";
import "@/lib/leaflet";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from "@/lib/leaflet";
import type { RouteStop, ShuttleRoute } from "@/types";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

function FitBounds({ routes }: { routes: ShuttleRoute[] }) {
  const map = useMap();
  React.useEffect(() => {
    const points: [number, number][] = [];
    routes.forEach((r) => {
      r.stops.forEach((s) => points.push([s.lat, s.lng]));
      r.geometry?.coordinates?.forEach((c) => {
        if (c.length >= 2) points.push([c[1], c[0]]);
      });
    });
    if (points.length > 0) {
      map.fitBounds(points, { padding: [40, 40] });
    }
  }, [routes, map]);
  return null;
}

type RouteMapProps = {
  routes: ShuttleRoute[];
  isLoading?: boolean;
  onStopSelect?: (route: ShuttleRoute, stop: RouteStop) => void;
  selectedRouteId?: string | null;
};

export const RouteMap: React.FC<RouteMapProps> = ({
  routes,
  isLoading,
  onStopSelect,
  selectedRouteId,
}) => {
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return routes;
    return routes.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.stops.some((s) => s.name.toLowerCase().includes(q))
    );
  }, [routes, filter]);

  if (isLoading) {
    return (
      <motion className="h-[min(420px,55dvh)] sm:h-[480px] rounded-xl border border-secondary-200 bg-secondary-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <motion className="space-y-3">
      <Input
        placeholder="Filter routes or stops…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="max-w-md"
      />
      <motion className="h-[min(420px,55dvh)] sm:h-[480px] rounded-xl border border-secondary-200 overflow-hidden z-0">
        <MapContainer
          center={DEFAULT_MAP_CENTER}
          zoom={DEFAULT_MAP_ZOOM}
          className="h-full w-full"
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {filtered.length > 0 && <FitBounds routes={filtered} />}
          {filtered.map((route) => {
            const positions =
              route.geometry?.coordinates?.map((c) => [c[1], c[0]] as [number, number]) ??
              route.stops.map((s) => [s.lat, s.lng] as [number, number]);
            const active = !selectedRouteId || selectedRouteId === route.id;
            return (
              <React.Fragment key={route.id}>
                {positions.length >= 2 && (
                  <Polyline
                    positions={positions}
                    pathOptions={{
                      color: active ? "#3b6fd4" : "#94a3b8",
                      weight: active ? 5 : 3,
                      opacity: active ? 0.9 : 0.5,
                    }}
                  />
                )}
                {route.stops.map((stop) => (
                  <Marker key={stop.id} position={[stop.lat, stop.lng]}>
                    <Popup>
                      <motion className="text-sm space-y-1 min-w-[140px]">
                        <p className="font-semibold">{stop.name}</p>
                        <p className="text-secondary-600">{route.name}</p>
                        {route.operatingHours && (
                          <p className="text-xs text-secondary-500">{route.operatingHours}</p>
                        )}
                        {onStopSelect && (
                          <button
                            type="button"
                            className="text-primary-600 text-xs font-medium underline"
                            onClick={() => onStopSelect(route, stop)}
                          >
                            Request ride from here
                          </button>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </React.Fragment>
            );
          })}
        </MapContainer>
      </div>
      {filtered.length === 0 && (
        <p className="text-sm text-secondary-600 text-center py-2">No routes match your search.</p>
      )}
    </div>
  );
};
