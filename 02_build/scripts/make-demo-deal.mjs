// Generates fixtures/demo-deal/ — ONE coherent synthetic deal across all
// three documents (the committed fixtures/ pile is per-parser edge cases
// from three different properties; useless for an end-to-end run).
//
// Property: Hillcrest Gardens Apartments (fictional), 48 units, San Diego.
// Deliberate wrinkles the pipeline must handle:
//   - rent roll: title row above headers, one "Model" (non-revenue) unit,
//     $0 rent on vacant units, two month-to-month leases
//   - T12: monthly columns that must be summed/verified against Annual,
//     stated NOI on the sheet differs from computed by design? no — the OM
//     states $695,000 while the T12 computes $692,800 (reconciliation test)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";
import PDFDocument from "pdfkit";

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "demo-deal");
fs.mkdirSync(outDir, { recursive: true });

// ---------- shared deal numbers ----------
const PROPERTY = "Hillcrest Gardens Apartments";
const ADDRESS = "4820 Juniper Street, San Diego, CA 92104";

// ---------- rent roll ----------
const mix = [
  { type: "1x1", count: 24, sf: 720, market: 1895 },
  { type: "2x1", count: 8, sf: 900, market: 2150 },
  { type: "2x2", count: 16, sf: 1050, market: 2395 },
];
const rows = [
  [`${PROPERTY} — Rent Roll as of June 30, 2026`, "", "", "", "", "", ""],
  ["Unit", "Type", "SqFt", "Market Rent", "Current Rent", "Status", "Lease End"],
];
let unitNum = 100;
let seed = 42;
const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
const vacantUnits = new Set([3, 17, 40]); // 3 vacant
const modelUnit = 29; // 1 non-revenue model unit
const mtmUnits = new Set([9, 22]);
let i = 0;
for (const m of mix) {
  for (let k = 0; k < m.count; k++, i++) {
    unitNum += unitNum % 100 === 24 ? 77 : 1; // 101..124, 201..224 style
    const inPlace = Math.round((m.market * (0.88 + rand() * 0.09)) / 5) * 5;
    let status = "Occupied";
    let rent = inPlace;
    let leaseEnd = new Date(2026, 6 + Math.floor(rand() * 12), 1 + Math.floor(rand() * 27));
    let leaseEndStr = leaseEnd.toISOString().slice(0, 10);
    if (vacantUnits.has(i)) { status = "Vacant"; rent = 0; leaseEndStr = ""; }
    if (i === modelUnit) { status = "Model"; rent = 0; leaseEndStr = ""; }
    if (mtmUnits.has(i)) leaseEndStr = "MTM";
    rows.push([String(unitNum), m.type, m.sf, m.market, rent, status, leaseEndStr]);
  }
}
const wbRR = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbRR, XLSX.utils.aoa_to_sheet(rows), "Rent Roll");
fs.writeFileSync(path.join(outDir, "rent-roll.xlsx"), XLSX.write(wbRR, { type: "buffer", bookType: "xlsx" }));

// ---------- T12 (Jul 2025 – Jun 2026) ----------
const months = ["Jul-25","Aug-25","Sep-25","Oct-25","Nov-25","Dec-25","Jan-26","Feb-26","Mar-26","Apr-26","May-26","Jun-26"];
function spread(annual) {
  const base = Math.floor(annual / 12);
  const m = Array(12).fill(base);
  m[11] = annual - base * 11;
  return m;
}
const lines = [
  ["INCOME"],
  ["Gross Potential Rent", 1185000],
  ["Vacancy Loss", -71100],
  ["Concessions", -8400],
  ["Bad Debt", -5900],
  ["Utility Reimbursements (RUBS)", 48600],
  ["Laundry & Other Income", 16200],
  ["Effective Gross Income", 1164400],
  ["EXPENSES"],
  ["Real Estate Taxes", 118500],
  ["Insurance", 42300],
  ["Utilities", 68200],
  ["Repairs & Maintenance", 61400],
  ["Payroll & Benefits", 88000],
  ["Management Fee", 46600],
  ["Marketing", 9600],
  ["General & Administrative", 14200],
  ["Contract Services", 22800],
  ["Total Operating Expenses", 471600],
  ["Net Operating Income", 692800],
  ["BELOW THE LINE"],
  ["Capital Expenditures", 38500],
];
const t12rows = [
  [`${PROPERTY} — Trailing 12 Month Operating Statement`, ...Array(13).fill("")],
  ["Account", ...months, "Annual"],
];
for (const [label, annual] of lines) {
  if (annual === undefined) t12rows.push([label, ...Array(13).fill("")]);
  else t12rows.push([label, ...spread(annual), annual]);
}
const wbT12 = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbT12, XLSX.utils.aoa_to_sheet(t12rows), "T12");
fs.writeFileSync(path.join(outDir, "t12.xlsx"), XLSX.write(wbT12, { type: "buffer", bookType: "xlsx" }));

// ---------- Offering Memorandum PDF ----------
const doc = new PDFDocument({ size: "LETTER", margins: { top: 64, bottom: 64, left: 64, right: 64 } });
doc.pipe(fs.createWriteStream(path.join(outDir, "offering-memo.pdf")));
const H = (t) => doc.moveDown(0.8).font("Times-Bold").fontSize(15).text(t).moveDown(0.3).font("Times-Roman").fontSize(11);
const P = (t) => doc.font("Times-Roman").fontSize(11).text(t, { lineGap: 2 });
const B = (t) => doc.font("Times-Roman").fontSize(11).text(`•  ${t}`, { indent: 12, lineGap: 2 });

// Page 1 — cover
doc.font("Times-Bold").fontSize(26).text("OFFERING MEMORANDUM", { align: "center" });
doc.moveDown(1.5);
doc.fontSize(22).text(PROPERTY, { align: "center" });
doc.font("Times-Roman").fontSize(13).moveDown(0.5).text(ADDRESS, { align: "center" });
doc.moveDown(0.3).text("48-Unit Multifamily Investment Opportunity | North Park / Hillcrest Submarket", { align: "center" });
doc.moveDown(2);
doc.font("Times-Bold").fontSize(16).text("Asking Price: $10,950,000", { align: "center" });
doc.moveDown(3);
doc.font("Times-Roman").fontSize(12).text("Exclusively Listed By:", { align: "center" });
doc.font("Times-Bold").text("Dana Whitfield", { align: "center" });
doc.font("Times-Roman").text("Meridian Capital Advisors", { align: "center" });
doc.text("(619) 555-0142  |  dwhitfield@meridiancap.example.com", { align: "center" });
doc.text("CA DRE #01234567", { align: "center" });

// Page 2 — executive summary
doc.addPage();
H("Executive Summary");
P(`Meridian Capital Advisors is pleased to present ${PROPERTY}, a 48-unit garden-style multifamily community located at ${ADDRESS}, in the heart of San Diego's North Park / Hillcrest corridor. Built in 1987 and selectively renovated in 2019, the property comprises 41,280 rentable square feet across three residential buildings on a 1.38-acre parcel, with 62 surface parking spaces. The property is zoned RM-2-5.`);
P("The offering represents a rare opportunity to acquire a stabilized asset with proven rental upside: current occupancy is 94% and in-place rents average approximately 7% below market, providing a clear path to organic revenue growth through the natural lease cycle.");
H("Investment Highlights");
B("In-place rents approximately 7% below market — embedded loss-to-lease upside through natural turnover");
B("20 units fully renovated in 2019 with quartz countertops, vinyl plank flooring, and stainless appliances — 28 classic units remain for a value-add program");
B("Walkable North Park / Hillcrest location: Walk Score 91, three blocks to the 30th Street restaurant corridor");
B("Strong submarket fundamentals: North Park multifamily occupancy has averaged above 95% for the past five years");
B("Stable operations: trailing-twelve NOI of approximately $695,000 at a 6.3% capitalization rate on the asking price");
H("Property Description");
P("Unit mix consists of 24 one-bedroom/one-bath units averaging 720 SF, 8 two-bedroom/one-bath units averaging 900 SF, and 16 two-bedroom/two-bath units averaging 1,050 SF. Community amenities include a landscaped central courtyard, on-site laundry facilities in each building, gated surface parking, and private patios or balconies in select units.");

// Page 3 — financials, market, process
doc.addPage();
H("Financial Overview");
P("The property generated trailing-twelve-month effective gross income of approximately $1,164,000 against operating expenses of approximately $472,000, producing net operating income of approximately $695,000. Current physical occupancy is 94%. Other income streams include utility reimbursements (RUBS) and on-site laundry.");
P("At the asking price of $10,950,000, the offering reflects a 6.3% cap rate on trailing financials, $228,125 per unit, and $265 per rentable square foot.");
H("Market Overview");
P("North Park and Hillcrest are among San Diego's most sought-after urban neighborhoods, anchored by the 30th Street corridor's nationally recognized restaurant and craft-brewery scene. The submarket draws young professionals from the nearby medical employment cluster (UC San Diego Health Hillcrest and Scripps Mercy, together over 8,000 employees within two miles).");
P("Recent comparable sales include The Cordova (36 units, sold February 2026 at $242,000 per unit) and Palm & Oak Apartments (52 units, sold November 2025 at $221,500 per unit).");
H("Offer Process");
P("Offers are due Wednesday, August 12, 2026. Please direct all inquiries, tour requests, and offers to the exclusive listing broker. A due diligence data room is available upon execution of a confidentiality agreement.");
P("Disclaimer: Fictional property generated for CRE Northstar pipeline testing. All figures are synthetic.");
doc.end();

console.log(`demo deal written to ${outDir}`);
