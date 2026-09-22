import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MIN_REQUEST_INTERVAL_MS,
  buildReverseUrl,
  isValidLatLng,
  reverseGeocode,
  roundCoord,
  stopNameFromReverse,
} from "../geocode";

describe("buildReverseUrl", () => {
  it("asks Nominatim for an addressed jsonv2 result at street zoom", () => {
    const url = new URL(buildReverseUrl(-26.2041, 28.0473));
    expect(url.origin + url.pathname).toBe("https://nominatim.openstreetmap.org/reverse");
    expect(url.searchParams.get("format")).toBe("jsonv2");
    expect(url.searchParams.get("lat")).toBe("-26.2041");
    expect(url.searchParams.get("lon")).toBe("28.0473");
    expect(url.searchParams.get("zoom")).toBe("18");
    expect(url.searchParams.get("addressdetails")).toBe("1");
    expect(url.searchParams.has("email")).toBe(false);
  });

  it("uses a self-hosted endpoint and the contact address when configured", () => {
    const url = new URL(
      buildReverseUrl(-26.2, 28.05, {
        endpoint: "https://geo.example.com/reverse",
        email: " ops@example.com ",
      })
    );
    expect(url.origin + url.pathname).toBe("https://geo.example.com/reverse");
    expect(url.searchParams.get("email")).toBe("ops@example.com");
  });

  it("rounds coordinates to about a metre", () => {
    expect(roundCoord(-26.204123456)).toBe(-26.20412);
    expect(new URL(buildReverseUrl(-26.204123456, 28.047298765)).searchParams.get("lat")).toBe(
      "-26.20412"
    );
  });
});

describe("stopNameFromReverse", () => {
  it("qualifies the place with its area", () => {
    expect(
      stopNameFromReverse({
        name: "Park Station",
        address: { amenity: "Park Station", suburb: "Braamfontein", city: "Johannesburg" },
      })
    ).toBe("Park Station, Braamfontein");
  });

  it("falls back through amenity, building and road", () => {
    expect(stopNameFromReverse({ address: { building: "Bree Taxi Rank", suburb: "CBD" } })).toBe(
      "Bree Taxi Rank, CBD"
    );
    expect(stopNameFromReverse({ address: { road: "Jan Smuts Avenue", town: "Randburg" } })).toBe(
      "Jan Smuts Avenue, Randburg"
    );
  });

  it("uses the first chunk of display_name when the address has no place", () => {
    expect(
      stopNameFromReverse({ display_name: "N1 Highway, Midrand, Gauteng, South Africa" })
    ).toBe("N1 Highway");
  });

  it("does not repeat a place that is its own area", () => {
    expect(stopNameFromReverse({ name: "Soweto", address: { suburb: "Soweto" } })).toBe("Soweto");
  });

  it("returns nothing usable as an empty string", () => {
    expect(stopNameFromReverse(null)).toBe("");
    expect(stopNameFromReverse({})).toBe("");
    expect(stopNameFromReverse({ error: "Unable to geocode" })).toBe("");
  });

  it("caps a very long name", () => {
    const long = stopNameFromReverse({ name: "x".repeat(200), address: { suburb: "y" } });
    expect(long.length).toBe(120);
  });
});

describe("isValidLatLng", () => {
  it("rejects out-of-range and non-finite coordinates", () => {
    expect(isValidLatLng(-26.2, 28.05)).toBe(true);
    expect(isValidLatLng(91, 0)).toBe(false);
    expect(isValidLatLng(0, -181)).toBe(false);
    expect(isValidLatLng(Number.NaN, 0)).toBe(false);
  });
});

describe("reverseGeocode", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns the mapped name", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ name: "Bree Taxi Rank", address: { suburb: "CBD" } }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(reverseGeocode(-26.2, 28.05)).resolves.toBe("Bree Taxi Rank, CBD");
  });

  it("skips the request for impossible coordinates", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(reverseGeocode(Number.NaN, 28.05)).resolves.toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects on an HTTP error so the caller can stay quiet about it", async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(reverseGeocode(-26.2, 28.05)).rejects.toThrow("429");
  });

  // Last in the file on purpose: it moves the clock forward, and the queue
  // spaces the *next* request off that time.
  it("never sends a second request inside Nominatim's 1 req/s window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ name: "Stop" }) }));
    vi.stubGlobal("fetch", fetchMock);

    const first = reverseGeocode(-26.2, 28.05);
    const second = reverseGeocode(-26.3, 28.06);

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(MIN_REQUEST_INTERVAL_MS - 1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await expect(first).resolves.toBe("Stop");
    await expect(second).resolves.toBe("Stop");
  });
});
