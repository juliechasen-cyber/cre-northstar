import fs from "node:fs";
import path from "node:path";
import { readJson, writeJson } from "../lib/files.mjs";
import { runDir } from "../lib/paths.mjs";
import { applyBrand, loadBrand } from "../render/brand.mjs";
import { REGISTRY, validateSpec } from "../outputs/registry.mjs";

// Broker-approved photo set (media.json, assembled by analyze). The hero is
// whatever the broker confirmed at the gate; if that photo is gone, fall back
// to the best remaining one rather than shipping image-less outputs.
function resolveHero(outDir) {
  const p = path.join(outDir, "media.json");
  if (!fs.existsSync(p)) return { media: null, heroPath: null };
  const media = readJson(p);
  const photos = (media.photos ?? []).filter((ph) => ph.file && fs.existsSync(path.join(outDir, ph.file)));
  const hero =
    photos.find((ph) => ph.id === media.heroPhotoId) ??
    photos.find((ph) => ph.category !== "floorplan" && !(ph.qualityFlags?.length)) ??
    photos[0];
  return { media, heroPath: hero ? path.join(outDir, hero.file) : null };
}

// Render every named output's spec.json into its broker-facing files.
// Outputs flagged renderLast (crm-entry) run after the rest so they can
// reference the produced files (assetLinks). One bad spec never sinks the
// package — that output is skipped with a reason and reported.
export async function render({ dealId, outputs }) {
  const outDir = runDir(dealId);
  applyBrand(loadBrand(outDir)); // deal's own colors/fonts, or house defaults
  const { media, heroPath } = resolveHero(outDir);
  if (heroPath) console.log(`render: hero photo ${path.basename(heroPath)}`);
  const assetLinks = {};
  const skipped = [];
  const ordered = [
    ...outputs.filter((n) => !REGISTRY[n]?.renderLast),
    ...outputs.filter((n) => REGISTRY[n]?.renderLast),
  ];

  for (const name of ordered) {
    try {
      const entry = REGISTRY[name];
      if (!entry) throw new Error(`unknown output "${name}"`);
      const specPath = path.join(outDir, `${name}.spec.json`);
      if (!fs.existsSync(specPath)) throw new Error("no content spec (generation was skipped)");
      let spec = readJson(specPath);
      const ctx = {
        dealId,
        outDir,
        media,
        heroPath,
        assetLinks,
        producedOutputs: Object.keys(assetLinks),
      };
      if (entry.postProcess) {
        spec = entry.postProcess(spec, ctx) ?? spec;
        writeJson(specPath, spec); // keep the editable spec in sync with what rendered
      }
      validateSpec(name, spec);
      const files = await entry.render(spec, ctx);
      assetLinks[name] = files;
      for (const f of files) console.log(`render: ${path.relative(process.cwd(), f)}`);
    } catch (e) {
      console.warn(`render: ${name} skipped — ${e.message}`);
      skipped.push({ name, error: e.message });
    }
  }
  return { assetLinks, skipped };
}
