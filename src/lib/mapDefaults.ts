/**
 * Starting viewport for every map in the app.
 *
 * Deliberately free of any Leaflet import: `routeStops.ts` needs the default
 * centre as a fallback coordinate, and pulling it from `@/lib/leaflet` dragged
 * Leaflet itself into whatever chunk imported those pure helpers.
 */

/** Johannesburg — where the first operators run. */
export const DEFAULT_MAP_CENTER: [number, number] = [-26.2041, 28.0473];
export const DEFAULT_MAP_ZOOM = 12;
