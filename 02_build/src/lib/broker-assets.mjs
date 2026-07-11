// Broker-uploaded photos + logo → manifest candidates, alongside the ones
// pulled from the OM. Photos are re-encoded to JPEG at 1600px longest edge
// (renderers expect JPEG in images/) and the logo runs through prepLogo to
// get the transparent / on-dark variants. All local, no API calls.
import Jimp from "jimp";
import fs from "node:fs";
import path from "node:path";
import { prepLogo } from "./logo-prep.mjs";

const PHOTO_MAX = 1600;

async function copyPhoto(srcPath, outDir, idx) {
  fs.mkdirSync(outDir, { recursive: true });
  const id = `broker-${String(idx).padStart(2, "0")}`;
  const rel = `images/${id}.jpg`;
  const img = await Jimp.read(srcPath);
  const long = Math.max(img.bitmap.width, img.bitmap.height);
  if (long > PHOTO_MAX) img.scaleToFit(PHOTO_MAX, PHOTO_MAX);
  await img.quality(88).writeAsync(path.join(outDir, `${id}.jpg`));
  return { id, file: rel, width: img.bitmap.width, height: img.bitmap.height };
}

// Produces schema-valid candidates for the extraction manifest. photos:
// [{ file: absPath, originalName }], logo: { file: absPath, originalName } | null
export async function brokerAssetCandidates({ photos = [], logo = null, dealDir }) {
  const candidates = [];
  const imagesOut = path.join(dealDir, "images");

  let seq = 0;
  for (const p of photos) {
    seq++;
    const info = await copyPhoto(p.file, imagesOut, seq);
    candidates.push({
      id: `bph-${String(seq).padStart(2, "0")}`,
      field: "media.photos[]",
      value: {
        id: info.id,
        file: info.file,
        category: "other",
        caption: p.originalName ? p.originalName.replace(/\.[^.]+$/, "").slice(0, 60) : "Broker-supplied photo",
      },
      source: { doc: "photos", file: p.originalName || info.file },
      confidence: 1,
      status: "extracted",
      note: "Uploaded directly by the broker — no OM extraction needed.",
    });
  }

  if (logo) {
    const info = await prepLogo(logo.file, path.join(dealDir, "brand"));
    const bgNote = info.hasWhiteBg
      ? `White background detected (${Math.round(info.borderWhiteRatio * 100)}% of border) — transparent + on-dark variants generated locally.`
      : `Non-white background — using logo as uploaded; on-dark variant flips near-gray ink for use on Steel Navy.`;
    candidates.push({
      id: "bl-01",
      field: "brand.logo",
      value: { file: `brand/${info.original}`, transparent: `brand/${info.transparent}`, onDark: `brand/${info.onDark}` },
      source: { doc: "photos", file: logo.originalName || "logo" },
      confidence: 1,
      status: "extracted",
      note: bgNote,
    });
  }

  return candidates;
}
