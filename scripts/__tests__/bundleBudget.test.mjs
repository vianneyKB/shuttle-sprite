import { describe, expect, it } from "vitest";
import {
  INITIAL_JS_GZIP_BUDGET,
  assetPath,
  initialJsFromHtml,
  measure,
  report,
} from "../bundle-budget.mjs";

/**
 * The budget script decides whether CI passes, so the rule it applies is worth
 * testing — a parser that quietly matched nothing would report 0 kB and always
 * be under budget.
 */

const html = `<!DOCTYPE html><html><head>
  <script type="module" crossorigin src="/shuttle-sprite/assets/index-aaa.js"></script>
  <link rel="modulepreload" crossorigin href="/shuttle-sprite/assets/react-bbb.js">
  <link rel="modulepreload" crossorigin href="/shuttle-sprite/assets/supabase-ccc.js">
  <link rel="stylesheet" crossorigin href="/shuttle-sprite/assets/index-ddd.css">
  <link rel="canonical" href="https://example.test/">
</head><body><div id="root"></div></body></html>`;

describe("initialJsFromHtml", () => {
  it("takes the entry script and every modulepreload, entry first", () => {
    expect(initialJsFromHtml(html)).toEqual([
      "/shuttle-sprite/assets/index-aaa.js",
      "/shuttle-sprite/assets/react-bbb.js",
      "/shuttle-sprite/assets/supabase-ccc.js",
    ]);
  });

  it("leaves out the stylesheet and unrelated links", () => {
    expect(initialJsFromHtml(html).some((p) => p.endsWith(".css"))).toBe(false);
    expect(initialJsFromHtml(html)).not.toContain("https://example.test/");
  });

  it("ignores a prefetch of a lazy chunk — it is not part of the first load", () => {
    const withPrefetch = html.replace(
      "</head>",
      '<link rel="prefetch" href="/shuttle-sprite/assets/Operator-eee.js"></head>'
    );
    expect(initialJsFromHtml(withPrefetch)).not.toContain(
      "/shuttle-sprite/assets/Operator-eee.js"
    );
  });

  it("counts a chunk listed twice only once", () => {
    const dup = html.replace(
      "</head>",
      '<link rel="modulepreload" href="/shuttle-sprite/assets/react-bbb.js"></head>'
    );
    expect(initialJsFromHtml(dup)).toHaveLength(3);
  });

  it("finds nothing in an HTML file the build never touched", () => {
    expect(initialJsFromHtml('<html><body><div id="root"></div></body></html>')).toEqual([]);
  });
});

describe("assetPath", () => {
  it("drops the deployment base so the file can be read from dist", () => {
    expect(assetPath("/shuttle-sprite/assets/index-aaa.js")).toBe("assets/index-aaa.js");
    expect(assetPath("/assets/index-aaa.js")).toBe("assets/index-aaa.js");
  });

  it("leaves a path with no assets directory usable", () => {
    expect(assetPath("/shuttle-sprite/entry.js")).toBe("shuttle-sprite/entry.js");
  });
});

describe("measure", () => {
  const entries = [
    { name: "a.js", bytes: Buffer.from("x".repeat(4096)) },
    { name: "b.js", bytes: Buffer.from("y".repeat(2048)) },
  ];

  it("totals raw and gzipped bytes across the set", () => {
    const result = measure(entries);
    expect(result.raw).toBe(6144);
    expect(result.gzip).toBe(result.rows[0].gzip + result.rows[1].gzip);
    expect(result.gzip).toBeLessThan(result.raw);
  });

  it("reports each chunk separately so a regression names its culprit", () => {
    expect(measure(entries).rows.map((r) => r.name)).toEqual(["a.js", "b.js"]);
  });
});

describe("report", () => {
  it("says OK at the budget and EXCEEDED one byte over", () => {
    const at = { rows: [{ name: "a.js", raw: 10, gzip: 100 }], raw: 10, gzip: 100 };
    expect(report(at, 100)).toContain("OK");
    expect(report({ ...at, gzip: 101 }, 100)).toContain("EXCEEDED");
  });

  it("orders chunks largest first and does not reorder the caller's rows", () => {
    const rows = [
      { name: "small.js", raw: 1, gzip: 1 },
      { name: "big.js", raw: 100, gzip: 50 },
    ];
    const lines = report({ rows, raw: 101, gzip: 51 }, INITIAL_JS_GZIP_BUDGET).split("\n");
    expect(lines[0]).toContain("big.js");
    expect(rows[0].name).toBe("small.js");
  });
});
