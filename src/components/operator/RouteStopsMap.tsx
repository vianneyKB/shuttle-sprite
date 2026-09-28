import React, { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "@/lib/leaflet";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from "@/lib/leaflet";
import { normalizePoint, stopBounds } from "@/lib/routeStops";
import { RoutePolyline } from "@/components/map/RoutePolyline";

export type EditableStop = {
  key: string;
  name: string;
  lat: number;
  lng: number;
};

type RouteStopsMapProps = {
  stops: EditableStop[];
  selectedKey?: string | null;
  /** A click on the map appends a stop at that point. */
  onAdd: (lat: number, lng: number) => void;
  /** A marker was dropped somewhere new. */
  onMove: (key: string, lat: number, lng: number) => void;
  onSelect?: (key: string) => void;
};

/** Numbered pin: the marker carries the stop's position in the route, not just a point. */
const stopIcon = (order: number, selected: boolean) =>
  L.divIcon({
    className: "",
    html: `<span class="flex items-center justify-center w-7 h-7 rounded-full border-2 border-white shadow-md text-xs font-bold text-white ${
      selected ? "bg-primary-800 ring-2 ring-primary-300" : "bg-primary-600"
    }">${order}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

const AddStopOnClick = ({ onAdd }: { onAdd: (lat: number, lng: number) => void }) => {
  useMapEvents({
    click: (e) => {
      const { lat, lng } = normalizePoint(e.latlng.lat, e.latlng.lng);
      onAdd(lat, lng);
    },
  });
  return null;
};

/**
 * The map mounts inside a dialog that is still animating, so Leaflet measures a
 * container that has not settled yet; fit the stops once the size is real.
 */
const FitOnOpen = ({ stops }: { stops: EditableStop[] }) => {
  const map = useMap();
  // Deliberately fits once per mount: refitting on every drag would yank the
  // map out from under the operator mid-edit.
  const initial = useMemo(() => stopBounds(stops), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      map.invalidateSize();
      if (!initial) return;
      const [sw, ne] = initial;
      if (sw[0] === ne[0] && sw[1] === ne[1]) map.setView(sw, DEFAULT_MAP_ZOOM);
      else map.fitBounds(initial, { padding: [36, 36], maxZoom: 16 });
    });
    return () => cancelAnimationFrame(frame);
  }, [map, initial]);

  return null;
};

export const RouteStopsMap: React.FC<RouteStopsMapProps> = ({
  stops,
  selectedKey,
  onAdd,
  onMove,
  onSelect,
}) => (
  <section
    className="relative isolate z-0 h-[min(300px,40dvh)] sm:h-[340px] rounded-xl border border-secondary-200 overflow-hidden"
    aria-label="Route stops map"
  >
    <MapContainer
      center={DEFAULT_MAP_CENTER}
      zoom={DEFAULT_MAP_ZOOM}
      className="h-full w-full cursor-crosshair"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitOnOpen stops={stops} />
      <AddStopOnClick onAdd={onAdd} />
      {/* Draft shape: redraws as stops are added, dragged or reordered. */}
      <RoutePolyline stops={stops} variant="draft" />
      {stops.map((stop, idx) => (
        <Marker
          key={stop.key}
          position={[stop.lat, stop.lng]}
          draggable
          icon={stopIcon(idx + 1, selectedKey === stop.key)}
          title={stop.name || `Stop ${idx + 1}`}
          eventHandlers={{
            dragend: (e) => {
              const { lat, lng } = normalizePoint(
                (e.target as L.Marker).getLatLng().lat,
                (e.target as L.Marker).getLatLng().lng
              );
              onMove(stop.key, lat, lng);
            },
            click: () => onSelect?.(stop.key),
          }}
        />
      ))}
    </MapContainer>
  </section>
);
