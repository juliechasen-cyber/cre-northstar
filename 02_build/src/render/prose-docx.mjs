import fs from "node:fs";
import Jimp from "jimp";
import {
  AlignmentType, BorderStyle, Document, ImageRun, Packer, Paragraph, ShadingType,
  Table, TableCell, TableRow, TextRun, WidthType,
} from "docx";
import { NAVY, CHARCOAL, LIME, GRAY, MIST, HEAD_FONT, BODY_FONT } from "./brand.mjs";

const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

export const head = (text, size, opts = {}) =>
  new TextRun({ text, font: HEAD_FONT, color: NAVY, size, bold: true, ...opts });
export const body = (text, opts = {}) =>
  new TextRun({ text, font: BODY_FONT, color: CHARCOAL, size: 22, ...opts });

export function kvTable(rows, { boldMatch } = {}) {
  const cell = (children, alignRight = false, shaded = false) =>
    new TableCell({
      borders: { ...noBorders, bottom: { style: BorderStyle.SINGLE, size: 4, color: GRAY } },
      shading: shaded ? { type: ShadingType.CLEAR, fill: MIST } : undefined,
      margins: { top: 40, bottom: 40, left: 80, right: 80 },
      children: [
        new Paragraph({
          alignment: alignRight ? AlignmentType.RIGHT : AlignmentType.LEFT,
          children,
        }),
      ],
    });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders,
    rows: rows.map((r, i) => {
      const bold = boldMatch ? boldMatch.test(r.label) : false;
      const shaded = i % 2 === 1;
      return new TableRow({
        children: [
          cell([body(r.label, { bold })], false, shaded),
          cell([body(r.value, { bold })], true, shaded),
        ],
      });
    }),
  });
}

// Generic sectioned prose document — executive memo, press release.
// spec: { docTitle, subtitle?, meta?, sections: [{ heading?, paragraphs?: [],
//         bullets?: [], table?: { caption?, rows: [{label, value}] } }], footerLines? }
// opts.heroImagePath: property photo placed above the title, full column width.
export async function renderProseDocx(spec, outPath, { heroImagePath } = {}) {
  const children = [];
  if (heroImagePath && fs.existsSync(heroImagePath)) {
    const img = await Jimp.read(heroImagePath);
    const w = 620; // usable column width in px at 96dpi (8.5in page, 1100-twip margins)
    const h = Math.round((w * img.bitmap.height) / img.bitmap.width);
    children.push(
      new Paragraph({
        spacing: { after: 160 },
        children: [
          new ImageRun({ type: "jpg", data: fs.readFileSync(heroImagePath), transformation: { width: w, height: h } }),
        ],
      })
    );
  }
  children.push(new Paragraph({ spacing: { after: 40 }, children: [head(spec.docTitle, 34)] }));
  if (spec.subtitle)
    children.push(new Paragraph({ spacing: { after: 60 }, children: [body(spec.subtitle, { size: 22 })] }));
  if (spec.meta)
    children.push(
      new Paragraph({
        spacing: { after: 160 },
        children: [body(spec.meta.toUpperCase(), { size: 16, color: NAVY, bold: true })],
      })
    );

  for (const s of spec.sections ?? []) {
    if (s.heading)
      children.push(
        new Paragraph({
          spacing: { before: 240, after: 100 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: LIME } },
          children: [head(s.heading.toUpperCase(), 22)],
        })
      );
    for (const p of s.paragraphs ?? [])
      children.push(new Paragraph({ spacing: { after: 120 }, children: [body(p)] }));
    for (const b of s.bullets ?? [])
      children.push(new Paragraph({ bullet: { level: 0 }, children: [body(b)] }));
    if (s.table?.rows?.length) {
      if (s.table.caption)
        children.push(
          new Paragraph({
            spacing: { after: 60 },
            children: [body(s.table.caption, { size: 17, italics: true })],
          })
        );
      children.push(kvTable(s.table.rows, { boldMatch: /net operating income/i }));
    }
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
