---
name: pptx-om
output: slide-spec JSON → rendered to .pptx by the harness (pptxgenjs / python-pptx)
audience: investors; the flagship marketing document
---

# PowerPoint OM

The full offering-memorandum deck. This generator emits a **slide-spec
JSON** (array of slides, each with layout id + content slots); the harness
renders it with the CRE Northstar template so typography and color are
enforced by code, not by the model.

## Slide sequence

| # | Layout | Content |
|---|---|---|
| 1 | cover | hero photo full-bleed, property name, address, "Offering Memorandum", broker firm block |
| 2 | exec-summary | opportunity paragraph + hero-stat tiles (same selection logic as investment summary) |
| 3 | property-overview | description prose + fact table (year built, SF, lot, parking, zoning) |
| 4 | photo-grid | 4–6 best photos by curator ranking, captions |
| 5 | location-market | address/submarket + `market.narrative`; comps table if present |
| 6 | financial-summary | T12 table: income → EGI → opex → NOI, expense ratio; period labeled |
| 7 | unit-mix | unit mix table + avg in-place vs market rent; loss-to-lease callout if present |
| 8 | rent-roll-summary | occupancy, lease expiration profile, rent/SF |
| 9 | process-contact | offer process, deadline, broker contact, disclaimer slot |

Slides whose data is absent are dropped from the spec (never emitted
empty). Photo-grid uses only photos without quality flags.

## Rules

- Charts (if any) follow brand-guidelines §6: Steel Navy → Teal → Lime →
  Charcoal → Gray series order, Georgia hero numbers, no gridline clutter.
- All prose slots ≤ 60 words — decks are scanned, not read.
- The disclaimer slot is populated by the harness with the brokerage's
  standard disclaimer, not generated.
