import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { isValidLatLng, reverseGeocode, roundCoord } from "@/lib/geocode";

/** Long enough that dragging a marker or typing a coordinate makes one request. */
export const REVERSE_GEOCODE_DEBOUNCE_MS = 800;

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * Suggested name for a point, from Nominatim. Debounced, cached per rounded
 * coordinate (so re-opening the editor costs nothing) and never retried — a
 * name is a convenience, and `lib/geocode` keeps the whole app inside
 * Nominatim's 1 req/s policy.
 */
export const useReverseGeocode = (
  coords: { lat: number; lng: number } | null,
  enabled = true
) => {
  const key =
    coords && isValidLatLng(coords.lat, coords.lng)
      ? `${roundCoord(coords.lat)},${roundCoord(coords.lng)}`
      : "";
  // Debounce the key, not the object: a new object every render would keep
  // resetting the timer.
  const debouncedKey = useDebounced(key, REVERSE_GEOCODE_DEBOUNCE_MS);

  const query = useQuery({
    queryKey: ["reverse-geocode", debouncedKey],
    queryFn: ({ signal }) => {
      const [lat, lng] = debouncedKey.split(",").map(Number);
      return reverseGeocode(lat, lng, { signal });
    },
    enabled: enabled && debouncedKey !== "",
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    retry: false,
  });

  return {
    /** "" when Nominatim has no name for the spot, or nothing has been fetched. */
    name: query.data ?? "",
    isFetching: query.isFetching,
    isFetched: query.isFetched,
    isError: query.isError,
    /** Pending because the coordinates just changed and the debounce is running. */
    isDebouncing: key !== debouncedKey,
  };
};
