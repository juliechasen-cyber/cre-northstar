---
name: investment-summary
output: sectioned content spec → rendered to editable .docx + send-ready PDF
audience: investors/principals receiving the teaser
v0.1: this is the first output built — the pipeline proof
---

# Investment Summary (1-pager)

The teaser a broker attaches to a first outreach email. One page, scannable
in 30 seconds, every number load-bearing.

## Structure

1. **Header** — property name, address, property type · unit count · year built. Hero photo.
2. **Hero stats row** (3–5 tiles): asking price (or "Unpriced — Call for Offers"), price/unit, cap rate, occupancy, NOI. Only tiles whose value exists in deal-facts; 3 good tiles beat 5 padded ones.
3. **The opportunity** — 2–3 sentences: what this deal is and why it clears the bar. Built from `highlights[]`.
4. **Financial snapshot** — table: GPR, effective gross income, opex, NOI, expense ratio (T12 period labeled).
5. **Unit mix** — table from `unitMix[]`: type, count, avg SF, in-place rent, market rent.
6. **Highlights** — 3–5 bullets from `highlights[]`, each ≤ 12 words.
7. **Footer** — broker name, firm, phone, email, license #. Offer deadline if present.

## Rules

- Fits one page at 10.5pt body. If content overflows, cut highlights before
  tables, and opportunity prose before highlights.
- Brand: Georgia headlines, Calibri body, Steel Navy headers, Lime only as
  accent per brand-guidelines §2.
