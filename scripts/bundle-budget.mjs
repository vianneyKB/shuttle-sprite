#!/usr/bin/env node
/**
 * Guards the initial JavaScript payload of a production build (#35).
 *
 * "Initial" is what the browser fetches before it can render the first route:
 * the entry `<script type="module">` plus every `<link rel="modulepreload">`
 * Vite emits beside it. Lazily imported chunks — the pages, the maps — are not
 * counted, which is the whole point of the split.
 *
 * Run after `npm run build`:  node scripts/bundle-budget.mjs
 */

import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * The initial set, as asset paths relative to the HTML file. Order is entry
 * first, then preloads in document order.
 */
export function initialJsFromHtml(html) {
  const paths = [];
  const push = (src) => {
    if (src && src.endsWith(".js") && !paths.includes(src)) paths.push(src);
  };
  for (const [, src] of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)) push(src);
  for (const tag of html.match(/<link\b[^>]*>/g) ?? []) {
    if (/rel="modulepreload"/.test(tag)) push(tag.match(/href="([^"]+)"/)?.[1]);
  }
  return paths;
}

/**
 * An href in the HTML is served under `base` (`/shuttle-sprite/assets/x.js` on
 * Pages); on disk the same file sits at `assets/x.js` next to the HTML. Keep
 * everything from `assets/` onwards and the base prefix stops mattering.
 */
export function assetPath(src) {
  const at = src.lastIndexOf("assets/");
  return at === -1 ? src.replace(/^\/+/, "") : src.slice(at);
}

/** Sizes of each asset plus the totals, in bytes. */
export function measure(entries) {
  const rows = entries.map(({ name, bytes }) => ({
    name,
    raw: bytes.length,
    gzip: gzipSync(bytes, { level: 9 }).length,
  }));
  return {
    rows,
    raw: rows.reduce((n, r) => n + r.raw, 0),
    gzip: rows.reduce((n, r) => n + r.gzip, 0),
  };
}

const kB = (n) => `${(n / 1024).toFixed(2)} kB`;

export function report({ rows, raw, gzip }, budget) {
  const width = Math.max(...rows.map((r) => r.name.length), 5);
  const lines = [...rows]
    .sort((a, b) => b.raw - a.raw)
    .map((r) => `  ${r.name.padEnd(width)}  ${kB(r.raw).padStart(10)}  gzip ${kB(r.gzip).padStart(9)}`);
  lines.push(
    `  ${"total".padEnd(width)}  ${kB(raw).padStart(10)}  gzip ${kB(gzip).padStart(9)}`,
    `  budget: gzip ${kB(budget)} — ${gzip <= budget ? "OK" : "EXCEEDED"}`
  );
  return lines.join("\n");
}

/**
 * Gzip is what the browser actually pulls down, so that is what is capped.
 * Issue #35 asked for under 300 kB; the split landed at ~171 kB, and a budget
 * set at the number already met is a budget that can never fail. 200 kB leaves
 * room for a feature without leaving room for the single-bundle regression.
 */
export const INITIAL_JS_GZIP_BUDGET = 200 * 1024;

function main() {
  const htmlPath = resolve(process.argv[2] ?? "dist/index.html");
  const html = readFileSync(htmlPath, "utf8");
  const assets = initialJsFromHtml(html);
  if (assets.length === 0) {
    console.error(`No module scripts found in ${htmlPath} — did the build run?`);
    process.exit(1);
  }
  const dist = dirname(htmlPath);
  const result = measure(
    assets.map((src) => {
      const rel = assetPath(src);
      return { name: rel, bytes: readFileSync(join(dist, rel)) };
    })
  );
  console.log(`Initial JS for ${htmlPath} (${assets.length} chunks):`);
  console.log(report(result, INITIAL_JS_GZIP_BUDGET));
  if (result.gzip > INITIAL_JS_GZIP_BUDGET) {
    console.error(
      `\nInitial JS is ${kB(result.gzip)} gzipped, over the ${kB(INITIAL_JS_GZIP_BUDGET)} budget.\n` +
        "Make the new code a lazy import, or raise the budget deliberately in scripts/bundle-budget.mjs."
    );
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
