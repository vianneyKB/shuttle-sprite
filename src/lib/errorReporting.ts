/**
 * Crash reporting. Sends uncaught errors to Sentry over its public **envelope
 * endpoint**, which is plain HTTP — the DSN is all that is needed, so there is
 * no SDK in the bundle (see `docs/CHANGES.md` for why that mattered here).
 *
 * Everything is a no-op until `VITE_SENTRY_DSN` is set: a developer without a
 * DSN, and the CI build, behave exactly as before. Nothing here may throw into
 * the app — a reporter that breaks the page it is reporting on is worse than no
 * reporter, so every failure is swallowed.
 *
 * Privacy: the only context sent is the error itself, the component stack, the
 * path and the viewport. URLs are stripped of their query string and hash
 * because Supabase recovery links carry access tokens there, and a crash report
 * is not a place to leak one.
 */

/** Hard cap per page load, so a render loop cannot hammer the ingest endpoint. */
export const MAX_EVENTS_PER_PAGE = 20;

export type ParsedDsn = {
  publicKey: string;
  projectId: string;
  /** Full URL to POST envelopes to, including the auth query parameters. */
  envelopeUrl: string;
};

/**
 * `https://<publicKey>@<host>/<optional path>/<projectId>` — the string Sentry
 * shows under Project Settings → Client Keys. Anything else returns null, which
 * leaves reporting switched off rather than throwing at start-up.
 */
export const parseDsn = (dsn?: string | null): ParsedDsn | null => {
  const raw = (dsn ?? "").trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const publicKey = url.username;
  const segments = url.pathname.split("/").filter(Boolean);
  const projectId = segments.pop() ?? "";
  if (!publicKey || !projectId) return null;
  const prefix = segments.length ? `/${segments.join("/")}` : "";
  const envelopeUrl =
    `${url.protocol}//${url.host}${prefix}/api/${projectId}/envelope/` +
    `?sentry_key=${encodeURIComponent(publicKey)}&sentry_version=7`;
  return { publicKey, projectId, envelopeUrl };
};

/** Path only: no query string, no hash, no credentials. */
export const scrubUrl = (href: string): string => {
  try {
    const url = new URL(href);
    url.search = "";
    url.hash = "";
    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return href.split(/[?#]/)[0] ?? "";
  }
};

export type StackFrame = {
  filename?: string;
  function?: string;
  lineno?: number;
  colno?: number;
  in_app: boolean;
};

const CHROME_FRAME = /^\s*at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?\s*$/;
const FIREFOX_FRAME = /^\s*(.*?)@(.+?):(\d+):(\d+)\s*$/;

/**
 * Chrome (`at fn (file:1:2)`) and Firefox (`fn@file:1:2`) stack lines. Sentry
 * wants frames oldest-first, the opposite of how engines print them.
 */
export const parseStackFrames = (stack?: string | null): StackFrame[] => {
  if (!stack) return [];
  const frames: StackFrame[] = [];
  for (const line of stack.split("\n")) {
    const match = CHROME_FRAME.exec(line) ?? FIREFOX_FRAME.exec(line);
    if (!match) continue;
    const [, fn, filename, lineno, colno] = match;
    frames.push({
      filename,
      function: fn?.trim() || "?",
      lineno: Number(lineno),
      colno: Number(colno),
      in_app: !filename.includes("/node_modules/"),
    });
  }
  return frames.reverse();
};

/** Anything can be thrown in JavaScript; normalise it to a type and a message. */
export const describeError = (error: unknown): { type: string; value: string; stack?: string } => {
  if (error instanceof Error) {
    return { type: error.name || "Error", value: error.message || String(error), stack: error.stack };
  }
  if (typeof error === "string") return { type: "Error", value: error };
  try {
    return { type: "Error", value: JSON.stringify(error) ?? String(error) };
  } catch {
    return { type: "Error", value: String(error) };
  }
};

/** Dedupe key: the same message from the same place is only worth sending once. */
export const errorIdentity = (error: unknown): string => {
  const { type, value, stack } = describeError(error);
  return `${type}|${value}|${(stack ?? "").split("\n")[1]?.trim() ?? ""}`;
};

export type Mechanism = "react-error-boundary" | "onerror" | "onunhandledrejection" | "manual";

export type ReportContext = {
  componentStack?: string | null;
  mechanism?: Mechanism;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
};

export type SentryEvent = Record<string, unknown>;

export type EventMeta = {
  eventId: string;
  environment: string;
  release?: string;
  /** Seconds since the epoch, as Sentry's event payload wants it. */
  timestamp: number;
  url?: string;
};

export const buildEvent = (error: unknown, meta: EventMeta, context: ReportContext = {}): SentryEvent => {
  const { type, value, stack } = describeError(error);
  const handled = (context.mechanism ?? "manual") === "react-error-boundary";
  const extra: Record<string, unknown> = { ...context.extra };
  if (context.componentStack) extra.componentStack = context.componentStack;
  if (stack) extra.stack = stack;
  return {
    event_id: meta.eventId,
    timestamp: meta.timestamp,
    platform: "javascript",
    level: "error",
    logger: "browser",
    environment: meta.environment,
    ...(meta.release ? { release: meta.release } : {}),
    sdk: { name: "shuttlebook.envelope", version: "1" },
    exception: {
      values: [
        {
          type,
          value,
          stacktrace: { frames: parseStackFrames(stack) },
          mechanism: { type: context.mechanism ?? "manual", handled },
        },
      ],
    },
    ...(meta.url ? { request: { url: scrubUrl(meta.url) } } : {}),
    tags: { mechanism: context.mechanism ?? "manual", ...context.tags },
    extra,
  };
};

/**
 * One envelope carrying one event: an envelope header, an item header, then the
 * payload. Newline-delimited JSON; the trailing newline lets us omit `length`.
 */
export const buildEnvelope = (event: SentryEvent, dsn: string, sentAt: Date): string =>
  [
    JSON.stringify({ event_id: event.event_id, sent_at: sentAt.toISOString(), dsn }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event),
  ].join("\n") + "\n";

export type ErrorReportingOptions = {
  dsn?: string | null;
  environment?: string;
  release?: string;
};

type ActiveConfig = { dsn: string; parsed: ParsedDsn; environment: string; release?: string };

let config: ActiveConfig | null = null;
let sent = 0;
let seen = new Set<string>();
let listening = false;

const newEventId = (): string => {
  try {
    return crypto.randomUUID().replace(/-/g, "");
  } catch {
    let id = "";
    while (id.length < 32) id += Math.floor(Math.random() * 16).toString(16);
    return id.slice(0, 32);
  }
};

const inDev = (): boolean => Boolean(import.meta.env.DEV);

export const isErrorReportingEnabled = (): boolean => config !== null;

/** Test seam: forget the configuration, the cap and the dedupe set. */
export const resetErrorReporting = (): void => {
  config = null;
  sent = 0;
  seen = new Set<string>();
};

/**
 * Send one error. Returns the id of the event sent, or null when reporting is
 * off, the error is a repeat, or the cap is spent — the caller shows the id to
 * the person so they can quote it, so a null simply means there is none.
 */
export const reportError = (error: unknown, context: ReportContext = {}): string | null => {
  if (inDev()) console.error("[error]", error, context.componentStack ?? "");
  if (!config) return null;
  if (sent >= MAX_EVENTS_PER_PAGE) return null;
  const identity = errorIdentity(error);
  if (seen.has(identity)) return null;
  seen.add(identity);
  sent += 1;

  const eventId = newEventId();
  try {
    const event = buildEvent(error, {
      eventId,
      environment: config.environment,
      release: config.release,
      timestamp: Date.now() / 1000,
      url: typeof location === "undefined" ? undefined : location.href,
    }, context);
    const body = buildEnvelope(event, config.dsn, new Date());
    void fetch(config.parsed.envelopeUrl, {
      method: "POST",
      mode: "cors",
      keepalive: true,
      headers: { "content-type": "application/x-sentry-envelope" },
      body,
    }).catch(() => {
      /* The report is best-effort: a failed send must never surface. */
    });
  } catch {
    return null;
  }
  return eventId;
};

/**
 * Read the `VITE_SENTRY_*` variables and attach the global handlers. Safe to
 * call once at start-up whether or not a DSN is configured; returns whether
 * reporting is on.
 */
export const initErrorReporting = (options: ErrorReportingOptions = {}): boolean => {
  const env = import.meta.env;
  const dsn = (options.dsn ?? env.VITE_SENTRY_DSN ?? "").trim();
  const parsed = parseDsn(dsn);
  if (parsed) {
    config = {
      dsn,
      parsed,
      environment: options.environment ?? env.VITE_SENTRY_ENVIRONMENT ?? env.MODE ?? "production",
      release: options.release ?? env.VITE_SENTRY_RELEASE ?? undefined,
    };
  }

  if (!listening && typeof window !== "undefined") {
    listening = true;
    window.addEventListener("error", (e: ErrorEvent) => {
      reportError(e.error ?? e.message, { mechanism: "onerror" });
    });
    window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
      reportError(e.reason, { mechanism: "onunhandledrejection" });
    });
  }

  return isErrorReportingEnabled();
};
