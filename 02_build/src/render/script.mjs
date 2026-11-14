import fs from "node:fs";
import {
  BorderStyle, Document, Packer, Paragraph, ShadingType,
  Table, TableCell, TableRow, WidthType,
} from "docx";
import { NAVY, CHARCOAL, LIME, TEAL, GRAY, MIST, HEAD_FONT, BODY_FONT, headStack, bodyStack } from "./brand.mjs";
import { head, body } from "./prose-docx.mjs";

// Investor call script — docx for download, html for reading in the browser.
// spec: { docTitle, subtitle?, meta?, sections: [{ heading, coach?, say: [] }],
//         objections?: [{ objection, response }], voicemail?: [], footerLines? }

const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

export async function renderScriptDocx(spec, outPath) {
  const children = [];
  children.push(new Paragraph({ spacing: { after: 40 }, children: [head(spec.docTitle, 34)] }));
  if (spec.subtitle)
    children.push(new Paragraph({ spacing: { after: 60 }, children: [body(spec.subtitle)] }));
  if (spec.meta)
    children.push(
      new Paragraph({
        spacing: { after: 160 },
        children: [body(spec.meta.toUpperCase(), { size: 16, color: NAVY, bold: true })],
      })
    );

  for (const s of spec.sections ?? []) {
    children.push(
      new Paragraph({
        spacing: { before: 240, after: 80 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: LIME } },
        children: [head(String(s.heading ?? "").toUpperCase(), 22)],
      })
    );
    if (s.coach)
      children.push(
        new Paragraph({
          spacing: { after: 100 },
          children: [body(s.coach, { size: 18, color: TEAL, italics: true })],
        })
      );
    // Verbatim lines — indented so the eye can follow them mid-call.
    for (const line of s.say ?? [])
      children.push(
        new Paragraph({
          spacing: { after: 110 },
          indent: { left: 260 },
          border: { left: { style: BorderStyle.SINGLE, size: 10, color: MIST } },
          children: [body(line)],
        })
      );
  }

  if (spec.objections?.length) {
    children.push(
      new Paragraph({
        spacing: { before: 260, after: 80 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: LIME } },
        children: [head("IF YOU HEAR…", 22)],
      })
    );
    const cell = (children, { header = false, shaded = false, width } = {}) =>
      new TableCell({
        borders: { ...noBorders, bottom: { style: BorderStyle.SINGLE, size: 4, color: GRAY } },
        shading: header
          ? { type: ShadingType.CLEAR, fill: NAVY }
          : shaded ? { type: ShadingType.CLEAR, fill: MIST } : undefined,
        margins: { top: 60, bottom: 60, left: 90, right: 90 },
        width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
        children: [new Paragraph({ children })],
      });
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorders,
        rows: [
          new TableRow({
            children: [
              cell([body("Objection", { color: "FFFFFF", bold: true, size: 19 })], { header: true, width: 34 }),
              cell([body("Your response", { color: "FFFFFF", bold: true, size: 19 })], { header: true, width: 66 }),
            ],
          }),
          ...spec.objections.map(
            (o, i) =>
              new TableRow({
                children: [
                  cell([body(o.objection, { bold: true })], { shaded: i % 2 === 1, width: 34 }),
                  cell([body(o.response)], { shaded: i % 2 === 1, width: 66 }),
                ],
              })
          ),
        ],
      })
    );
  }

  if (spec.voicemail?.length) {
    children.push(
      new Paragraph({
        spacing: { before: 260, after: 80 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: LIME } },
        children: [head("VOICEMAIL — 30 SECONDS", 22)],
      })
    );
    for (const line of spec.voicemail)
      children.push(
        new Paragraph({
          spacing: { after: 110 },
          indent: { left: 260 },
          border: { left: { style: BorderStyle.SINGLE, size: 10, color: MIST } },
          children: [body(line)],
        })
      );
  }

  if (spec.footerLines?.length) {
    children.push(
      new Paragraph({
        spacing: { before: 280 },
        border: { top: { style: BorderStyle.SINGLE, size: 6, color: NAVY } },
        children: [],
      })
    );
    spec.footerLines.forEach((line, i) =>
      children.push(new Paragraph({ children: [body(line, { bold: i === 0, size: 20 })] }))
    );
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: BODY_FONT, size: 22, color: CHARCOAL } } } },
    sections: [
      { properties: { page: { margin: { top: 900, bottom: 900, left: 1100, right: 1100 } } }, children },
    ],
  });
  fs.writeFileSync(outPath, await Packer.toBuffer(doc));
}

const esc = (s) =>
  String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

export function renderScriptHtml(spec, outPath) {
  const sections = (spec.sections ?? [])
    .map(
      (s) => `<h2>${esc(s.heading ?? "")}</h2>
${s.coach ? `<p class="coach">${esc(s.coach)}</p>` : ""}
${(s.say ?? []).map((l) => `<p class="say">${esc(l)}</p>`).join("\n")}`
    )
    .join("\n");
  const objections = spec.objections?.length
    ? `<h2>If you hear…</h2><table><thead><tr><th>Objection</th><th>Your response</th></tr></thead><tbody>${spec.objections
        .map((o) => `<tr><td class="obj">${esc(o.objection)}</td><td>${esc(o.response)}</td></tr>`)
        .join("")}</tbody></table>`
    : "";
  const voicemail = spec.voicemail?.length
    ? `<h2>Voicemail — 30 seconds</h2>${spec.voicemail.map((l) => `<p class="say">${esc(l)}</p>`).join("")}`
    : "";

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(spec.docTitle)}</title>
<style>
  :root { --navy:#${NAVY}; --charcoal:#${CHARCOAL}; --lime:#${LIME}; --teal:#${TEAL}; --gray:#${GRAY}; --mist:#${MIST}; }
  body { font-family: ${bodyStack()}; color: var(--charcoal); max-width: 8in; margin: 32px auto; padding: 0 24px; font-size: 11pt; line-height: 1.5; }
  h1 { font-family: ${headStack()}; color: var(--navy); font-size: 22pt; margin: 0; }
  .sub { font-size: 11pt; } .meta { color: var(--navy); font-weight: 700; font-size: 8.5pt; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 16px; }
  h2 { font-family: ${headStack()}; color: var(--navy); font-size: 11.5pt; text-transform: uppercase; letter-spacing: .04em; border-bottom: 2px solid var(--lime); padding-bottom: 3px; margin: 22px 0 8px; }
  .coach { color: var(--teal); font-style: italic; font-size: 9.5pt; margin: 0 0 8px; }
  .say { border-left: 3px solid var(--mist); padding: 2px 0 2px 14px; margin: 0 0 10px; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 7px 10px; border-bottom: 1px solid var(--gray); text-align: left; vertical-align: top; }
  th { background: var(--navy); color: #fff; font-size: 9.5pt; border: none; }
  td.obj { font-weight: 700; width: 34%; }
  tbody tr:nth-child(even) td { background: var(--mist); }
  footer { border-top: 2px solid var(--navy); margin-top: 26px; padding-top: 8px; font-size: 10pt; }
  footer .first { font-weight: 700; }
  @media print { body { margin: 0 auto; } }
</style></head><body>
<h1>${esc(spec.docTitle)}</h1>
${spec.subtitle ? `<div class="sub">${esc(spec.subtitle)}</div>` : ""}
${spec.meta ? `<div class="meta">${esc(spec.meta)}</div>` : ""}
${sections}
${objections}
${voicemail}
${spec.footerLines?.length ? `<footer>${spec.footerLines.map((l, i) => `<div${i === 0 ? ' class="first"' : ""}>${esc(l)}</div>`).join("")}</footer>` : ""}
</body></html>`;
  fs.writeFileSync(outPath, html);
}
