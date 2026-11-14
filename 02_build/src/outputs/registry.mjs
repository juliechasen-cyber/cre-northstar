import fs from "node:fs";
import path from "node:path";
import { renderDocx as renderSummaryDocx, renderHtml as renderSummaryHtml } from "../render/summary.mjs";
import { renderProseDocx } from "../render/prose-docx.mjs";
import { renderLinkedInImages } from "../render/linkedin-image.mjs";
import { renderScriptDocx, renderScriptHtml } from "../render/script.mjs";
import { renderDrip, renderListing, renderCalendar } from "../render/campaign.mjs";
import { renderPptx } from "../render/pptx.mjs";
import { renderWebsite } from "../render/website.mjs";
import { renderChecklistXlsx } from "../render/sheets.mjs";
import { conformToSchema, validateAgainst } from "../lib/validate.mjs";
import { writeJson } from "../lib/files.mjs";

// One entry per output. `contract` is appended to _shared-rules + the
// generator's own .md prompt; `render` turns the returned content spec into
// the broker-facing files. ctx: { dealId, outDir, dealFacts, marketingFacts,
// manifest, assetLinks }.
//
// Editing model (ARCHITECTURE.md): the .spec.json is the editable source of
// truth; every file here re-renders from it on demand.

const KV = `Rows are { "label": "...", "value": "..." } with pre-formatted display strings.`;

export const REGISTRY = {
  "investment-summary": {
    prompt: "outputs/investment-summary.md",
    internal: false,
    contract: `
## Output contract (harness)

Return one JSON object — the investment-summary content spec:

{
  "docTitle": "<property name> — Investment Summary",
  "header": { "propertyName": "…", "addressLine": "street, city, state zip", "subline": "property type · N units · built YYYY" },
  "heroStats": [ { "label": "Asking Price", "value": "$12,500,000" } ],   // 3–5 tiles
  "opportunity": "<2–3 sentences>",
  "financialSnapshot": { "periodLabel": "Trailing 12 months, <start> – <end>", "rows": [ { "label": "Net Operating Income", "value": "$1,234,567" } ] },
  "unitMix": [ { "type": "2BR/2BA", "count": 48, "avgSf": "1,050", "inPlaceRent": "$1,850", "marketRent": "$1,995" } ],
  "highlights": [ "<bullet, ≤ 12 words>" ],
  "footer": { "brokerLine": "Name · Firm", "contactLine": "phone · email · Lic. #…", "deadlineLine": "Offers due Month D, YYYY" }
}

All values are pre-formatted display strings per the formatting defaults.
Omit any key (or row, or tile) whose value is not in deal-facts — render
less, never pad.`,
    async render(spec, ctx) {
      const docx = path.join(ctx.outDir, "investment-summary.docx");
      const html = path.join(ctx.outDir, "investment-summary.html");
      await renderSummaryDocx(spec, docx);
      renderSummaryHtml(spec, html);
      return [docx, html];
    },
  },

  "executive-memo": {
    prompt: "outputs/executive-memo.md",
    internal: false,
    contract: `
## Output contract (harness)

Return one JSON object — a sectioned prose spec:

{
  "docTitle": "<property name> — Executive Memo",
  "subtitle": "street, city, state zip",
  "meta": "Prepared <Month D, YYYY> · Confidential",
  "sections": [
    { "heading": "…", "paragraphs": ["…"] },
    { "heading": "Financial Performance", "paragraphs": ["…"],
      "table": { "caption": "Trailing 12 months, <start> – <end>", "rows": [ { "label": "…", "value": "…" } ] } }
  ],
  "footerLines": [ "Name · Firm", "phone · email · Lic. #…" ]
}

600–900 words of prose across the sections given in your instructions.
${KV} Drop empty sections entirely.`,
    async render(spec, ctx) {
      const out = path.join(ctx.outDir, "executive-memo.docx");
      await renderProseDocx(spec, out);
      return [out];
    },
  },

  "linkedin-announcement": {
    prompt: "outputs/linkedin-announcement.md",
    internal: false,
    contract: `
## Output contract (harness)

Return one JSON object:

{
  "post": "<full post text, line breaks as \\n, hashtags on the final line>",
  "characterCount": <int>,
  "suggestedImage": "<media.heroPhotoId>",  // omit if no photos in deal-facts
  "imageCard": {                            // copy printed ON the share image — keep it minimal
    "kicker": "<"OFFERS DUE <MONTH D>" when deal-facts has a deadline, else "NOW ON MARKET">",
    "headline": "<property name, ≤ 40 chars — e.g. "Tara Oceanside Apartment Homes">",
    "subline": "<type · N units · city, state — e.g. "Multifamily · 62 Units · Oceanside, CA">",
    "stats": [ { "label": "Asking Price", "value": "$10,900,000" }, { "label": "Cap Rate", "value": "6.33%" } ],
    "brokerLine": "Name · Firm"
  }
}

imageCard: asking price is ALWAYS the first stat when priced (unpriced deals
lead with the strongest approved number); at most one more proof number.
Values come from deal-facts only; omit any key whose facts aren't there.
The harness renders the card in the deal's own brand with the broker's
extracted logo (never CRE Northstar's) at 1200×627, 1080×1080, and
1080×1920.`,
    async render(spec, ctx) {
      const out = path.join(ctx.outDir, "linkedin-announcement.txt");
      fs.writeFileSync(out, spec.post + "\n");
      const images = await renderLinkedInImages(spec.imageCard, ctx);
      return [out, ...images];
    },
  },

  "sales-script": {
    prompt: "outputs/sales-script.md",
    internal: true, // broker's own call sheet — never in the marketing export
    contract: `
## Output contract (harness)

Return one JSON object — the call-script spec:

{
  "docTitle": "<property name> — Investor Call Script",
  "subtitle": "<property type · N units · city, state>",
  "meta": "Internal — broker use only",
  "sections": [
    { "heading": "Opening — 15 seconds",
      "coach": "<≤ 15 words — delivery note, italic on the page>",
      "say": ["<verbatim line the broker reads aloud>", "…"] }
  ],
  "objections": [ { "objection": "\\"Just send me the OM.\\"", "response": "<2–3 spoken sentences>" } ],
  "voicemail": ["<line>", "…"],
  "footerLines": [ "Name · Firm", "phone · email" ]
}

Sections in your instructions' order. Every number from deal-facts only;
broker track-record claims are bracketed slots, never invented.`,
    async render(spec, ctx) {
      const docx = path.join(ctx.outDir, "sales-script.docx");
      const html = path.join(ctx.outDir, "sales-script.html");
      await renderScriptDocx(spec, docx);
      renderScriptHtml(spec, html);
      return [docx, html];
    },
  },

  "investor-email": {
    prompt: "outputs/investor-email.md",
    internal: false,
    contract: `
## Output contract (harness)

Return one JSON object:

{
  "subjectOptions": ["…", "…", "…"],           // ≤ 55 chars, natural phrasing — no | • — / separators (deliverability)
  "openingLine": "…",
  "statBlock": [ { "label": "Cap Rate", "value": "6.33%" } ],
  "narrative": "<two sentences>",
  "signatureLines": ["Name", "Firm", "phone · email"]
}`,
    postProcess(spec) {
      // deliverability guardrail — separators stripped even if the model regresses
      spec.subjectOptions = (spec.subjectOptions ?? []).map((s) =>
        String(s).replace(/\s*[|•·]+\s*/g, " ").replace(/\s+[—–/]\s+/g, ", ").replace(/\s{2,}/g, " ").trim()
      );
      return spec;
    },
    async render(spec, ctx) {
      const txt = path.join(ctx.outDir, "investor-email.txt");
      const html = path.join(ctx.outDir, "investor-email.html");
      const stat = (spec.statBlock ?? []).map((r) => `${r.label}: ${r.value}`).join("\n");
      fs.writeFileSync(
        txt,
        `SUBJECT OPTIONS\n${(spec.subjectOptions ?? []).map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n---\n\n${spec.openingLine}\n\n${stat}\n\n${spec.narrative}\n\n${(spec.signatureLines ?? []).join("\n")}\n`
      );
      const esc = (s) => String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;");
      fs.writeFileSync(
        html,
        `<!doctype html><html><body style="font-family:Calibri,sans-serif;color:#424143;max-width:560px">
<p>${esc(spec.openingLine)}</p>
<table style="border-collapse:collapse">${(spec.statBlock ?? [])
          .map(
            (r) =>
              `<tr><td style="padding:3px 14px 3px 0;color:#344754;font-weight:bold">${esc(r.label)}</td><td style="padding:3px 0">${esc(r.value)}</td></tr>`
          )
          .join("")}</table>
<p>${esc(spec.narrative)}</p>
<p>${(spec.signatureLines ?? []).map(esc).join("<br>")}</p>
</body></html>`
      );
      return [txt, html];
    },
  },

  "email-drip": {
    prompt: "outputs/email-drip.md",
    internal: false,
    contract: `
## Output contract (harness)

Return one JSON object — the drip-sequence spec:

{
  "docTitle": "<property name> — Email Campaign",
  "meta": "4 touches · launch to offers due",
  "emails": [
    { "send": "Day 0 — launch",
      "purpose": "<one line — what this touch does>",
      "subjectOptions": ["…", "…"],        // ≤ 55 chars, no | • — / separators (deliverability)
      "body": "<full email body, line breaks as \\n, {FIRST_NAME} greeting token>" }
  ],
  "signatureLines": ["Name", "Firm", "phone · email"]
}

3–4 emails per your instructions. Anchor "send" to real dates when
deal-facts has an offer deadline, day offsets otherwise.`,
    postProcess(spec) {
      for (const e of spec.emails ?? [])
        e.subjectOptions = (e.subjectOptions ?? []).map((s) =>
          String(s).replace(/\s*[|•·]+\s*/g, " ").replace(/\s+[—–/]\s+/g, ", ").replace(/\s{2,}/g, " ").trim()
        );
      return spec;
    },
    async render(spec, ctx) {
      const txt = path.join(ctx.outDir, "email-drip.txt");
      const html = path.join(ctx.outDir, "email-drip.html");
      renderDrip(spec, txt, html);
      return [txt, html];
    },
  },

  "listing-copy": {
    prompt: "outputs/listing-copy.md",
    internal: false,
    contract: `
## Output contract (harness)

Return one JSON object — the listing-site copy spec:

{
  "docTitle": "<property name> — Listing Site Copy",
  "headline": "<≤ 100 chars — the LoopNet/Crexi listing headline>",
  "summary": "<1–2 sentence teaser for the results-page card>",
  "description": ["<paragraph>", "<paragraph>"],
  "highlights": ["<bullet, ≤ 12 words>"],
  "facts": [ { "label": "Asking Price", "value": "$10,900,000" } ]
}

Omit any key with no data.`,
    async render(spec, ctx) {
      const txt = path.join(ctx.outDir, "listing-copy.txt");
      const html = path.join(ctx.outDir, "listing-copy.html");
      renderListing(spec, txt, html);
      return [txt, html];
    },
  },

  "launch-calendar": {
    prompt: "outputs/launch-calendar.md",
    internal: true, // the broker's own campaign plan — not investor-facing
    contract: `
## Output contract (harness)

Return one JSON object — the launch-timeline spec:

{
  "docTitle": "<property name> — Launch Calendar",
  "meta": "<listing date> → <offers due, when present>",
  "timeline": [
    { "date": "YYYY-MM-DD", "channel": "LinkedIn|Email|Calls|Tours|Listing sites|Press|Deadline",
      "title": "<the step>", "description": "<one line, which asset to use>" }
  ]
}

Dates are real ISO dates: start at listingDate (given) and work back from
deal-facts' offer deadline when present, else lay out a 4-week arc.`,
    async render(spec, ctx) {
      const html = path.join(ctx.outDir, "launch-calendar.html");
      const ics = path.join(ctx.outDir, "launch-calendar.ics");
      renderCalendar(spec, html, ics);
      return [html, ics];
    },
  },

  "pptx-om": {
    prompt: "outputs/pptx-om.md",
    internal: false,
    contract: `
## Output contract (harness)

Return one JSON object — the slide spec. Include ONLY slides whose data
exists in deal-facts (drop photo-grid when there are no photos):

{
  "footerText": "<property name> · Offering Memorandum · <Firm>",
  "slides": [
    { "layout": "cover", "propertyName": "…", "addressLine": "…", "positioning": "<one line>", "brokerName": "…", "brokerFirm": "…", "brokerContactLine": "phone · email" },
    { "layout": "exec-summary", "heroStats": [ { "label": "…", "value": "…" } ], "opportunity": "<≤ 60 words>", "highlights": ["…"] },
    { "layout": "property-overview", "description": "<≤ 60 words>", "facts": [ { "label": "Year Built", "value": "1987" } ] },
    { "layout": "location-market", "subline": "<submarket>", "narrative": "<≤ 60 words>", "comps": [ { "name": "…", "detail": "36 units · Feb 2026 · $242,000/unit" } ] },
    { "layout": "financial-summary", "periodLabel": "…", "rows": [ { "label": "…", "value": "…" } ], "note": "<≤ 40 words, optional>" },
    { "layout": "unit-mix", "rows": [ { "type": "…", "count": "24", "avgSf": "720", "inPlaceRent": "$1,764", "marketRent": "$1,895" } ], "callout": "<loss-to-lease line, only if in deal-facts>" },
    { "layout": "rent-roll-summary", "rows": [ { "label": "Physical Occupancy", "value": "93.6%" } ], "note": "<≤ 40 words, optional>" },
    { "layout": "process-contact", "processText": "…", "deadlineLine": "Offers due Month D, YYYY", "brokerName": "…", "brokerFirm": "…", "brokerContactLine": "…", "licenseLine": "…" }
  ]
}

${KV} All table values are strings.`,
    postProcess(spec) {
      // Disclaimer is harness-populated, never generated (pptx-om.md rules)
      const pc = (spec.slides ?? []).find((s) => s.layout === "process-contact");
      if (pc)
        pc.disclaimer =
          "The information contained herein was obtained from sources deemed reliable but is not guaranteed. Buyers must verify all information independently. This document was prepared with CRE Northstar; all figures trace to the seller-provided source documents.";
      return spec;
    },
    async render(spec, ctx) {
      const out = path.join(ctx.outDir, "offering-memorandum.pptx");
      const r = await renderPptx(spec, out, { heroPath: ctx.heroPath });
      if (r.skipped) console.warn(`  [pptx-om] skipped ${r.skipped} slides with unknown layout`);
      return [out];
    },
  },

  "property-website": {
    prompt: "outputs/property-website.md",
    internal: false,
    contract: `
## Output contract (harness)

Return one JSON object — the website content spec (the harness renders the
page; you supply content only):

{
  "title": "<property name>",
  "addressLine": "street, city, state zip",
  "positioning": "<one line>",
  "heroStats": [ { "label": "…", "value": "…" } ],
  "overview": "<2–3 sentences>",
  "highlights": ["…"],
  "financials": { "periodLabel": "…", "rows": [ { "label": "…", "value": "…" } ] },
  "location": { "addressLine": "…", "blurb": "<submarket narrative, ≤ 80 words>" },
  "contact": { "heading": "Offer Process", "processLine": "…", "deadlineLine": "Offers due …", "brokerLine": "Name · Firm", "contactLine": "phone · email · Lic. #" },
  "cta": { "label": "Request the OM", "email": "<broker email>", "subject": "OM Request — <property name>" }
}

Omit any key with no data. No photo keys when deal-facts has no media.`,
    async render(spec, ctx) {
      const out = path.join(ctx.outDir, "property-website.html");
      renderWebsite(spec, out, { heroPath: ctx.heroPath });
      return [out];
    },
  },

  "press-release": {
    prompt: "outputs/press-release.md",
    stylePrompt: "outputs/press-release-style.md",
    internal: false,
    contract: `
## Output contract (harness)

Return one JSON object — a sectioned prose spec for the wire format:

{
  "docTitle": "<headline, ≤ 90 chars, numbers up front; superlatives only if grounded>",
  "subtitle": "<italic deck — one sentence stating the significance>",
  "meta": "FOR IMMEDIATE RELEASE",
  "sections": [
    { "paragraphs": ["<dateline lede — 5 Ws in ~30 words>", "<context ¶>", "<detail ¶ — exact numbers>"] },
    { "heading": "Draft Quote", "paragraphs": ["[DRAFT QUOTE — approve or edit] \\"…\\" said <Title>, <Name>."] },
    { "paragraphs": ["<industry-context ¶, only if a term needs defining>", "<process line>", "[FIRM BOILERPLATE]"] }
  ],
  "footerLines": [ "Media contact:", "Name · Firm", "phone · email", "##" ],
  "warning": "<only if the deal is too thin for news>"
}`,
    postProcess(spec) {
      if (spec.warning)
        spec.sections?.unshift({ paragraphs: [`[NOTE: ${spec.warning}]`] });
      return spec;
    },
    async render(spec, ctx) {
      const out = path.join(ctx.outDir, "press-release.docx");
      await renderProseDocx(spec, out, { heroImagePath: ctx.heroPath });
      return [out];
    },
  },

  "dd-checklist": {
    prompt: "outputs/dd-checklist.md",
    internal: true, // never part of the marketing export bundle
    includeRisks: true,
    includeGaps: true,
    contract: `
## Output contract (harness)

Return one JSON object conforming to dd-checklist.schema.json:

{
  "dealId": "<given>",
  "generatedAt": "<given ISO>",
  "items": [
    { "category": "financial|physical|legal|environmental|tenancy|market",
      "task": "…", "why": "<one sentence>", "priority": "standard|elevated",
      "sourceRef": "<manifest candidate id — required on elevated items>" }
  ]
}`,
    validateSchema: "dd-checklist",
    async render(spec, ctx) {
      const out = path.join(ctx.outDir, "dd-checklist.xlsx");
      const n = renderChecklistXlsx(spec, out);
      console.log(`  [dd-checklist] ${n} items → xlsx`);
      return [out];
    },
  },

  "crm-entry": {
    prompt: "outputs/crm-entry.md",
    internal: true,
    renderLast: true, // assetLinks are filled from the other outputs' files
    contract: `
## Output contract (harness)

Return one JSON object conforming to crm-entry.schema.json (omit missing
values entirely — no null, no "N/A"). Leave "activities" and "assetLinks"
out; the harness fills them:

{
  "dealId": "<given>",
  "generatedAt": "<given ISO>",
  "listing": { "propertyName": "…", "address": "<single line>", "propertyType": "…", "units": 48, "buildingSf": 41280, "askingPrice": 10950000, "capRate": 0.0633, "occupancy": 0.9362, "noi": 692800, "listingDate": "<given date>", "offerDeadline": "YYYY-MM-DD", "dealStage": "on-market", "notes": "<2–3 sentences>" },
  "contact": { "name": "…", "firm": "…", "email": "…", "phone": "…", "role": "Listing broker" }
}`,
    validateSchema: "crm-entry",
    postProcess(spec, ctx) {
      spec.activities = [
        {
          date: new Date().toISOString(),
          description: `Marketing package generated (${ctx.producedOutputs.join(", ")})`,
        },
      ];
      spec.assetLinks = Object.fromEntries(
        Object.entries(ctx.assetLinks).map(([k, files]) => [k, files.map((f) => path.basename(f)).join(", ")])
      );
      return spec;
    },
    async render(spec, ctx) {
      const out = path.join(ctx.outDir, "crm-entry.json");
      writeJson(out, spec);
      return [out];
    },
  },
};

export function validateSpec(name, spec) {
  const entry = REGISTRY[name];
  if (entry.validateSchema) {
    // Conform first (prune/coerce/drop with notes); strict check after.
    const c = conformToSchema(entry.validateSchema, spec);
    if (c.notes.length) console.warn(`  [${name}] spec conformed: ${c.notes.join("; ")}`);
    if (!c.ok) throw new Error(`${name} spec is off-contract: ${c.errors[0]}`);
    validateAgainst(entry.validateSchema, spec);
  }
  return spec;
}
