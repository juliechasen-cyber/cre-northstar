import fs from "node:fs";
import path from "node:path";
import Jimp from "jimp";
import { jsonCall, pdfBlock, textBlock, imageBlock } from "../lib/client.mjs";
import { sha256, xlsxToCsvText, loadPrompt, readJson, writeJson } from "../lib/files.mjs";
import { saveDealImages } from "../lib/pdf-images.mjs";
import { agentsRoot, schemasRoot, runDir } from "../lib/paths.mjs";
import { conformToSchema, validateAgainst } from "../lib/validate.mjs";
import { brokerAssetCandidates } from "../lib/broker-assets.mjs";

const CANDIDATE_CONTRACT = `
## Output contract (harness)

Return one JSON object:

{
  "candidates": [
    {
      "id": "<PREFIX>-001",            // sequential, prefix given below
      "field": "<dot-path into deal-facts, e.g. 'property.units', 'financials.noi', 'highlights[]'>",
      "value": <extracted value>,
      "source": { "doc": "<DOC>", ... },  // page for PDF; sheet/row/range for spreadsheets
      "confidence": <0..1>,
      "status": "extracted",
      "note": "<only when you inferred or chose between columns>",
      "warning": "<only when a validation concern exists>"
    }
  ],
  "dataGaps": [ { "field": "<dot-path>", "reason": "<why it could not be extracted>" } ]
}

Source objects may only use keys: doc, page, sheet, row, col, range, file.
Every candidate MUST have status "extracted". Never invent a value to fill a gap.`;

function extractContract(prefix, doc) {
  return CANDIDATE_CONTRACT.replaceAll("<PREFIX>", prefix).replaceAll("<DOC>", doc);
}

const PHOTO_CONTRACT = `
## Output contract (harness)

Return one JSON object:

{
  "candidates": [
    {
      "id": "ph-01",                       // sequential
      "field": "media.photos[]",
      "value": {
        "id": "<img-NN as labeled>",
        "file": "images/<img-NN>.jpg",
        "category": "exterior|interior-unit|amenity|aerial|signage|neighborhood|floorplan|other",
        "caption": "<≤ 10 words, factual>",
        "qualityFlags": ["<only when real>"]
      },
      "source": { "doc": "om", "file": "images/<img-NN>.jpg" },
      "confidence": <0..1>,
      "status": "extracted"
    },
    {
      "id": "ph-hero",
      "field": "media.heroPhotoId",
      "value": "<img-NN>",
      "source": { "doc": "om" },
      "confidence": <0..1>,
      "status": "extracted"
    }
  ],
  "dataGaps": []
}

Discarded images (logos, maps, fragments, duplicates) get no candidate at all.`;

function extractWithSchemaContract(prefix, doc, schemaName, schemaJson) {
  return `${extractContract(prefix, doc)}

Additionally include an "extract" key holding the full structured extract,
conforming exactly to this JSON schema (${schemaName}.schema.json):

${JSON.stringify(schemaJson)}`;
}

// Locate an input by conventional basename, any supported extension.
function findInput(dir, base, exts) {
  for (const ext of exts) {
    const p = path.join(dir, `${base}.${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// Broker-uploaded photos live in inputs/photos/ as photo-01..04.<ext>; the
// server preserves the original filename in a side-channel we don't need to
// track — the file basename is enough for the caption fallback.
function findBrokerPhotos(inputDir) {
  const dir = path.join(inputDir, "photos");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => /\.(jpe?g|png)$/i.test(f))
    .sort()
    .map((f) => ({ file: path.join(dir, f), originalName: f }));
}

function findBrokerLogo(inputDir) {
  for (const ext of ["png", "jpg", "jpeg"]) {
    const p = path.join(inputDir, `logo.${ext}`);
    if (fs.existsSync(p)) return { file: p, originalName: `logo.${ext}` };
  }
  return null;
}

// Spreadsheet-ish input → CSV text sections (XLSX converted; CSV passed through).
function tabularText(filePath) {
  if (filePath.toLowerCase().endsWith(".csv")) {
    return { text: fs.readFileSync(filePath, "utf8"), sheets: ["CSV"] };
  }
  return xlsxToCsvText(filePath);
}

const MAX_PDF_BYTES = 25 * 1024 * 1024; // stay under the API's 32MB request cap post-base64

// Run parsers for whichever documents exist in inputDir and assemble the
// extraction manifest. Missing documents become data gaps, not errors —
// a broker with only an OM still gets a pipeline run.
export async function extract({ dealId, inputDir }) {
  const out = runDir(dealId);
  const now = new Date().toISOString();

  const omPath = findInput(inputDir, "offering-memo", ["pdf"]);
  const rrPath = findInput(inputDir, "rent-roll", ["xlsx", "csv"]);
  const t12Path = findInput(inputDir, "t12", ["xlsx", "csv"]);
  if (!omPath && !rrPath && !t12Path) {
    throw new Error(`no inputs found in ${inputDir} (need offering-memo.pdf, rent-roll.xlsx/csv, or t12.xlsx/csv)`);
  }
  if (omPath && fs.statSync(omPath).size > MAX_PDF_BYTES) {
    throw new Error("offering memo exceeds 25 MB — export a lighter PDF (or split out the photo pages) and retry");
  }

  const calls = [];
  const documents = [];
  const docGaps = [];

  if (omPath) {
    documents.push({ docId: "om", docType: "om", filename: path.basename(omPath), sha256: sha256(omPath) });
    calls.push(
      jsonCall({
        label: "om-parser",
        system: loadPrompt(agentsRoot, "ingestion/om-parser.md") + extractContract("om", "om"),
        userBlocks: [
          textBlock("Offering Memorandum (PDF attached). Extract candidates per your instructions."),
          pdfBlock(fs.readFileSync(omPath).toString("base64")),
        ],
      })
    );
  } else docGaps.push({ field: "documents.om", reason: "offering memo not uploaded" });

  // Photos: pulled from the OM by code, curated by vision in the same wave.
  const dealImages = omPath ? saveDealImages(omPath, out) : [];
  if (dealImages.length) {
    const photoBlocks = [
      textBlock(
        `Images extracted from the Offering Memorandum (${dealImages.length} total). ` +
          `Each is labeled with its id and original pixel size; thumbnails attached.`
      ),
    ];
    for (const img of dealImages) {
      const j = await Jimp.read(path.join(out, img.file));
      j.resize(Math.min(384, j.bitmap.width), Jimp.AUTO).quality(70);
      photoBlocks.push(textBlock(`--- ${img.id} (${img.width}×${img.height}) ---`));
      photoBlocks.push(imageBlock((await j.getBufferAsync(Jimp.MIME_JPEG)).toString("base64")));
    }
    calls.push(
      jsonCall({
        label: "photo-curator",
        system: loadPrompt(agentsRoot, "ingestion/photo-curator.md") + PHOTO_CONTRACT,
        userBlocks: photoBlocks,
      })
    );
    console.log(`extract: ${dealImages.length} images pulled from the OM → images/`);
  }

  let rrRes = null;
  if (rrPath) {
    const rr = tabularText(rrPath);
    documents.push({
      docId: "rent-roll", docType: "rent-roll", filename: path.basename(rrPath),
      sha256: sha256(rrPath), sheets: rr.sheets,
    });
    const rrSchema = readJson(path.join(schemasRoot, "rent-roll.schema.json"));
    calls.push(
      jsonCall({
        label: "rent-roll-parser",
        system:
          loadPrompt(agentsRoot, "ingestion/rent-roll-parser.md") +
          extractWithSchemaContract("rr", "rent-roll", "rent-roll", rrSchema),
        userBlocks: [
          textBlock(
            `Rent roll (converted to CSV, one section per sheet).\nOriginal file: ${path.basename(rrPath)}\n\n${rr.text}`
          ),
        ],
      })
    );
  } else docGaps.push({ field: "documents.rent-roll", reason: "rent roll not uploaded — unit mix, occupancy and rent analytics unavailable" });

  if (t12Path) {
    const t12 = tabularText(t12Path);
    documents.push({
      docId: "t12", docType: "t12", filename: path.basename(t12Path),
      sha256: sha256(t12Path), sheets: t12.sheets,
    });
    const t12Schema = readJson(path.join(schemasRoot, "t12.schema.json"));
    calls.push(
      jsonCall({
        label: "t12-parser",
        system:
          loadPrompt(agentsRoot, "ingestion/t12-parser.md") +
          extractWithSchemaContract("t12", "t12", "t12", t12Schema),
        userBlocks: [
          textBlock(
            `Trailing-12 operating statement (converted to CSV, one section per sheet).\nOriginal file: ${path.basename(t12Path)}\n\n${t12.text}`
          ),
        ],
      })
    );
  } else docGaps.push({ field: "documents.t12", reason: "T12 not uploaded — operating financials come from the OM only and are unverified" });

  console.log(`extract: running ${calls.length} parser(s) in parallel…`);
  const results = await Promise.all(calls);

  // Persist full extracts for the deal-analyst (only for docs that ran).
  const candidates = [];
  const dataGaps = [...docGaps];
  // Real-world documents come in every shape; conform extracts to the schema
  // (prune/coerce/drop with notes) rather than failing the upload. An extract
  // that can't be salvaged becomes a data gap — the candidates still stand.
  const keepExtract = (schemaName, extractObj, file, gapField, gapReason) => {
    const c = conformToSchema(schemaName, extractObj);
    if (c.notes.length) console.warn(`extract: ${schemaName} extract conformed:\n  - ${c.notes.join("\n  - ")}`);
    if (c.ok) writeJson(path.join(out, file), extractObj);
    else dataGaps.push({ field: gapField, reason: gapReason });
  };

  // Broker-uploaded photos + logo — dropped straight into candidates alongside
  // the OM-extracted ones. No AI call: the broker already curated them.
  const brokerPhotos = findBrokerPhotos(inputDir);
  const brokerLogo = findBrokerLogo(inputDir);
  if (brokerPhotos.length || brokerLogo) {
    const brokerCands = await brokerAssetCandidates({ photos: brokerPhotos, logo: brokerLogo, dealDir: out });
    candidates.push(...brokerCands);
    if (brokerPhotos.length || brokerLogo) documents.push({ docId: "broker-assets", docType: "photos", filename: "brand-assets", sha256: "" });
    console.log(`extract: ${brokerPhotos.length} broker photo(s)${brokerLogo ? " + logo" : ""} added to manifest`);
  }

  for (const res of results) {
    candidates.push(...(res.candidates ?? []));
    dataGaps.push(...(res.dataGaps ?? []));
    if (res.extract?.units) {
      keepExtract("rent-roll", res.extract, "rent-roll.json", "extracts.rent-roll",
        "unit table couldn't be read in full — reviewed unit facts above still apply");
    } else if (res.extract?.period) {
      keepExtract("t12", res.extract, "t12.json", "extracts.t12",
        "operating statement table couldn't be read in full — reviewed financial facts above still apply");
    }
  }

  const manifest = { dealId, createdAt: now, documents, candidates, dataGaps };
  const mc = conformToSchema("extraction-manifest", manifest);
  if (mc.notes.length) console.warn(`extract: manifest conformed:\n  - ${mc.notes.join("\n  - ")}`);
  if (!mc.ok) {
    throw new Error(`we couldn't produce a readable fact list from these documents (${mc.errors[0]}) — please retry the upload`);
  }
  validateAgainst("extraction-manifest", manifest);
  const manifestPath = path.join(out, "manifest.json");
  writeJson(manifestPath, manifest);
  console.log(
    `extract: ${manifest.candidates.length} candidates, ${manifest.dataGaps.length} data gaps → ${manifestPath}`
  );
  return manifest;
}
