/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Own Nominatim instance; defaults to the public openstreetmap.org one. */
  readonly VITE_NOMINATIM_URL?: string;
  /** Contact address sent to Nominatim, as its usage policy asks. */
  readonly VITE_NOMINATIM_EMAIL?: string;
}
