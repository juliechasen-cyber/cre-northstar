// Broker-uploaded logo → three variants for downstream renderers, all local
// via jimp (pure JS, no API, no per-image cost). White-background detection
// samples the border pixels; if the frame is >85% near-white the logo is
// treated as a white-bg mark and we produce a transparent PNG (near-white →
// alpha 0). We also emit an "on-dark" variant that recolors dark pixels to
// off-white so the mark reads on Steel Navy backgrounds.
import Jimp from "jimp";
import fs from "node:fs";
import path from "node:path";

const NEAR_WHITE = 240;         // r,g,b all ≥ 240 counts as background
const BORDER_WHITE_RATIO = 0.85; // ≥85% of border pixels near-white → white bg
const DARK_LUMA = 140;          // pixels below this luma get inverted for on-dark

function isNearWhite(r, g, b) {
  return r >= NEAR_WHITE && g >= NEAR_WHITE && b >= NEAR_WHITE;
}

function borderWhiteRatio(img) {
  const { width: w, height: h, data } = img.bitmap;
  let white = 0, total = 0;
  const check = (x, y) => {
    const i = (y * w + x) * 4;
    total++;
    if (isNearWhite(data[i], data[i + 1], data[i + 2])) white++;
  };
  for (let x = 0; x < w; x++) { check(x, 0); check(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { check(0, y); check(w - 1, y); }
  return white / total;
}

// Near-white → alpha 0. Soft edge: pixels between NEAR_WHITE and 255 fade
// linearly so the cutout doesn't look aliased against a colored background.
function stripWhite(img) {
  img.scan(0, 0, img.bitmap.width, img.bitmap.height, (x, y, idx) => {
    const d = img.bitmap.data;
    const r = d[idx], g = d[idx + 1], b = d[idx + 2];
    const minC = Math.min(r, g, b);
    if (minC >= NEAR_WHITE) {
      // fully background → transparent
      d[idx + 3] = 0;
    } else if (minC >= NEAR_WHITE - 20) {
      // soft edge → partial alpha
      const t = (minC - (NEAR_WHITE - 20)) / 20;
      d[idx + 3] = Math.round(d[idx + 3] * (1 - t));
    }
  });
}

// For an on-dark variant, we want the mark's dark ink to become light. Uses
// per-pixel luma; leaves colored accents (lime, teal) roughly alone by only
// inverting near-gray pixels.
function darkToLight(img) {
  img.scan(0, 0, img.bitmap.width, img.bitmap.height, (x, y, idx) => {
    const d = img.bitmap.data;
    const r = d[idx], g = d[idx + 1], b = d[idx + 2];
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);
    // near-gray + dark → flip to off-white; leave saturated colors alone
    if (luma < DARK_LUMA && chroma < 40) {
      d[idx] = 255 - r;
      d[idx + 1] = 255 - g;
      d[idx + 2] = 255 - b;
    }
  });
}

// Trim uniform whitespace after transparency so the mark doesn't sit inside
// a huge box. Jimp's autocrop handles transparent + solid uniform borders.
function tightCrop(img) {
  try { img.autocrop({ tolerance: 0.005, cropOnlyFrames: false }); } catch {}
}

export async function prepLogo(srcPath, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const raw = await Jimp.read(srcPath);
  // Downscale huge uploads — 800px on the long edge is plenty for pptx / web.
  const long = Math.max(raw.bitmap.width, raw.bitmap.height);
  if (long > 800) raw.scaleToFit(800, 800);

  // 1. As-uploaded (light-bg use). Keep the broker's source untouched.
  const originalOut = path.join(outDir, "logo.png");
  await raw.clone().writeAsync(originalOut);

  const ratio = borderWhiteRatio(raw);
  const hasWhiteBg = ratio >= BORDER_WHITE_RATIO;

  // 2. Transparent variant — only when white bg detected. Falls back to a
  //    copy of the original so downstream renderers always find the file.
  const transparentOut = path.join(outDir, "logo-transparent.png");
  const t = raw.clone();
  if (hasWhiteBg) {
    stripWhite(t);
    tightCrop(t);
  }
  await t.writeAsync(transparentOut);

  // 3. On-dark variant — dark ink flipped so it reads on navy. Start from
  //    the transparent version when we have one, so we don't fight the bg.
  const onDarkOut = path.join(outDir, "logo-ondark.png");
  const d = (hasWhiteBg ? t : raw).clone();
  darkToLight(d);
  await d.writeAsync(onDarkOut);

  return {
    original: path.basename(originalOut),
    transparent: path.basename(transparentOut),
    onDark: path.basename(onDarkOut),
    hasWhiteBg,
    borderWhiteRatio: Number(ratio.toFixed(3)),
    width: raw.bitmap.width,
    height: raw.bitmap.height,
  };
}
