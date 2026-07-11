import fs from "node:fs";
import path from "node:path";

// Brand tokens the renderers draw from. Defaults are CRE Northstar's palette
// (brand-guidelines.md §1–2); when a deal carries a usable brand extracted
// from its OM (brand.json, assembled by analyze from gate-approved brand
// candidates), applyBrand() re-points these live bindings so every output in
// that run matches the broker's own colors and font style.
//
// Module-level state: the pipeline renders one deal at a time, and render()
// calls applyBrand() at the start of every run, so tokens never leak between
// deals. Nothing a broker edits in a content spec can change these.
const DEFAULTS = {
  NAVY: "344754",
  CHARCOAL: "424143",
  LIME: "8cc040",
  TEAL: "87c1bf",
  GRAY: "bcbec0",
  MIST: "eaedf2",
  OFFWHITE: "f8f9fa",
  HEAD_FONT: "Georgia",
  BODY_FONT: "Calibri",
};

export let NAVY = DEFAULTS.NAVY;
export let CHARCOAL = DEFAULTS.CHARCOAL;
export let LIME = DEFAULTS.LIME;
export let TEAL = DEFAULTS.TEAL;
export let GRAY = DEFAULTS.GRAY;
export let MIST = DEFAULTS.MIST;
export let OFFWHITE = DEFAULTS.OFFWHITE;
export let HEAD_FONT = DEFAULTS.HEAD_FONT;
export let BODY_FONT = DEFAULTS.BODY_FONT;

const cleanHex = (v) => {
  const h = String(v ?? "").replace(/^#/, "").trim().toLowerCase();
  return /^[0-9a-f]{6}$/.test(h) ? h : null;
};

// Relative luminance 0..1 — cheap proxy, good enough to keep white text readable.
const luma = (hex) => {
  const n = parseInt(hex, 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
};

// Mix toward white by factor f (0..1) — derives the light companions so the
// whole palette harmonizes with the broker's primary instead of clashing.
const tint = (hex, f) => {
  const n = parseInt(hex, 16);
  const ch = (v) => Math.round(v + (255 - v) * f).toString(16).padStart(2, "0");
  return ch((n >> 16) & 255) + ch((n >> 8) & 255) + ch(n & 255);
};

export function loadBrand(outDir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(outDir, "brand.json"), "utf8"));
  } catch {
    return {};
  }
}

// Adopt a deal's brand — anything missing or unusable falls back to defaults,
// silently. A bad extracted color must never break or uglify a run.
export function applyBrand(brand = {}) {
  NAVY = DEFAULTS.NAVY;
  CHARCOAL = DEFAULTS.CHARCOAL;
  LIME = DEFAULTS.LIME;
  TEAL = DEFAULTS.TEAL;
  GRAY = DEFAULTS.GRAY;
  MIST = DEFAULTS.MIST;
  OFFWHITE = DEFAULTS.OFFWHITE;
  HEAD_FONT = DEFAULTS.HEAD_FONT;
  BODY_FONT = DEFAULTS.BODY_FONT;

  const primary = cleanHex(brand.primaryColor);
  // Primary sits behind white text (covers, hero, footer) — must be dark enough.
  if (primary && luma(primary) < 0.55) {
    NAVY = primary;
    TEAL = tint(primary, 0.55);
    MIST = tint(primary, 0.9);
    OFFWHITE = tint(primary, 0.96);
  }
  const accent = cleanHex(brand.accentColor);
  // Accent draws bars and highlight text — reject near-white/near-black.
  if (accent && luma(accent) > 0.08 && luma(accent) < 0.92) {
    LIME = accent;
  }
  if (brand.fontStyle === "serif") {
    HEAD_FONT = "Georgia";
    BODY_FONT = "Cambria";
  } else if (brand.fontStyle === "sans-serif") {
    HEAD_FONT = "Helvetica";
    BODY_FONT = "Calibri";
  }
}

const SERIF = new Set(["Georgia", "Cambria", "Times New Roman"]);
// CSS font stacks with universal fallbacks (website + html email renders).
export const headStack = () => `${HEAD_FONT}, ${SERIF.has(HEAD_FONT) ? "serif" : '"Segoe UI", Arial, sans-serif'}`;
export const bodyStack = () => `${BODY_FONT}, ${SERIF.has(BODY_FONT) ? "serif" : '"Segoe UI", Arial, sans-serif'}`;
