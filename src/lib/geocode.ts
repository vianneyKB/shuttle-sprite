/**
 * Reverse geocoding (coordinates → place name) for route stops, via Nominatim.
 *
 * Nominatim's usage policy (https://operations.osmfoundation.org/policies/nominatim/)
 * allows at most **1 request per second** and asks every client to identify
 * itself. A browser cannot set `User-Agent` or `Referer` from fetch() — both
 * are forbidden header names the browser controls — but it sends `Referer`
 * itself, which identifies the deployment. Set `VITE_NOMINATIM_EMAIL` to add
 * the contact address the policy asks for, or `VITE_NOMINATIM_URL` to point at
 * your own instance once this is more than the occasional stop edit.
 *
 * The 1 req/s cap is enforced here, for the whole app, by a serial queue: every
 * caller goes through `reverseGeocode`, so no amount of stop editing can burst.
 * Callers debounce on top of that (see `useReverseGeocode`).
 */

export const MIN_REQUEST_INTERVAL_MS = 1000;

const DEFAULT_ENDPOINT = "https://nominatim.openstreetmap.org/reverse";

/** House number / street level. Higher zoom asks Nominatim for a finer place. */
const REVERSE_ZOOM = 18;

export type NominatimAddress = {
  amenity?: string;
  building?: string;
  shop?: string;
  road?: string;
  pedestrian?: string;
  neighbourhood?: string;
  suburb?: string;
  village?: string;
  town?: string;
  city?: string;
  municipality?: string;
};

export type NominatimReverse = {
  name?: string | null;
  display_name?: string | null;
  address?: NominatimAddress | null;
  error?: string;
};

/** ~1 m of precision: enough for a stop, and it keeps the cache/query key stable. */
export const roundCoord = (n: number): number => Math.round(n * 1e5) / 1e5;

export const isValidLatLng = (lat: number, lng: number): boolean =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

export const buildReverseUrl = (
  lat: number,
  lng: number,
  options: { endpoint?: string; email?: string } = {}
): string => {
  const endpoint = options.endpoint?.trim() || DEFAULT_ENDPOINT;
  const url = new URL(endpoint);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(roundCoord(lat)));
  url.searchParams.set("lon", String(roundCoord(lng)));
  url.searchParams.set("zoom", String(REVERSE_ZOOM));
  url.searchParams.set("addressdetails", "1");
  const email = options.email?.trim();
  if (email) url.searchParams.set("email", email);
  return url.toString();
};

const MAX_NAME_LENGTH = 120;

/**
 * Pick a stop-sized name out of a reverse-geocode response: the place itself
 * ("Park Station"), qualified by its area ("Park Station, Braamfontein").
 * Returns "" when there is nothing usable — callers must leave the field alone
 * rather than write a guess over it.
 */
export const stopNameFromReverse = (payload: NominatimReverse | null | undefined): string => {
  if (!payload || payload.error) return "";
  const a = payload.address ?? {};
  const place =
    payload.name?.trim() ||
    a.amenity ||
    a.building ||
    a.shop ||
    a.road ||
    a.pedestrian ||
    payload.display_name?.split(",")[0]?.trim() ||
    "";
  const area = a.suburb || a.neighbourhood || a.village || a.town || a.city || a.municipality || "";
  const parts = [place, area].filter((p): p is string => Boolean(p && p.trim()));
  const name = (parts[0] === parts[1] ? parts.slice(0, 1) : parts).join(", ").trim();
  return name.length > MAX_NAME_LENGTH ? name.slice(0, MAX_NAME_LENGTH).trimEnd() : name;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

let chain: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

/** Run `task` after the previous one, never sooner than 1 s after the last request. */
const schedule = <T>(task: () => Promise<T>): Promise<T> => {
  const run = chain.then(async () => {
    const wait = MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt);
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    return task();
  });
  // Keep the queue alive after a failure; the caller still sees the rejection.
  chain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
};

/**
 * Coordinates → a suggested stop name, or "" when Nominatim has no name for
 * the spot. Throws on a network/HTTP failure; geocoding is a convenience, so
 * callers report it quietly and never block a save on it.
 */
export const reverseGeocode = async (
  lat: number,
  lng: number,
  options: { signal?: AbortSignal } = {}
): Promise<string> => {
  if (!isValidLatLng(lat, lng)) return "";
  return schedule(async () => {
    options.signal?.throwIfAborted();
    const response = await fetch(
      buildReverseUrl(lat, lng, {
        endpoint: import.meta.env.VITE_NOMINATIM_URL,
        email: import.meta.env.VITE_NOMINATIM_EMAIL,
      }),
      { signal: options.signal, headers: { Accept: "application/json" } }
    );
    if (!response.ok) throw new Error(`Nominatim responded ${response.status}`);
    return stopNameFromReverse((await response.json()) as NominatimReverse);
  });
};
