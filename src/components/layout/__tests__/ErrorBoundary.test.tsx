import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "../ErrorBoundary";
import { initErrorReporting, resetErrorReporting } from "@/lib/errorReporting";

const Boom = ({ fail }: { fail: boolean }) => {
  if (fail) throw new Error("render failed");
  return <p>All good</p>;
};

describe("ErrorBoundary", () => {
  beforeEach(() => {
    resetErrorReporting();
    // React logs the caught error itself; keep the test output readable.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    resetErrorReporting();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders its children when nothing throws", () => {
    render(
      <ErrorBoundary>
        <Boom fail={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText("All good")).toBeInTheDocument();
  });

  it("shows the fallback with a reload action instead of a blank screen", () => {
    render(
      <ErrorBoundary>
        <Boom fail />
      </ErrorBoundary>
    );
    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reload the page/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to home/i })).toBeInTheDocument();
    expect(screen.queryByText("All good")).not.toBeInTheDocument();
  });

  it("shows no reference id when reporting is off", () => {
    render(
      <ErrorBoundary>
        <Boom fail />
      </ErrorBoundary>
    );
    expect(screen.queryByText(/^Reference/)).not.toBeInTheDocument();
  });

  it("reports the crash and shows the id when a DSN is configured", () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    initErrorReporting({ dsn: "https://abc123@o42.ingest.sentry.io/4567" });

    render(
      <ErrorBoundary>
        <Boom fail />
      </ErrorBoundary>
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = fetchMock.mock.calls[0][1].body as string;
    const event = JSON.parse(body.trimEnd().split("\n")[2]);
    expect(event.exception.values[0].value).toBe("render failed");
    expect(event.extra.componentStack).toContain("Boom");
    expect(screen.getByText(event.event_id)).toBeInTheDocument();
  });
});
