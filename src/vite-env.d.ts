/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Own Nominatim instance; defaults to the public openstreetmap.org one. */
  readonly VITE_NOMINATIM_URL?: string;
  /** Contact address sent to Nominatim, as its usage policy asks. */
  readonly VITE_NOMINATIM_EMAIL?: string;
  /** Sentry DSN. Unset switches crash reporting off entirely. */
  readonly VITE_SENTRY_DSN?: string;
  /** Label on reported events; defaults to the Vite mode. */
  readonly VITE_SENTRY_ENVIRONMENT?: string;
  /** Version reported events are tagged with, e.g. the commit sha. */
  readonly VITE_SENTRY_RELEASE?: string;
}
