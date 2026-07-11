import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import * as XLSX from "xlsx";

export function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

// XLSX → one CSV text section per sheet (deterministic input for the parser,
// avoids spreadsheet-parsing hallucinations — ARCHITECTURE.md §5).
export function xlsxToCsvText(filePath) {
  // XLSX.read on a buffer — the ESM build's readFile isn't wired to fs
  const wb = XLSX.read(fs.readFileSync(filePath), { type: "buffer" });
  const sections = wb.SheetNames.map((name) => {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
    return `=== SHEET: ${name} ===\n${csv}`;
  });
  return { text: sections.join("\n\n"), sheets: wb.SheetNames };
}

export function loadPrompt(agentsRoot, relPath) {
  return fs.readFileSync(path.join(agentsRoot, relPath), "utf8");
}

export function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

export function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}
