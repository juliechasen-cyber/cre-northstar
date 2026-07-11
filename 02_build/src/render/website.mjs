import fs from "node:fs";
import { NAVY, CHARCOAL, LIME, TEAL, MIST, OFFWHITE, headStack, bodyStack } from "./brand.mjs";

// Website content spec → single self-contained HTML page (property-website.md).
// No webfonts, no external requests; brand tokens with universal fallbacks.
// opts.heroPath: property photo embedded as a data URI behind the hero header.
const esc = (s) =>
  String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const rgb = (hex) => {
  const n = parseInt(hex, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};

export function renderWebsite(spec, outPath, { heroPath } = {}) {
  const heroB64 = heroPath && fs.existsSync(heroPath) ? fs.readFileSync(heroPath).toString("base64") : null;
  const heroCss = heroB64
    ? `background: linear-gradient(rgba(${rgb(NAVY)},.82), rgba(${rgb(NAVY)},.9)), url(data:image/jpeg;base64,${heroB64}) center/cover;`
    : `background: var(--navy);`;
  const stats = (spec.heroStats ?? [])
    .map((s) => `<div class="tile"><div class="tl">${esc(s.label)}</div><div class="tv">${esc(s.value)}</div></div>`)
    .join("");
  const bullets = (spec.highlights ?? []).map((h) => `<li>${esc(h)}</li>`).join("");
  const finRows = (spec.financials?.rows ?? [])
    .map((r) => `<tr><td>${esc(r.label)}</td><td class="num">${esc(r.value)}</td></tr>`)
    .join("");
  const mailto = spec.cta?.email
    ? `mailto:${esc(spec.cta.email)}?subject=${encodeURIComponent(spec.cta.subject ?? "OM Request")}`
    : null;
  const cta = mailto ? `<a class="cta" href="${mailto}">${esc(spec.cta.label ?? "Request the OM")}</a>` : "";

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(spec.title)}</title>
<style>
  :root { --navy:#${NAVY}; --charcoal:#${CHARCOAL}; --lime:#${LIME}; --teal:#${TEAL}; --mist:#${MIST}; --off:#${OFFWHITE}; --head:${headStack()}; --body:${bodyStack()}; }
  * { box-sizing:border-box; margin:0; }
  body { font-family: var(--body); color: var(--charcoal); background: var(--off); font-size: 17px; line-height: 1.55; }
  .wrap { max-width: 880px; margin: 0 auto; padding: 0 22px; }
  header.hero { ${heroCss} color: #fff; padding: 84px 0 64px; }
  .hero h1 { font-family: var(--head); font-size: 44px; line-height: 1.1; }
  .hero .addr { margin-top: 10px; font-size: 19px; color: var(--mist); }
  .hero .pos { margin-top: 14px; font-size: 18px; color: var(--teal); font-style: italic; }
  .cta { display:inline-block; margin-top: 26px; background: var(--lime); color: var(--navy); font-weight: 700; padding: 13px 28px; border-radius: 6px; text-decoration: none; }
  .band { background:#fff; border-bottom: 1px solid var(--mist); padding: 26px 0; }
  .tiles { display:flex; gap:14px; flex-wrap:wrap; }
  .tile { flex:1 1 140px; background: var(--mist); border-top: 3px solid var(--lime); padding: 12px 14px; }
  .tl { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
  .tv { font-family: var(--head); color: var(--navy); font-size: 25px; font-weight: 700; }
  section { padding: 44px 0; }
  h2 { font-family: var(--head); color: var(--navy); font-size: 26px; margin-bottom: 14px; border-bottom: 2px solid var(--lime); display:inline-block; padding-bottom: 4px; }
  ul { margin: 14px 0 0 22px; } li { margin-bottom: 7px; }
  table { width:100%; border-collapse: collapse; background:#fff; margin-top: 10px; }
  td { padding: 9px 13px; border-bottom: 1px solid var(--mist); }
  .num { text-align: right; }
  tr:nth-child(even) td { background: var(--off); }
  .fine { font-size: 14px; color: #7c7e7f; margin-top: 10px; }
  .loc { background:#fff; }
  footer { background: var(--navy); color:#fff; padding: 48px 0 56px; }
  footer h2 { color:#fff; border-color: var(--lime); }
  .broker { font-size: 19px; font-weight: 700; margin-top: 8px; }
  .contact { color: var(--mist); margin-top: 4px; }
  .deadline { margin-top: 16px; font-family: var(--head); font-size: 20px; color: var(--lime); font-weight: 700; }
  @media (max-width: 720px) { .hero h1 { font-size: 32px; } .tile { flex-basis: 44%; } }
</style></head><body>

<header class="hero"><div class="wrap">
  <h1>${esc(spec.title)}</h1>
  ${spec.addressLine ? `<div class="addr">${esc(spec.addressLine)}</div>` : ""}
  ${spec.positioning ? `<div class="pos">${esc(spec.positioning)}</div>` : ""}
  ${cta}
</div></header>

${stats ? `<div class="band"><div class="wrap"><div class="tiles">${stats}</div></div></div>` : ""}

${spec.overview ? `<section><div class="wrap"><h2>The Opportunity</h2><p>${esc(spec.overview)}</p>${bullets ? `<ul>${bullets}</ul>` : ""}</div></section>` : ""}

${finRows ? `<section class="loc"><div class="wrap"><h2>Financial Snapshot</h2>${spec.financials.periodLabel ? `<p class="fine">${esc(spec.financials.periodLabel)}</p>` : ""}<table><tbody>${finRows}</tbody></table><p class="fine">Detailed financials are available in the Offering Memorandum.</p></div></section>` : ""}

${spec.location?.blurb ? `<section><div class="wrap"><h2>Location</h2>${spec.location.addressLine ? `<p><b>${esc(spec.location.addressLine)}</b></p>` : ""}<p>${esc(spec.location.blurb)}</p></div></section>` : ""}

<footer><div class="wrap">
  <h2>${esc(spec.contact?.heading ?? "Offer Process")}</h2>
  ${spec.contact?.processLine ? `<p>${esc(spec.contact.processLine)}</p>` : ""}
  ${spec.contact?.deadlineLine ? `<div class="deadline">${esc(spec.contact.deadlineLine)}</div>` : ""}
  ${spec.contact?.brokerLine ? `<div class="broker">${esc(spec.contact.brokerLine)}</div>` : ""}
  ${spec.contact?.contactLine ? `<div class="contact">${esc(spec.contact.contactLine)}</div>` : ""}
  ${cta}
</div></footer>
</body></html>`;
  fs.writeFileSync(outPath, html);
}
