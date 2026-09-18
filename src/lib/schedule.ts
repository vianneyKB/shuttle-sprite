/**
 * Helpers for the "ride now" vs "schedule for later" choice. Values from an
 * <input type="datetime-local"> are wall-clock strings with no zone
 * ("2026-09-18T15:30"); the database wants an absolute instant.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** Format a Date as the local wall-clock value a datetime-local input expects. */
export const toLocalInputValue = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Earliest selectable time: `leadMinutes` from now, rounded up to the next 5 minutes. */
export const earliestScheduleTime = (now = new Date(), leadMinutes = 15): Date => {
  const t = new Date(now.getTime() + leadMinutes * 60_000);
  t.setSeconds(0, 0);
  const rem = t.getMinutes() % 5;
  if (rem !== 0) t.setMinutes(t.getMinutes() + (5 - rem));
  return t;
};

/** Parse a datetime-local value in the browser's zone; null if empty or malformed. */
export const fromLocalInputValue = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const formatScheduled = (iso: string, locale?: string): string =>
  new Date(iso).toLocaleString(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
