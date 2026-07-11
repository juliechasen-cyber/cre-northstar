import PptxGenJS from "pptxgenjs";
import { NAVY, CHARCOAL, LIME, TEAL, GRAY, MIST, OFFWHITE, HEAD_FONT, BODY_FONT } from "./brand.mjs";

// Slide-spec JSON → .pptx. The template (colors, type, placement) lives
// here; the model only supplies content slots per layout (pptx-om.md).
// 16:9, 13.33 × 7.5 in.

const W = 13.33;
const H = 7.5;
const MX = 0.7; // side margin

function chrome(slide, pptx, { title, footerText }) {
  if (title) {
    slide.addText(title, {
      x: MX, y: 0.42, w: W - 2 * MX, h: 0.6,
      fontFace: HEAD_FONT, fontSize: 26, color: NAVY, bold: true,
    });
    slide.addShape(pptx.ShapeType.rect, { x: MX, y: 1.06, w: 1.2, h: 0.045, fill: { color: LIME }, line: { type: "none" } });
  }
  if (footerText)
    slide.addText(footerText, {
      x: MX, y: H - 0.42, w: W - 2 * MX, h: 0.3,
      fontFace: BODY_FONT, fontSize: 9, color: GRAY,
    });
}

function statTiles(slide, stats, y) {
  const gap = 0.18;
  const n = Math.min(stats.length, 5);
  const w = (W - 2 * MX - gap * (n - 1)) / n;
  stats.slice(0, 5).forEach((s, i) => {
    const x = MX + i * (w + gap);
    slide.addShape("rect", { x, y, w, h: 1.15, fill: { color: MIST }, line: { type: "none" } });
    slide.addShape("rect", { x, y, w, h: 0.05, fill: { color: LIME }, line: { type: "none" } });
    slide.addText(s.label.toUpperCase(), { x: x + 0.08, y: y + 0.12, w: w - 0.16, h: 0.3, fontFace: BODY_FONT, fontSize: 9, bold: true, color: CHARCOAL });
    slide.addText(s.value, { x: x + 0.08, y: y + 0.4, w: w - 0.16, h: 0.62, fontFace: HEAD_FONT, fontSize: 20, bold: true, color: NAVY });
  });
}

function specTable(slide, rows, { x = MX, y, w = W - 2 * MX, header, boldMatch }) {
  const tableRows = [];
  if (header)
    tableRows.push(
      header.map((h) => ({
        text: h,
        options: { fill: { color: NAVY }, color: "FFFFFF", bold: true, fontFace: BODY_FONT, fontSize: 12 },
      }))
    );
  for (const r of rows) {
    const cells = Array.isArray(r) ? r : [r.label, r.value];
    const bold = boldMatch ? boldMatch.test(String(cells[0])) : false;
    tableRows.push(
      cells.map((c, ci) => ({
        text: String(c ?? "—"),
        options: { fontFace: BODY_FONT, fontSize: 12.5, color: CHARCOAL, bold, align: ci === 0 ? "left" : "right" },
      }))
    );
  }
  slide.addTable(tableRows, {
    x, y, w,
    border: { type: "solid", color: MIST, pt: 0.75 },
    rowH: 0.32,
    valign: "middle",
  });
}

const LAYOUTS = {
  cover(pptx, slide, s) {
    slide.background = { color: NAVY };
    if (s._heroPath) {
      // full-bleed property photo under a translucent brand wash — text stays readable
      slide.addImage({ path: s._heroPath, x: 0, y: 0, w: W, h: H, sizing: { type: "cover", w: W, h: H } });
      slide.addShape("rect", { x: 0, y: 0, w: W, h: H, fill: { color: NAVY, transparency: 28 }, line: { type: "none" } });
    }
    slide.addShape("rect", { x: 0, y: 4.62, w: W, h: 0.06, fill: { color: LIME }, line: { type: "none" } });
    slide.addText("OFFERING MEMORANDUM", { x: MX, y: 1.5, w: W - 2 * MX, h: 0.4, fontFace: BODY_FONT, fontSize: 15, color: TEAL, charSpacing: 4 });
    slide.addText(s.propertyName ?? "", { x: MX, y: 2.1, w: W - 2 * MX, h: 1.3, fontFace: HEAD_FONT, fontSize: 44, bold: true, color: "FFFFFF" });
    if (s.addressLine) slide.addText(s.addressLine, { x: MX, y: 3.5, w: W - 2 * MX, h: 0.4, fontFace: BODY_FONT, fontSize: 17, color: OFFWHITE });
    if (s.positioning) slide.addText(s.positioning, { x: MX, y: 3.95, w: W - 2 * MX, h: 0.45, fontFace: BODY_FONT, fontSize: 14, italic: true, color: TEAL });
    const firm = [s.brokerName, s.brokerFirm, s.brokerContactLine].filter(Boolean).join("\n");
    if (firm) slide.addText(firm, { x: MX, y: 5.2, w: W - 2 * MX, h: 1.2, fontFace: BODY_FONT, fontSize: 13, color: OFFWHITE, lineSpacing: 20 });
  },
  "exec-summary"(pptx, slide, s) {
    chrome(slide, pptx, { title: "Executive Summary", footerText: s._footer });
    if (s.heroStats?.length) statTiles(slide, s.heroStats, 1.35);
    if (s.opportunity)
      slide.addText(s.opportunity, { x: MX, y: 2.85, w: W - 2 * MX, h: 2.2, fontFace: BODY_FONT, fontSize: 15, color: CHARCOAL, lineSpacing: 24, valign: "top" });
    if (s.highlights?.length)
      slide.addText(s.highlights.map((h) => ({ text: h, options: { bullet: { code: "2022" }, color: CHARCOAL } })), {
        x: MX, y: 4.6, w: W - 2 * MX, h: 2.4, fontFace: BODY_FONT, fontSize: 13.5, lineSpacing: 22, valign: "top",
      });
  },
  "property-overview"(pptx, slide, s) {
    chrome(slide, pptx, { title: "Property Overview", footerText: s._footer });
    if (s.description)
      slide.addText(s.description, { x: MX, y: 1.4, w: 6.6, h: 4.8, fontFace: BODY_FONT, fontSize: 14, color: CHARCOAL, lineSpacing: 23, valign: "top" });
    if (s.facts?.length) specTable(slide, s.facts, { x: 7.7, y: 1.4, w: W - 7.7 - MX });
  },
  "location-market"(pptx, slide, s) {
    chrome(slide, pptx, { title: "Location & Market", footerText: s._footer });
    if (s.subline)
      slide.addText(s.subline, { x: MX, y: 1.3, w: W - 2 * MX, h: 0.35, fontFace: BODY_FONT, fontSize: 13, bold: true, color: NAVY });
    if (s.narrative)
      slide.addText(s.narrative, { x: MX, y: 1.75, w: W - 2 * MX, h: 2.4, fontFace: BODY_FONT, fontSize: 14, color: CHARCOAL, lineSpacing: 23, valign: "top" });
    if (s.comps?.length) {
      slide.addText("Comparable Sales", { x: MX, y: 4.35, w: 5, h: 0.35, fontFace: HEAD_FONT, fontSize: 15, bold: true, color: NAVY });
      specTable(slide, s.comps.map((c) => [c.name, c.detail]), { y: 4.8 });
    }
  },
  "financial-summary"(pptx, slide, s) {
    chrome(slide, pptx, { title: "Financial Summary", footerText: s._footer });
    if (s.periodLabel)
      slide.addText(s.periodLabel, { x: MX, y: 1.3, w: W - 2 * MX, h: 0.32, fontFace: BODY_FONT, fontSize: 12, italic: true, color: CHARCOAL });
    if (s.rows?.length)
      specTable(slide, s.rows, { y: 1.75, w: 8.5, boldMatch: /net operating income/i });
    if (s.note)
      slide.addText(s.note, { x: 9.4, y: 1.75, w: W - 9.4 - MX, h: 3, fontFace: BODY_FONT, fontSize: 12, color: CHARCOAL, lineSpacing: 20, valign: "top" });
  },
  "unit-mix"(pptx, slide, s) {
    chrome(slide, pptx, { title: "Unit Mix", footerText: s._footer });
    if (s.rows?.length)
      specTable(slide, s.rows.map((u) => [u.type, u.count, u.avgSf, u.inPlaceRent, u.marketRent]), {
        y: 1.45, header: ["Type", "Units", "Avg SF", "In-Place Rent", "Market Rent"],
      });
    if (s.callout) {
      const y = 1.45 + 0.42 * ((s.rows?.length ?? 0) + 1) + 0.5;
      slide.addShape("rect", { x: MX, y, w: W - 2 * MX, h: 0.85, fill: { color: MIST }, line: { type: "none" } });
      slide.addShape("rect", { x: MX, y, w: 0.07, h: 0.85, fill: { color: LIME }, line: { type: "none" } });
      slide.addText(s.callout, { x: MX + 0.25, y: y + 0.1, w: W - 2 * MX - 0.5, h: 0.65, fontFace: BODY_FONT, fontSize: 14, color: NAVY, bold: true, valign: "middle" });
    }
  },
  "rent-roll-summary"(pptx, slide, s) {
    chrome(slide, pptx, { title: "Rent Roll Summary", footerText: s._footer });
    if (s.rows?.length) specTable(slide, s.rows, { y: 1.45, w: 8.5 });
    if (s.note)
      slide.addText(s.note, { x: 9.4, y: 1.45, w: W - 9.4 - MX, h: 3.5, fontFace: BODY_FONT, fontSize: 12, color: CHARCOAL, lineSpacing: 20, valign: "top" });
  },
  "process-contact"(pptx, slide, s) {
    slide.background = { color: NAVY };
    slide.addText("Offer Process", { x: MX, y: 0.9, w: W - 2 * MX, h: 0.5, fontFace: HEAD_FONT, fontSize: 26, bold: true, color: "FFFFFF" });
    slide.addShape("rect", { x: MX, y: 1.5, w: 1.2, h: 0.045, fill: { color: LIME }, line: { type: "none" } });
    if (s.processText)
      slide.addText(s.processText, { x: MX, y: 1.8, w: 7.4, h: 2.6, fontFace: BODY_FONT, fontSize: 15, color: OFFWHITE, lineSpacing: 25, valign: "top" });
    if (s.deadlineLine)
      slide.addText(s.deadlineLine, { x: MX, y: 4.0, w: 7.4, h: 0.5, fontFace: HEAD_FONT, fontSize: 19, bold: true, color: LIME });
    const contact = [s.brokerName, s.brokerFirm, s.brokerContactLine, s.licenseLine].filter(Boolean).join("\n");
    if (contact) {
      slide.addShape("rect", { x: 8.7, y: 1.8, w: W - 8.7 - MX, h: 2.7, fill: { color: "FFFFFF" }, line: { type: "none" } });
      slide.addShape("rect", { x: 8.7, y: 1.8, w: W - 8.7 - MX, h: 0.06, fill: { color: LIME }, line: { type: "none" } });
      slide.addText("EXCLUSIVE LISTING BROKER", { x: 8.95, y: 2.0, w: 3.6, h: 0.3, fontFace: BODY_FONT, fontSize: 10, bold: true, color: CHARCOAL, charSpacing: 2 });
      slide.addText(contact, { x: 8.95, y: 2.35, w: 3.6, h: 1.9, fontFace: BODY_FONT, fontSize: 13, color: NAVY, lineSpacing: 22, valign: "top" });
    }
    if (s.disclaimer)
      slide.addText(s.disclaimer, { x: MX, y: H - 1.15, w: W - 2 * MX, h: 0.9, fontFace: BODY_FONT, fontSize: 8.5, color: GRAY, lineSpacing: 12 });
  },
};

export async function renderPptx(spec, outPath, { heroPath } = {}) {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE", width: W, height: H });
  pptx.layout = "WIDE";
  const footer = spec.footerText ?? "";
  let skipped = 0;
  for (const s of spec.slides ?? []) {
    const fn = LAYOUTS[s.layout];
    if (!fn) { skipped++; continue; }
    const slide = pptx.addSlide();
    fn(pptx, slide, { ...s, _footer: footer, _heroPath: heroPath });
  }
  await pptx.writeFile({ fileName: outPath });
  return { slides: (spec.slides ?? []).length - skipped, skipped };
}
