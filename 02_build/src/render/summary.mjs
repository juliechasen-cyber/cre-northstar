import fs from "node:fs";
import {
  AlignmentType, BorderStyle, Document, Packer, Paragraph, ShadingType,
  Table, TableCell, TableRow, TextRun, WidthType,
} from "docx";

import { NAVY, CHARCOAL, LIME, GRAY, MIST, HEAD_FONT, BODY_FONT } from "./brand.mjs";

const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

function head(text, size) {
  return new TextRun({ text, font: HEAD_FONT, color: NAVY, size, bold: true });
}
function body(text, opts = {}) {
  return new TextRun({ text, font: BODY_FONT, color: CHARCOAL, size: 21, ...opts });
}

function sectionTitle(text) {
  return new Paragraph({
    spacing: { before: 220, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: LIME } },
    children: [head(text.toUpperCase(), 22)],
  });
}

function statTile(stat) {
  return new TableCell({
    borders: { ...noBorders, top: { style: BorderStyle.SINGLE, size: 12, color: LIME } },
    shading: { type: ShadingType.CLEAR, fill: MIST },
    margins: { top: 90, bottom: 90, left: 110, right: 110 },
    children: [
      new Paragraph({
        children: [body(stat.label.toUpperCase(), { size: 15, color: CHARCOAL, bold: true })],
      }),
      new Paragraph({ children: [head(stat.value, 26)] }),
    ],
  });
}

function kvRow(label, value, { shaded = false, bold = false } = {}) {
  const shading = shaded ? { type: ShadingType.CLEAR, fill: MIST } : undefined;
  const cell = (children, alignRight = false) =>
    new TableCell({
      borders: { ...noBorders, bottom: { style: BorderStyle.SINGLE, size: 4, color: GRAY } },
      shading,
      margins: { top: 40, bottom: 40, left: 80, right: 80 },
      children: [
        new Paragraph({
          alignment: alignRight ? AlignmentType.RIGHT : AlignmentType.LEFT,
          children,
        }),
      ],
    });
  return new TableRow({ children: [cell([body(label, { bold })]), cell([body(value, { bold })], true)] });
}

function headerCell(text) {
  return new TableCell({
    borders: noBorders,
    shading: { type: ShadingType.CLEAR, fill: NAVY },
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
    children: [new Paragraph({ children: [body(text, { color: "FFFFFF", bold: true, size: 19 })] })],
  });
}

function mixCell(text, alignRight) {
  return new TableCell({
    borders: { ...noBorders, bottom: { style: BorderStyle.SINGLE, size: 4, color: GRAY } },
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [
      new Paragraph({
        alignment: alignRight ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: [body(text ?? "—", { size: 19 })],
      }),
    ],
  });
}

export async function renderDocx(spec, outPath) {
  const children = [];

  // Header
  children.push(new Paragraph({ children: [head(spec.header.propertyName, 44)] }));
  if (spec.header.addressLine)
    children.push(new Paragraph({ children: [body(spec.header.addressLine, { size: 22 })] }));
  if (spec.header.subline)
    children.push(
      new Paragraph({
        spacing: { after: 160 },
        children: [body(spec.header.subline.toUpperCase(), { size: 17, color: NAVY, bold: true })],
      })
    );

  // Hero stats
  if (spec.heroStats?.length) {
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorders,
        rows: [new TableRow({ children: spec.heroStats.map(statTile) })],
      })
    );
  }

  // Opportunity
  if (spec.opportunity) {
    children.push(sectionTitle("The Opportunity"));
    children.push(new Paragraph({ children: [body(spec.opportunity)] }));
  }

  // Financial snapshot
  if (spec.financialSnapshot?.rows?.length) {
    children.push(sectionTitle("Financial Snapshot"));
    if (spec.financialSnapshot.periodLabel)
      children.push(
        new Paragraph({
          spacing: { after: 60 },
          children: [body(spec.financialSnapshot.periodLabel, { size: 17, color: CHARCOAL, italics: true })],
        })
      );
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorders,
        rows: spec.financialSnapshot.rows.map((r, i) =>
          kvRow(r.label, r.value, {
            shaded: i % 2 === 1,
            bold: /net operating income/i.test(r.label),
          })
        ),
      })
    );
  }

  // Unit mix
  if (spec.unitMix?.length) {
    children.push(sectionTitle("Unit Mix"));
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorders,
        rows: [
          new TableRow({
            children: ["Type", "Units", "Avg SF", "In-Place Rent", "Market Rent"].map(headerCell),
          }),
          ...spec.unitMix.map(
            (u) =>
              new TableRow({
                children: [
                  mixCell(u.type, false),
                  mixCell(String(u.count), true),
                  mixCell(u.avgSf, true),
                  mixCell(u.inPlaceRent, true),
                  mixCell(u.marketRent, true),
                ],
              })
          ),
        ],
      })
    );
  }

  // Highlights
  if (spec.highlights?.length) {
    children.push(sectionTitle("Highlights"));
    for (const h of spec.highlights)
      children.push(new Paragraph({ bullet: { level: 0 }, children: [body(h)] }));
  }

  // Footer
  if (spec.footer) {
    children.push(
      new Paragraph({
        spacing: { before: 260 },
        border: { top: { style: BorderStyle.SINGLE, size: 6, color: NAVY } },
        children: [],
      })
    );
    if (spec.footer.brokerLine)
      children.push(new Paragraph({ children: [body(spec.footer.brokerLine, { bold: true })] }));
    if (spec.footer.contactLine)
      children.push(new Paragraph({ children: [body(spec.footer.contactLine, { size: 19 })] }));
    if (spec.footer.deadlineLine)
      children.push(
        new Paragraph({
          spacing: { before: 60 },
          children: [body(spec.footer.deadlineLine, { bold: true, color: NAVY })],
        })
      );
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: BODY_FONT, size: 21, color: CHARCOAL } } } },
    sections: [
      {
        properties: {
          page: { margin: { top: 700, bottom: 700, left: 850, right: 850 } },
        },
        children,
      },
    ],
  });
  fs.writeFileSync(outPath, await Packer.toBuffer(doc));
}

const esc = (s) =>
  String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

export function renderHtml(spec, outPath) {
  const stats = (spec.heroStats ?? [])
    .map(
      (s) =>
        `<div class="tile"><div class="tl">${esc(s.label)}</div><div class="tv">${esc(s.value)}</div></div>`
    )
    .join("");
  const finRows = (spec.financialSnapshot?.rows ?? [])
    .map((r) => `<tr><td>${esc(r.label)}</td><td class="num">${esc(r.value)}</td></tr>`)
    .join("");
  const mixRows = (spec.unitMix ?? [])
    .map(
      (u) =>
        `<tr><td>${esc(u.type)}</td><td class="num">${esc(u.count)}</td><td class="num">${esc(u.avgSf ?? "—")}</td><td class="num">${esc(u.inPlaceRent ?? "—")}</td><td class="num">${esc(u.marketRent ?? "—")}</td></tr>`
    )
    .join("");
  const bullets = (spec.highlights ?? []).map((h) => `<li>${esc(h)}</li>`).join("");

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(spec.docTitle)}</title>
<style>
  :root { --navy:#344754; --charcoal:#424143; --lime:#8cc040; --gray:#bcbec0; --mist:#eaedf2; }
  body { font-family: Calibri, "Segoe UI", sans-serif; color: var(--charcoal); max-width: 8in; margin: 32px auto; padding: 0 24px; font-size: 10.5pt; }
  h1 { font-family: Georgia, serif; color: var(--navy); font-size: 22pt; margin: 0; }
  .addr { font-size: 11pt; } .sub { color: var(--navy); font-weight: 700; font-size: 8.5pt; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 14px; }
  h2 { font-family: Georgia, serif; color: var(--navy); font-size: 11pt; text-transform: uppercase; letter-spacing: .04em; border-bottom: 2px solid var(--lime); padding-bottom: 3px; margin: 18px 0 8px; }
  .tiles { display: flex; gap: 8px; }
  .tile { flex: 1; background: var(--mist); border-top: 3px solid var(--lime); padding: 8px 10px; }
  .tl { font-size: 7.5pt; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
  .tv { font-family: Georgia, serif; color: var(--navy); font-size: 13pt; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 4px 8px; border-bottom: 1px solid var(--gray); text-align: left; }
  th { background: var(--navy); color: #fff; font-size: 9.5pt; border: none; }
  .num { text-align: right; }
  tbody tr:nth-child(even) td { background: var(--mist); }
  .period { font-style: italic; font-size: 8.5pt; margin: 0 0 4px; }
  ul { margin: 4px 0 0 18px; padding: 0; } li { margin-bottom: 3px; }
  footer { border-top: 2px solid var(--navy); margin-top: 22px; padding-top: 8px; }
  .broker { font-weight: 700; } .deadline { color: var(--navy); font-weight: 700; margin-top: 4px; }
  @media print { body { margin: 0 auto; } }
</style></head><body>
<h1>${esc(spec.header.propertyName)}</h1>
${spec.header.addressLine ? `<div class="addr">${esc(spec.header.addressLine)}</div>` : ""}
${spec.header.subline ? `<div class="sub">${esc(spec.header.subline)}</div>` : ""}
${stats ? `<div class="tiles">${stats}</div>` : ""}
${spec.opportunity ? `<h2>The Opportunity</h2><p>${esc(spec.opportunity)}</p>` : ""}
${finRows ? `<h2>Financial Snapshot</h2>${spec.financialSnapshot.periodLabel ? `<p class="period">${esc(spec.financialSnapshot.periodLabel)}</p>` : ""}<table><tbody>${finRows}</tbody></table>` : ""}
${mixRows ? `<h2>Unit Mix</h2><table><thead><tr><th>Type</th><th class="num">Units</th><th class="num">Avg SF</th><th class="num">In-Place Rent</th><th class="num">Market Rent</th></tr></thead><tbody>${mixRows}</tbody></table>` : ""}
${bullets ? `<h2>Highlights</h2><ul>${bullets}</ul>` : ""}
${spec.footer ? `<footer>${spec.footer.brokerLine ? `<div class="broker">${esc(spec.footer.brokerLine)}</div>` : ""}${spec.footer.contactLine ? `<div>${esc(spec.footer.contactLine)}</div>` : ""}${spec.footer.deadlineLine ? `<div class="deadline">${esc(spec.footer.deadlineLine)}</div>` : ""}</footer>` : ""}
</body></html>`;
  fs.writeFileSync(outPath, html);
}
