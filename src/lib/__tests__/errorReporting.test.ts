import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_EVENTS_PER_PAGE,
  buildEnvelope,
  buildEvent,
  describeError,
  errorIdentity,
  initErrorReporting,
  isErrorReportingEnabled,
  parseDsn,
  parseStackFrames,
  reportError,
  resetErrorReporting,
  scrubUrl,
} from "../errorReporting";

const DSN = "https://abc123@o42.ingest.sentry.io/4567";

/** The parts of a built event the assertions below reach into. */
type EventShape = {
  event_id: string;
  level: string;
  environment: string;
  release?: string;
  request?: { url: string };
  tags: Record<string, string>;
  extra: Record<string, unknown>;
  exception: {
    values: Array<{
      type: string;
      value: string;
      mechanism: { type: string; handled: boolean };
      stacktrace: { frames: unknown[] };
    }>;
  };
};

describe("parseDsn", () => {
  it("turns a DSN into the envelope endpoint", () => {
    expect(parseDsn(DSN)).toEqual({
      publicKey: "abc123",
      projectId: "4567",
      envelopeUrl:
        "https://o42.ingest.sentry.io/api/4567/envelope/?sentry_key=abc123&sentry_version=7",
    });
  });

  it("keeps the path prefix of a self-hosted Sentry", () => {
    expect(parseDsn("https://key@sentry.example.com/inner/path/9")?.envelopeUrl).toBe(
      "https://sentry.example.com/inner/path/api/9/envelope/?sentry_key=key&sentry_version=7"
    );
  });

  it("returns null for anything unusable, so reporting stays off", () => {
    expect(parseDsn(undefined)).toBeNull();
    expect(parseDsn("")).toBeNull();
    expect(parseDsn("   ")).toBeNull();
    expect(parseDsn("not-a-url")).toBeNull();
    expect(parseDsn("https://o42.ingest.sentry.io/4567")).toBeNull(); // no public key
    expect(parseDsn("https://abc123@o42.ingest.sentry.io/")).toBeNull(); // no project id
  });
});

describe("scrubUrl", () => {
  it("drops the query string and hash, where recovery tokens live", () => {
    expect(scrubUrl("https://app.example.com/reset-password#access_token=secret&type=recovery")).toBe(
      "https://app.example.com/reset-password"
    );
    expect(scrubUrl("https://app.example.com/operator?tab=queue")).toBe(
      "https://app.example.com/operator"
    );
  });

  it("drops credentials and survives a non-URL", () => {
    expect(scrubUrl("https://user:pw@app.example.com/x")).toBe("https://app.example.com/x");
    expect(scrubUrl("/operator?tab=queue")).toBe("/operator");
  });
});

describe("describeError", () => {
  it("normalises whatever was thrown", () => {
    expect(describeError(new TypeError("boom"))).toMatchObject({ type: "TypeError", value: "boom" });
    expect(describeError("plain string")).toEqual({ type: "Error", value: "plain string" });
    expect(describeError({ code: 42 })).toEqual({ type: "Error", value: '{"code":42}' });
  });
});

describe("parseStackFrames", () => {
  it("reads Chrome frames oldest-first and marks dependencies out of app", () => {
    const frames = parseStackFrames(
      [
        "Error: boom",
        "    at VehicleCard (https://app.example.com/assets/index.js:10:20)",
        "    at https://app.example.com/assets/node_modules/react-dom.js:5:6",
      ].join("\n")
    );
    expect(frames).toHaveLength(2);
    expect(frames[0]).toMatchObject({ in_app: false, lineno: 5, colno: 6 });
    expect(frames[1]).toMatchObject({ function: "VehicleCard", in_app: true, lineno: 10 });
  });

  it("reads Firefox frames and ignores noise", () => {
    const frames = parseStackFrames("handleBookNow@https://app.example.com/a.js:3:4\nnonsense");
    expect(frames).toEqual([
      {
        filename: "https://app.example.com/a.js",
        function: "handleBookNow",
        lineno: 3,
        colno: 4,
        in_app: true,
      },
    ]);
    expect(parseStackFrames(undefined)).toEqual([]);
  });
});

describe("errorIdentity", () => {
  it("matches the same error from the same place and separates different ones", () => {
    const a = new Error("boom");
    a.stack = "Error: boom\n    at f (app.js:1:1)";
    const b = new Error("boom");
    b.stack = "Error: boom\n    at f (app.js:1:1)";
    const c = new Error("boom");
    c.stack = "Error: boom\n    at g (app.js:9:1)";
    expect(errorIdentity(a)).toBe(errorIdentity(b));
    expect(errorIdentity(a)).not.toBe(errorIdentity(c));
  });
});

describe("buildEvent", () => {
  const meta = { eventId: "e".repeat(32), environment: "production", timestamp: 1_700_000_000 };

  it("describes the exception, the mechanism and the scrubbed page", () => {
    const error = new Error("render failed");
    error.stack = "Error: render failed\n    at Index (https://app.example.com/a.js:1:2)";
    const event = buildEvent(error, { ...meta, release: "v1", url: "https://app.example.com/?t=1" }, {
      componentStack: "\n    in Index",
      mechanism: "react-error-boundary",
      tags: { role: "passenger" },
    }) as unknown as EventShape;

    expect(event.event_id).toBe(meta.eventId);
    expect(event.level).toBe("error");
    expect(event.environment).toBe("production");
    expect(event.release).toBe("v1");
    expect(event.request).toEqual({ url: "https://app.example.com/" });
    expect(event.exception.values[0]).toMatchObject({
      type: "Error",
      value: "render failed",
      mechanism: { type: "react-error-boundary", handled: true },
    });
    expect(event.exception.values[0].stacktrace.frames).toHaveLength(1);
    expect(event.tags).toEqual({ mechanism: "react-error-boundary", role: "passenger" });
    expect(event.extra.componentStack).toBe("\n    in Index");
  });

  it("marks a global handler's error unhandled and omits an absent release", () => {
    const event = buildEvent("boom", meta, {
      mechanism: "onunhandledrejection",
    }) as unknown as EventShape;
    expect(event.exception.values[0].mechanism).toEqual({
      type: "onunhandledrejection",
      handled: false,
    });
    expect("release" in event).toBe(false);
    expect("request" in event).toBe(false);
  });
});

describe("buildEnvelope", () => {
  it("writes the three newline-delimited JSON lines Sentry expects", () => {
    const event = { event_id: "a".repeat(32), level: "error" };
    const body = buildEnvelope(event, DSN, new Date("2026-10-06T12:00:00.000Z"));
    expect(body.endsWith("\n")).toBe(true);
    const lines = body.trimEnd().split("\n");
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[0])).toEqual({
      event_id: "a".repeat(32),
      sent_at: "2026-10-06T12:00:00.000Z",
      dsn: DSN,
    });
    expect(JSON.parse(lines[1])).toEqual({ type: "event" });
    expect(JSON.parse(lines[2])).toEqual(event);
  });
});

describe("reportError", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetErrorReporting();
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    resetErrorReporting();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("is a no-op with no DSN configured", () => {
    expect(initErrorReporting({ dsn: "" })).toBe(false);
    expect(isErrorReportingEnabled()).toBe(false);
    expect(reportError(new Error("boom"))).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is a no-op when the DSN is malformed", () => {
    expect(initErrorReporting({ dsn: "nonsense" })).toBe(false);
    expect(reportError(new Error("boom"))).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts one envelope and returns the event id", () => {
    initErrorReporting({ dsn: DSN, environment: "staging", release: "v2" });
    const eventId = reportError(new Error("boom"), { mechanism: "react-error-boundary" });

    expect(eventId).toMatch(/^[0-9a-f]{32}$/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(parseDsn(DSN)!.envelopeUrl);
    expect(init.method).toBe("POST");
    expect(init.keepalive).toBe(true);
    expect(init.headers["content-type"]).toBe("application/x-sentry-envelope");

    const event = JSON.parse((init.body as string).trimEnd().split("\n")[2]);
    expect(event.event_id).toBe(eventId);
    expect(event.environment).toBe("staging");
    expect(event.release).toBe("v2");
    expect(event.exception.values[0].value).toBe("boom");
  });

  it("sends a repeat of the same error only once", () => {
    initErrorReporting({ dsn: DSN });
    const error = new Error("same");
    error.stack = "Error: same\n    at f (app.js:1:1)";
    expect(reportError(error)).not.toBeNull();
    expect(reportError(error)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops at the per-page cap", () => {
    initErrorReporting({ dsn: DSN });
    for (let i = 0; i < MAX_EVENTS_PER_PAGE + 5; i += 1) reportError(new Error(`boom ${i}`));
    expect(fetchMock).toHaveBeenCalledTimes(MAX_EVENTS_PER_PAGE);
  });

  it("swallows a failing transport", async () => {
    initErrorReporting({ dsn: DSN });
    fetchMock.mockRejectedValue(new Error("offline"));
    expect(() => reportError(new Error("boom"))).not.toThrow();
    await Promise.resolve();
  });
});
