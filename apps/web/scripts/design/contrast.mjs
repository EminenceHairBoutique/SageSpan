// WCAG 2.x contrast check for the design-system token pairs (UI_001_DESIGN_SYSTEM_SPEC.md §1.1,
// UI_000_ACCESSIBILITY_PLAN.md §2). No dependencies. Reads the hex tokens from globals.css so the
// report always reflects the committed values.
//   node scripts/design/contrast.mjs            (from apps/web)
// Exit code 1 when any pair fails its threshold.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const css = readFileSync(path.resolve(here, "../../src/app/globals.css"), "utf8");
const tokens = {};
for (const m of css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) tokens[m[1]] = m[2].toLowerCase();

const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (fg, bg) => {
  const [a, b] = [lum(fg), lum(bg)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

// [foreground, background, threshold, purpose]
const pairs = [
  ["ink", "canvas", 4.5, "body text"],
  ["ink", "surface", 4.5, "body text"],
  ["ink-muted", "surface", 4.5, "secondary text"],
  ["ink-muted", "canvas", 4.5, "secondary text"],
  ["ink-muted", "surface-muted", 4.5, "table heads, neutral chips"],
  ["ink-faint", "surface", 4.5, "hashes, captions (A1)"],
  ["ink-faint", "canvas", 4.5, "hashes, captions (A1)"],
  ["ink-faint", "surface-muted", 4.5, "hashes, captions (A1)"],
  ["ink-faint", "surface-sunken", 4.5, "captions in wells"],
  ["link", "surface", 4.5, "links, receipt triggers"],
  ["link", "canvas", 4.5, "links on canvas"],
  ["navy-500", "surface", 4.5, "link primitive"],
  ["teal", "surface", 4.5, "accent text"],
  ["teal", "canvas", 4.5, "accent text on canvas"],
  ["teal-700", "teal-100", 4.5, "verified chip"],
  ["amber-700", "amber-100", 4.5, "limitation chip, synthetic banner"],
  ["slate-700", "slate-100", 4.5, "assumed chip"],
  ["conflict-700", "conflict-100", 4.5, "blocked chip"],
  ["navy", "navy-100", 4.5, "exceptions chip"],
  ["navy-700", "navy-100", 4.5, "exceptions chip (semantic fg)"],
  ["conflict-700", "surface", 4.5, "field error text"],
  ["surface", "navy", 4.5, "primary button label"],
  ["surface", "conflict", 4.5, "danger button label"],
  ["surface", "teal", 4.5, "reached checkpoint numeral"],
  ["line-input", "surface", 3, "input boundary (A2, 1.4.11)"],
  ["line-input", "canvas", 3, "input boundary on canvas"],
  ["focus", "surface", 3, "focus ring on surface (A5)"],
  ["focus", "canvas", 3, "focus ring on canvas (A5)"],
  ["focus", "teal-100", 3, "focus ring on verified chip (halo is surface)"],
  ["surface", "navy", 3, "focus halo on primary button"],
  ["ink-ghost", "surface", 1, "decorative only (never text)"],
];

const semantic = { link: tokens["navy-500"], focus: tokens.teal };
const resolve = (name) => tokens[name] ?? semantic[name];

let failed = 0;
const rows = pairs.map(([fg, bg, min, why]) => {
  const f = resolve(fg);
  const b = resolve(bg);
  if (!f || !b) throw new Error(`unknown token ${fg} or ${bg}`);
  const r = ratio(f, b);
  const ok = r >= min;
  if (!ok) failed++;
  return { pair: `${fg} on ${bg}`, fg: f, bg: b, ratio: r.toFixed(2), min: `${min}:1`, result: ok ? "pass" : "FAIL", why };
});

const w = (s, n) => String(s).padEnd(n);
console.log(`Contrast report for apps/web/src/app/globals.css (${Object.keys(tokens).length} colour tokens)\n`);
console.log(`${w("pair", 32)} ${w("fg", 8)} ${w("bg", 8)} ${w("ratio", 6)} ${w("min", 6)} ${w("result", 6)} purpose`);
for (const r of rows) console.log(`${w(r.pair, 32)} ${w(r.fg, 8)} ${w(r.bg, 8)} ${w(r.ratio, 6)} ${w(r.min, 6)} ${w(r.result, 6)} ${r.why}`);
console.log(`\n${rows.length - failed}/${rows.length} pairs meet their threshold.`);
process.exit(failed ? 1 : 0);
