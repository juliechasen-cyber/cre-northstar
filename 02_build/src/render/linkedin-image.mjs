import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import Jimp from "jimp";
import { NAVY, LIME, TEAL, MIST, headStack, bodyStack } from "./brand.mjs";

// Branded LinkedIn share images in the DEAL's brand (colors/fonts adopted
// from the OM via applyBrand; the broker's own extracted logo on the card —
// never the CRE Northstar wordmark). Three standard sizes:
//   1200×627  — landscape link/sponsored
//   1080×1080 — square feed post
//   1080×1920 — vertical / story
// Card copy comes from the generator's imageCard spec: kicker (offer
// deadline when there is one), property-name headline, type·units·location
// subline, asking price first stat. Rendered locally via headless Chrome;
// falls back to plain hero crops so a run never ships image-less.

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const esc = (s) =>
  String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

// The broker's prepared logo variants (lib/logo-prep.mjs writes brand/…).
// On the dark panel we want the on-dark variant; brand.json may carry
// explicit paths, otherwise the conventional filenames are checked.
function findLogo(outDir) {
  let brand = {};
  try { brand = JSON.parse(fs.readFileSync(path.join(outDir, "brand.json"), "utf8")); } catch {}
  const candidates = [
    brand.logo?.onDark,
    "brand/logo-ondark.png",
    brand.logo?.transparent,
    "brand/logo-transparent.png",
  ].filter(Boolean);
  for (const rel of candidates) {
    const abs = path.join(outDir, rel);
    if (fs.existsSync(abs)) return abs;
  }
  return null;
}

// Geometry + type scale per size. Landscape splits photo|panel left/right;
// square and vertical stack photo over panel.
const PRESETS = [
  { w: 1200, h: 627, file: "linkedin-1200x627.jpg", layout: "row", photo: "46%",
    pad: "44px 52px", kicker: 19, h1: 42, sub: 21, statV: 40, statV2: 28, statL: 14, foot: 17, logoH: 44 },
  { w: 1080, h: 1080, file: "linkedin-1080x1080.jpg", layout: "column", photo: "50%",
    pad: "48px 64px", kicker: 23, h1: 56, sub: 26, statV: 54, statV2: 36, statL: 17, foot: 21, logoH: 54 },
  { w: 1080, h: 1920, file: "linkedin-1080x1920.jpg", layout: "column", photo: "46%",
    pad: "72px 72px", kicker: 27, h1: 68, sub: 31, statV: 66, statV2: 44, statL: 20, foot: 24, logoH: 64 },
];

function cardHtml(card, p, { heroPath, logoPath }) {
  const stats = (card.stats ?? []).slice(0, 2).map(
    (s, i) => `<div class="tile"><div class="tl">${esc(s.label)}</div><div class="tv ${i ? "tv2" : ""}">${esc(s.value)}</div></div>`
  ).join("");
  const photo = heroPath
    ? `<div class="photo" style="background-image:url('file://${encodeURI(heroPath)}')"></div>`
    : "";
  const foot = `
    <div class="foot">
      <div class="broker">${esc(card.brokerLine ?? "")}</div>
      ${logoPath ? `<img class="logo" src="file://${encodeURI(logoPath)}" alt="">` : ""}
    </div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin:0; box-sizing:border-box; }
  body { width:${p.w}px; height:${p.h}px; overflow:hidden; display:flex;
         flex-direction:${p.layout};
         background:#${NAVY}; font-family:${bodyStack()}; }
  .photo { ${p.layout === "row" ? `width:${p.photo}; height:100%` : `width:100%; height:${heroPath ? p.photo : "0"}`};
           background-size:cover; background-position:center; flex-shrink:0; }
  .panel { flex:1; display:flex; flex-direction:column; justify-content:center;
           padding:${p.pad}; min-height:0; }
  .kicker { color:#${LIME}; font-weight:700; letter-spacing:.2em; text-transform:uppercase;
            font-size:${p.kicker}px; margin-bottom:${Math.round(p.kicker * 0.8)}px; }
  h1 { font-family:${headStack()}; color:#fff; font-weight:700; line-height:1.1;
       font-size:${p.h1}px; margin-bottom:${Math.round(p.h1 * 0.28)}px; }
  .sub { color:#${TEAL}; font-weight:700; letter-spacing:.05em; text-transform:uppercase;
         font-size:${p.sub}px; margin-bottom:${Math.round(p.sub * 1.4)}px; }
  .tiles { display:flex; gap:${Math.round(p.statL * 1.4)}px; align-items:stretch;
           margin-bottom:${Math.round(p.statV * 0.8)}px; }
  .tile { border-top:5px solid #${LIME}; background:#ffffff10;
          padding:${Math.round(p.statL * 0.9)}px ${Math.round(p.statL * 1.4)}px; }
  .tl { color:#${TEAL}; font-weight:700; letter-spacing:.08em; text-transform:uppercase;
        font-size:${p.statL}px; margin-bottom:6px; }
  .tv { font-family:${headStack()}; color:#fff; font-weight:700; font-size:${p.statV}px; }
  .tv2 { font-size:${p.statV2}px; align-self:flex-end; }
  .foot { display:flex; justify-content:space-between; align-items:center; gap:24px;
          border-top:2px solid #ffffff2e; padding-top:${Math.round(p.foot)}px; }
  .broker { color:#${MIST}; font-size:${p.foot}px; white-space:nowrap;
            overflow:hidden; text-overflow:ellipsis; }
  .logo { height:${p.logoH}px; max-width:38%; object-fit:contain; flex-shrink:0; }
</style></head><body>
  ${photo}
  <div class="panel">
    ${card.kicker ? `<div class="kicker">${esc(card.kicker)}</div>` : ""}
    <h1>${esc(card.headline)}</h1>
    ${card.subline ? `<div class="sub">${esc(card.subline)}</div>` : ""}
    ${stats ? `<div class="tiles">${stats}</div>` : ""}
    ${foot}
  </div>
</body></html>`;
}

function screenshot(html, w, h, outPng) {
  const tmp = path.join(os.tmpdir(), `northstar-li-${Date.now()}-${w}x${h}.html`);
  fs.writeFileSync(tmp, html);
  try {
    execFileSync(
      CHROME,
      ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
       `--window-size=${w},${h}`, `--screenshot=${outPng}`, `file://${tmp}`],
      { stdio: "ignore", timeout: 30000 }
    );
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

// Returns the list of image files written. spec.imageCard carries the copy
// (generator contract); specs without it still get plain hero crops.
export async function renderLinkedInImages(card, { outDir, heroPath }) {
  const files = [];

  if (card?.headline && fs.existsSync(CHROME)) {
    const logoPath = findLogo(outDir);
    for (const p of PRESETS) {
      const jpg = path.join(outDir, p.file);
      const png = jpg.replace(/\.jpg$/, ".png");
      screenshot(cardHtml(card, p, { heroPath, logoPath }), p.w, p.h, png);
      const j = await Jimp.read(png);
      await j.quality(88).writeAsync(jpg); // well under LinkedIn's 5 MB cap
      fs.rmSync(png, { force: true });
      files.push(jpg);
    }
    return files;
  }

  // Fallback: no Chrome or no card copy — ship plain hero crops.
  if (heroPath) {
    if (!fs.existsSync(CHROME)) console.warn("  [linkedin] Chrome not found — hero crops without copy");
    for (const p of PRESETS) {
      const jpg = path.join(outDir, p.file);
      const j = await Jimp.read(heroPath);
      await j.cover(p.w, p.h).quality(85).writeAsync(jpg);
      files.push(jpg);
    }
  }
  return files;
}
