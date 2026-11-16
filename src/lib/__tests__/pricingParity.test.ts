/**
 * Pricing parity: the client reads exactly the keys Postgres sends.
 *
 * Every price shown to a passenger is computed in SQL —
 * `calculate_booking_price()` for a booking, `quote_ride_fare()` for a ride
 * request — and reaches the browser as a jsonb object. There is no generated
 * type for the inside of a jsonb, so nothing but this test stands between a
 * renamed key in a migration and a price silently rendering as `R 0,00`.
 *
 * So the keys are read back out of the migration files themselves: the last
 * migration that defines the function is the one in force, and the mapper's
 * output is compared against what that function can emit. A key added in SQL
 * and not mapped fails here; so does a key the mapper expects and SQL no
 * longer sends.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normaliseBreakdown, type DbBooking } from "@/hooks/useBookings";
import { mapQuote } from "@/hooks/useRouteFares";

const MIGRATIONS = join(process.cwd(), "supabase", "migrations");

/** The body of `fn` as last defined — migrations apply in filename order. */
const latestFunctionBody = (fn: string): string => {
  const marker = `create or replace function public.${fn}(`;
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();
  let body: string | undefined;
  for (const f of files) {
    const sql = readFileSync(join(MIGRATIONS, f), "utf8");
    const start = sql.lastIndexOf(marker);
    if (start === -1) continue;
    const end = sql.indexOf("\n$$;", start);
    body = sql.slice(start, end === -1 ? undefined : end);
  }
  if (!body) throw new Error(`No migration defines ${fn}()`);
  return body;
};

/** Split an argument list on its top-level commas, ignoring quotes and nesting. */
const splitArgs = (args: string): string[] => {
  const out: string[] = [];
  let depth = 0;
  let quoted = false;
  let current = "";
  for (const ch of args) {
    if (ch === "'") quoted = !quoted;
    if (!quoted && ch === "(") depth += 1;
    if (!quoted && ch === ")") depth -= 1;
    if (!quoted && ch === "," && depth === 0) {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) out.push(current);
  return out.map((s) => s.trim());
};

/**
 * Every key any `jsonb_build_object(...)` in `body` can emit. The union
 * matters: `quote_ride_fare` returns through two branches, and the "no fare"
 * one carries fewer keys than the priced one.
 */
const emittedKeys = (body: string): Set<string> => {
  const keys = new Set<string>();
  const call = "jsonb_build_object(";
  for (let i = body.indexOf(call); i !== -1; i = body.indexOf(call, i + 1)) {
    let depth = 0;
    let quoted = false;
    let end = -1;
    for (let j = i + call.length - 1; j < body.length; j += 1) {
      const ch = body[j];
      if (ch === "'") quoted = !quoted;
      if (quoted) continue;
      if (ch === "(") depth += 1;
      if (ch === ")") {
        depth -= 1;
        if (depth === 0) {
          end = j;
          break;
        }
      }
    }
    if (end === -1) throw new Error("Unbalanced jsonb_build_object(");
    splitArgs(body.slice(i + call.length, end)).forEach((arg, idx) => {
      if (idx % 2 !== 0) return; // odd positions are values
      const m = /^'(.+)'$/.exec(arg);
      if (!m) throw new Error(`jsonb key is not a literal: ${arg}`);
      keys.add(m[1]);
    });
  }
  if (keys.size === 0) throw new Error("No jsonb_build_object() found");
  return keys;
};

const sorted = (keys: Iterable<string>) => [...keys].sort();

describe("the SQL key extractor itself", () => {
  it("takes keys from the even positions and ignores literal values", () => {
    const keys = emittedKeys("jsonb_build_object('source', 'none', 'total', round(a + b, 2))");
    expect(sorted(keys)).toEqual(["source", "total"]);
  });

  it("unions the branches of a function that returns in more than one place", () => {
    const keys = emittedKeys("jsonb_build_object('a', 1); jsonb_build_object('a', 1, 'b', 2)");
    expect(sorted(keys)).toEqual(["a", "b"]);
  });
});

describe("calculate_booking_price() ↔ PriceBreakdown", () => {
  /** A row whose price_breakdown holds every key, as a current booking's does. */
  const row = (breakdown: Record<string, unknown>) =>
    ({
      total_price: 460,
      duration: 2,
      currency: "ZAR",
      subtotal: 400,
      tax_rate: 15,
      tax_amount: 60,
      price_breakdown: breakdown,
    }) as unknown as DbBooking;

  it("maps every key the function emits, and expects no others", () => {
    const sql = emittedKeys(latestFunctionBody("calculate_booking_price"));
    const mapped = normaliseBreakdown(row(Object.fromEntries([...sql].map((k) => [k, 1]))));
    expect(sorted(Object.keys(mapped))).toEqual(sorted(sql));
  });

  it("fills the keys an older row's price_breakdown never had", () => {
    // Rows written before currency and tax were snapshotted: the breakdown
    // falls back to the row's own columns rather than rendering zeros.
    const mapped = normaliseBreakdown(row({ hourlyRate: 200, duration: 2 }));
    expect(mapped.currency).toBe("ZAR");
    expect(mapped.subtotal).toBe(400);
    expect(mapped.taxRate).toBe(15);
    expect(mapped.taxAmount).toBe(60);
    expect(mapped.finalTotal).toBe(460);
    expect(mapped.recurringMultiplier).toBe(1);
    expect(mapped.taxLabel).toBe("Tax");
  });

  it("coerces the numerics Postgres sends as strings", () => {
    const mapped = normaliseBreakdown(
      row({ hourlyRate: "200.00", duration: "2", subtotal: "400.00", taxRate: "15.00", taxAmount: "60.00", finalTotal: "460.00" })
    );
    expect(mapped.hourlyRate).toBe(200);
    expect(mapped.subtotal).toBe(400);
    expect(mapped.finalTotal).toBe(460);
  });
});

describe("quote_ride_fare() ↔ RideFareQuote", () => {
  it("maps every key the function emits, and expects no others", () => {
    const sql = emittedKeys(latestFunctionBody("quote_ride_fare"));
    const mapped = mapQuote(Object.fromEntries([...sql].map((k) => [k, 1])));
    expect(sorted(Object.keys(mapped))).toEqual(sorted(sql));
  });

  it("keeps an absent fare absent instead of turning it into zero", () => {
    // The "no fare" branch sends nulls; a 0 here would read as a free ride.
    const mapped = mapQuote({
      source: "none",
      farePerSeat: null,
      passengers: 3,
      currency: "ZAR",
      subtotal: null,
      taxRate: 15,
      taxLabel: "VAT",
      taxAmount: null,
      total: null,
    });
    expect(mapped.farePerSeat).toBeUndefined();
    expect(mapped.total).toBeUndefined();
    expect(mapped.passengers).toBe(3);
    expect(mapped.pricesIncludeTax).toBe(false);
  });

  it("coerces the numerics and defaults a missing currency to the platform's", () => {
    const mapped = mapQuote({ farePerSeat: "18.50", passengers: "2", subtotal: "37.00", taxAmount: "5.55", total: "42.55" });
    expect(mapped.farePerSeat).toBe(18.5);
    expect(mapped.passengers).toBe(2);
    expect(mapped.total).toBe(42.55);
    expect(mapped.currency).toBe("ZAR");
    expect(mapped.source).toBe("none");
  });
});
