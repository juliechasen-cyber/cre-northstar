import fs from "node:fs";
import { NAVY, CHARCOAL, LIME, TEAL, GRAY, MIST, headStack, bodyStack } from "./brand.mjs";

// Campaign-side renders: email drip sequence, listing-site copy, launch
// calendar (+ .ics). All plain files — txt for pasting, html for reading,
// ics for the broker's calendar app.

const esc = (s) =>
  String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const htmlShell = (title, body) => `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  :root { --navy:#${NAVY}; --charcoal:#${CHARCOAL}; --lime:#${LIME}; --teal:#${TEAL}; --gray:#${GRAY}; --mist:#${MIST}; }
  body { font-family:${bodyStack()}; color:var(--charcoal); max-width:8in; margin:32px auto; padding:0 24px; font-size:11pt; line-height:1.5; }
  h1 { font-family:${headStack()}; color:var(--navy); font-size:22pt; margin:0 0 2px; }
  .meta { color:var(--navy); font-weight:700; font-size:8.5pt; letter-spacing:.06em; text-transform:uppercase; margin-bottom:16px; }
  h2 { font-family:${headStack()}; color:var(--navy); font-size:11.5pt; text-transform:uppercase; letter-spacing:.04em; border-bottom:2px solid var(--lime); padding-bottom:3px; margin:22px 0 8px; }
  .hint { color:var(--teal); font-style:italic; font-size:9.5pt; margin:0 0 8px; }
  .block { border-left:3px solid var(--mist); padding:2px 0 2px 14px; margin:0 0 10px; white-space:pre-wrap; }
  .subjects li { margin-bottom:2px; }
  table { width:100%; border-collapse:collapse; }
  td, th { padding:6px 10px; border-bottom:1px solid var(--gray); text-align:left; vertical-align:top; }
  th { background:var(--navy); color:#fff; font-size:9.5pt; border:none; }
  tbody tr:nth-child(even) td { background:var(--mist); }
  .chip { display:inline-block; font-size:8.5pt; font-weight:700; border-radius:4px; padding:1px 7px; background:var(--mist); color:var(--navy); }
  footer { border-top:2px solid var(--navy); margin-top:26px; padding-top:8px; font-size:10pt; }
  @media print { body { margin:0 auto; } }
</style></head><body>${body}</body></html>`;

// --- email drip sequence -------------------------------------------------
// spec: { docTitle, meta?, emails: [{ send, purpose?, subjectOptions: [],
//         body }], signatureLines? }
export function renderDrip(spec, txtPath, htmlPath) {
  const txt = [
    spec.docTitle.toUpperCase(),
    "",
    ...(spec.emails ?? []).flatMap((e, i) => [
      `=== EMAIL ${i + 1} · ${e.send}${e.purpose ? ` — ${e.purpose}` : ""} ===`,
      "",
      "SUBJECT OPTIONS",
      ...(e.subjectOptions ?? []).map((s, j) => `${j + 1}. ${s}`),
      "",
      e.body,
      "",
    ]),
    ...(spec.signatureLines ?? []),
  ].join("\n");
  fs.writeFileSync(txtPath, txt + "\n");

  const emails = (spec.emails ?? []).map(
    (e, i) => `<h2>Email ${i + 1} · ${esc(e.send)}</h2>
${e.purpose ? `<p class="hint">${esc(e.purpose)}</p>` : ""}
<ul class="subjects">${(e.subjectOptions ?? []).map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
<div class="block">${esc(e.body)}</div>`
  ).join("\n");
  fs.writeFileSync(
    htmlPath,
    htmlShell(spec.docTitle, `<h1>${esc(spec.docTitle)}</h1>
${spec.meta ? `<div class="meta">${esc(spec.meta)}</div>` : ""}
${emails}
${spec.signatureLines?.length ? `<footer>${spec.signatureLines.map(esc).join("<br>")}</footer>` : ""}`)
  );
}

// --- listing-site copy (LoopNet / Crexi) ---------------------------------
// spec: { docTitle, headline, summary?, description: [], highlights: [],
//         facts: [{label,value}] }
export function renderListing(spec, txtPath, htmlPath) {
  const txt = [
    spec.docTitle.toUpperCase(),
    "",
    `HEADLINE (${(spec.headline ?? "").length} chars)`,
    spec.headline ?? "",
    "",
    ...(spec.summary ? ["SUMMARY / TEASER", spec.summary, ""] : []),
    "DESCRIPTION",
    ...(spec.description ?? []).flatMap((p) => [p, ""]),
    "HIGHLIGHTS",
    ...(spec.highlights ?? []).map((h) => `• ${h}`),
    "",
    "KEY FACTS",
    ...(spec.facts ?? []).map((f) => `${f.label}: ${f.value}`),
  ].join("\n");
  fs.writeFileSync(txtPath, txt + "\n");

  fs.writeFileSync(
    htmlPath,
    htmlShell(spec.docTitle, `<h1>${esc(spec.docTitle)}</h1>
<div class="meta">Ready to paste into LoopNet / Crexi listing fields</div>
<h2>Headline <span class="chip">${(spec.headline ?? "").length} chars</span></h2>
<div class="block">${esc(spec.headline ?? "")}</div>
${spec.summary ? `<h2>Summary / teaser</h2><div class="block">${esc(spec.summary)}</div>` : ""}
<h2>Description</h2>${(spec.description ?? []).map((p) => `<div class="block">${esc(p)}</div>`).join("")}
${spec.highlights?.length ? `<h2>Highlights</h2><ul>${spec.highlights.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>` : ""}
${spec.facts?.length ? `<h2>Key facts</h2><table><tbody>${spec.facts.map((f) => `<tr><td><b>${esc(f.label)}</b></td><td>${esc(f.value)}</td></tr>`).join("")}</tbody></table>` : ""}`)
  );
}

// --- launch calendar ------------------------------------------------------
// spec: { docTitle, meta?, timeline: [{ date: "YYYY-MM-DD", title,
//         channel?, description? }] }
export function renderCalendar(spec, htmlPath, icsPath) {
  const rows = (spec.timeline ?? []).map(
    (t) => `<tr><td style="white-space:nowrap"><b>${esc(fmtDate(t.date))}</b></td>
<td>${t.channel ? `<span class="chip">${esc(t.channel)}</span> ` : ""}<b>${esc(t.title)}</b>${t.description ? `<br>${esc(t.description)}` : ""}</td></tr>`
  ).join("");
  fs.writeFileSync(
    htmlPath,
    htmlShell(spec.docTitle, `<h1>${esc(spec.docTitle)}</h1>
${spec.meta ? `<div class="meta">${esc(spec.meta)}</div>` : ""}
<p class="hint">Import launch-calendar.ics to put every step on your calendar.</p>
<table><thead><tr><th style="width:120px">Date</th><th>Step</th></tr></thead><tbody>${rows}</tbody></table>`)
  );

  const stamp = new Date().toISOString().replace(/[-:]|\.\d{3}/g, "");
  const events = (spec.timeline ?? []).filter((t) => /^\d{4}-\d{2}-\d{2}$/.test(t.date ?? "")).map((t, i) => {
    const d = t.date.replace(/-/g, "");
    return [
      "BEGIN:VEVENT",
      `UID:northstar-${d}-${i}@crenorthstar.local`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${d}`,
      `SUMMARY:${icsEsc((t.channel ? `[${t.channel}] ` : "") + t.title)}`,
      ...(t.description ? [`DESCRIPTION:${icsEsc(t.description)}`] : []),
      "END:VEVENT",
    ].join("\r\n");
  });
  fs.writeFileSync(
    icsPath,
    ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CRE Northstar//Launch Calendar//EN",
     `X-WR-CALNAME:${icsEsc(spec.docTitle)}`, ...events, "END:VCALENDAR", ""].join("\r\n")
  );
}

const icsEsc = (s) => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const fmtDate = (iso) => {
  const [y, m, d] = String(iso).split("-").map(Number);
  return Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)
    ? new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" })
    : String(iso);
};
