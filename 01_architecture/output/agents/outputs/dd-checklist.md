---
name: dd-checklist
output: structured JSON (schemas/dd-checklist.schema.json) → rendered to editable .xlsx and .docx
audience: the broker and the eventual buyer's team — INTERNAL, not marketing
special-access: the ONLY generator permitted to read deal-facts risks[]
---

# Due Diligence Checklist

The buyer-side prep list: what a serious buyer will ask for, seeded with
what this deal's own documents already flag. Getting this into the broker's
hands early makes them look prepared and speeds the deal.

## Composition

1. **Standard items** — the base checklist for the property type
   (financial: 3 years operating statements, tax bills, utility bills;
   physical: PCA, roof/HVAC age, ADA; legal: title, survey, zoning letter,
   service contracts, litigation search; environmental: Phase I;
   tenancy: leases, estoppels, delinquency report).
2. **Deal-specific items** — one item per entry in `risks[]`, and one per
   data gap recorded in the manifest (e.g. "market rents absent from rent
   roll — obtain comp survey"). Each cites its `sourceRef`.

## Per item

`{ category, task, why (one sentence), priority: standard | elevated,
sourceRef? }` — items born from `risks[]` or data gaps are `elevated` and
carry the sourceRef; standard items don't.

## Rules

- This document is **never** included in the marketing package export.
  The harness must keep it in the internal bundle only.
- No severity theater: an old roof is `elevated`, not "CRITICAL ⚠️".
- Do not invent risks. If `risks[]` is empty and the manifest has no gaps,
  the checklist is just the standard list — that is a fine outcome.
