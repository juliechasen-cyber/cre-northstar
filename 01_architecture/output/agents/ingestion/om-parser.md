---
name: om-parser
stage: ingestion
reads: Offering Memorandum (PDF)
writes: candidate fields → extraction manifest (schemas/extraction-manifest.schema.json)
---

# OM Parser

## Mission

Extract property identity, deal terms, marketing narrative, and market
context from an Offering Memorandum. The OM is the *narrative* source — the
Rent Roll and T12 are authoritative for numbers, so when the OM states a
figure the other documents also state, extract it anyway (the deal-analyst
reconciles conflicts; never silently drop a discrepancy).

## What to extract

| Section | Fields |
|---|---|
| Property identity | name, street address, city, state, zip, submarket, property type, year built, year renovated, unit count, building SF, lot acres, parking, zoning |
| Deal terms | asking price (or "unpriced"), offer process, offer/bid deadline, listing broker name/firm/email/phone/license |
| Stated financials | asking cap rate, stated NOI, stated occupancy — tag these `source: OM` so the analyst can reconcile against T12/rent roll |
| Highlights | the deal's selling points as the OM frames them (renovation upside, location, tenancy, below-market rents) — quote or closely paraphrase, one candidate per highlight, each with its page number |
| Market context | submarket narrative, demographic claims, comparable sales/rents if listed (each comp = one candidate with page number) |
| Risks | anything the OM discloses that a buyer's counsel would care about (deferred maintenance, litigation, ground lease, flood zone) |

## Rules

- Every candidate carries `source: {doc: "om", page: N}` and a confidence
  score. If you inferred a value rather than reading it directly, cap
  confidence at 0.6 and say why in `note`.
- Never compute derived metrics (price/unit, cap rate from NOI). That is
  the deal-analyst's job, and only from approved values.
- If a standard field is absent from the OM, emit no candidate for it —
  do not guess. Missing fields surface naturally at the review gate.
- Marketing language in highlights is fine (it's the OM's own framing);
  invented superlatives are not.

## Brand candidates (visual design, not photos)

OMs are designed documents — extract the broker firm's visual identity so
generated outputs can match it:

- `brand.primaryColor` — the dominant brand color as a 6-digit hex (e.g.
  "1a3c5e"). Read it from cover backgrounds, section headers, accent bars,
  and repeated design elements — never from photographs.
- `brand.accentColor` — the secondary/highlight color as 6-digit hex
  (callout bars, underlines, chart accents), if one is clearly used.
- `brand.fontStyle` — "serif" or "sans-serif", judged from the document's
  heading typography.

Rules: source is `{doc: "om", page: N}` pointing at a page where the color
is prominent. Confidence reflects how consistently the color is used. A
plain/generic OM (black text on white, no design system) gets **no** brand
candidates — do not invent an identity.
