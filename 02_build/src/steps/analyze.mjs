import fs from "node:fs";
import path from "node:path";
import { jsonCall, textBlock } from "../lib/client.mjs";
import { loadPrompt, readJson, writeJson } from "../lib/files.mjs";
import { agentsRoot, schemasRoot, runDir } from "../lib/paths.mjs";
import { conformToSchema, validateAgainst } from "../lib/validate.mjs";

// deal-analyst: approved/edited candidates + extracts → deal-facts.json.
// The harness enforces the gate — rejected and unreviewed candidates are
// stripped before the model ever sees the manifest.
export async function analyze({ dealId }) {
  const out = runDir(dealId);
  const manifest = readJson(path.join(out, "manifest.json"));

  const allApproved = manifest.candidates
    .filter((c) => c.status === "approved" || c.status === "edited")
    .map((c) => (c.status === "edited" ? { ...c, value: c.editedValue } : c));

  // Brand + photo candidates never pass through the model — they're assembled
  // into brand.json / media.json here and picked up directly by the renderers.
  // Only fact candidates feed the deal-analyst.
  const isBrand = (c) => String(c.field).startsWith("brand.");
  const isMedia = (c) => String(c.field).startsWith("media.");
  const approved = allApproved.filter((c) => !isBrand(c) && !isMedia(c));

  const brand = {};
  for (const c of allApproved.filter(isBrand)) {
    const key = c.field.slice("brand.".length);
    if (["primaryColor", "accentColor", "fontStyle"].includes(key)) brand[key] = c.value;
  }
  if (Object.keys(brand).length) {
    writeJson(path.join(out, "brand.json"), brand);
    console.log(`analyze: brand.json written (${Object.keys(brand).join(", ")})`);
  }

  const media = { photos: [], heroPhotoId: null };
  for (const c of allApproved.filter(isMedia)) {
    if (c.field === "media.photos[]" && c.value?.file) media.photos.push(c.value);
    else if (c.field === "media.heroPhotoId") media.heroPhotoId = c.value;
  }
  if (media.photos.length) {
    writeJson(path.join(out, "media.json"), media);
    console.log(`analyze: media.json written (${media.photos.length} photos, hero ${media.heroPhotoId ?? "auto"})`);
  }

  if (approved.length === 0) {
    throw new Error("no approved candidates — run the review gate first");
  }
  const excluded = manifest.candidates.length - allApproved.length;
  console.log(`analyze: ${approved.length} approved fact candidates in (${excluded} excluded at gate)`);

  const nowIso = new Date().toISOString();
  const dealFactsSchema = readJson(path.join(schemasRoot, "deal-facts.schema.json"));
  const system =
    loadPrompt(agentsRoot, "analysis/deal-analyst.md") +
    `\n\n## Output contract (harness)\n\nReturn one JSON object conforming exactly to deal-facts.schema.json:\n\n${JSON.stringify(dealFactsSchema)}\n\nSet dealId to "${dealId}" and generatedAt to "${nowIso}".`;

  // Extracts exist only for documents that were uploaded and parsed.
  const maybeExtract = (file, title) => {
    const p = path.join(out, file);
    return fs.existsSync(p)
      ? `\n\n## ${title}\n${JSON.stringify(readJson(p), null, 1)}`
      : `\n\n## ${title}\n(not provided for this deal)`;
  };

  let dealFacts = await jsonCall({
    label: "deal-analyst",
    system,
    userBlocks: [
      textBlock(
        `## Approved candidates (extraction manifest, post-gate)\n${JSON.stringify(approved, null, 1)}\n\n` +
          `## Data gaps\n${JSON.stringify(manifest.dataGaps ?? [], null, 1)}` +
          maybeExtract("rent-roll.json", "Rent roll extract") +
          maybeExtract("t12.json", "T12 extract")
      ),
    ],
  });

  // Identity fields are the harness's, not the model's.
  const stamp = (o) => { o.dealId = dealId; o.generatedAt = nowIso; return o; };

  // Real documents produce messy shapes. Conform instead of failing: prune
  // extras, coerce near-misses, drop what still can't validate (→ omission
  // downstream). One model repair attempt before giving up.
  let conform = conformToSchema("deal-facts", stamp(dealFacts));
  if (!conform.ok) {
    console.warn(`analyze: deal-facts off-contract (${conform.errors[0]}); asking the analyst to repair…`);
    dealFacts = stamp(
      await jsonCall({
        label: "deal-analyst-repair",
        system,
        userBlocks: [
          textBlock(
            `Your previous deal-facts JSON failed schema validation.\n\nValidation errors:\n${conform.errors
              .slice(0, 10)
              .join("\n")}\n\nYour previous JSON:\n${JSON.stringify(dealFacts)}\n\nReturn the corrected JSON object only — same facts, valid shape. Do not invent new values.`
          ),
        ],
      })
    );
    conform = conformToSchema("deal-facts", dealFacts);
    if (!conform.ok) {
      throw new Error(
        `we couldn't assemble a valid fact sheet from the approved data (${conform.errors[0]})`
      );
    }
  }
  validateAgainst("deal-facts", dealFacts);
  if (conform.notes.length) {
    console.warn(`analyze: conformed deal-facts:\n  - ${conform.notes.join("\n  - ")}`);
  }
  writeJson(path.join(out, "analysis-notes.json"), { dealId, generatedAt: nowIso, notes: conform.notes });

  const factsPath = path.join(out, "deal-facts.json");
  writeJson(factsPath, dealFacts);
  console.log(
    `analyze: deal-facts written (${dealFacts.highlights?.length ?? 0} highlights, ${dealFacts.risks?.length ?? 0} risks) → ${factsPath}`
  );
  return dealFacts;
}
