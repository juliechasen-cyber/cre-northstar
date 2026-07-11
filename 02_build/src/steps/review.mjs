import path from "node:path";
import { readJson, writeJson } from "../lib/files.mjs";
import { runDir } from "../lib/paths.mjs";

function fmtValue(v) {
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return s.length > 48 ? s.slice(0, 45) + "…" : s;
}

function fmtSource(src) {
  const bits = [src.doc];
  if (src.page) bits.push(`p.${src.page}`);
  if (src.sheet) bits.push(src.sheet);
  if (src.row) bits.push(`row ${src.row}`);
  if (src.range) bits.push(src.range);
  return bits.join(" · ");
}

// The v0.1 review gate. In the product this is the dashboard screen where
// the broker approves / edits / rejects each candidate; here it prints the
// full candidate table and, with approveAll, marks every extracted candidate
// approved. Without approveAll it stops so the broker can edit
// runs/<dealId>/manifest.json by hand (set status / editedValue) and re-run.
export function review({ dealId, approveAll = false }) {
  const manifestPath = path.join(runDir(dealId), "manifest.json");
  const manifest = readJson(manifestPath);

  console.log(`\nreview gate — ${manifest.candidates.length} candidates for ${dealId}\n`);
  const pad = (s, n) => String(s).padEnd(n).slice(0, n);
  console.log(
    pad("id", 9) + pad("field", 34) + pad("value", 50) + pad("conf", 6) + pad("source", 26) + "flags"
  );
  for (const c of manifest.candidates) {
    const flags = [c.note && "note", c.warning && "WARN"].filter(Boolean).join(",");
    console.log(
      pad(c.id, 9) +
        pad(c.field, 34) +
        pad(fmtValue(c.value), 50) +
        pad(c.confidence.toFixed(2), 6) +
        pad(fmtSource(c.source), 26) +
        flags
    );
    if (c.warning) console.log(`         ⚠ ${c.warning}`);
  }
  if (manifest.dataGaps?.length) {
    console.log(`\ndata gaps (${manifest.dataGaps.length}):`);
    for (const g of manifest.dataGaps) console.log(`  - ${g.field}: ${g.reason}`);
  }

  if (!approveAll) {
    const pending = manifest.candidates.filter((c) => c.status === "extracted").length;
    console.log(
      `\n${pending} candidates awaiting review. Edit ${manifestPath} (status: approved | edited | rejected, editedValue for edits), then re-run.`
    );
    return manifest;
  }

  let approved = 0;
  for (const c of manifest.candidates) {
    if (c.status === "extracted") {
      c.status = "approved";
      approved++;
    }
  }
  manifest.reviewedAt = new Date().toISOString();
  writeJson(manifestPath, manifest);
  console.log(`\nreview: auto-approved ${approved} candidates (--approve-all)`);
  return manifest;
}
