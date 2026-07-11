---
name: crm-entry
output: structured JSON (schemas/crm-entry.schema.json)
audience: the broker's CRM (v1: generic JSON; integrations later)
---

# CRM Entry

The listing as a record: everything a broker's CRM needs so the deal is
trackable from day one without retyping.

## Contents

- **Listing record** — property name, address, type, units/SF, asking
  price, cap rate, occupancy, NOI, listing date (= generation date),
  offer deadline, deal stage `"on-market"`.
- **Contact record** — the listing broker block from deal-facts.
- **Activity seed** — one logged activity: "Marketing package generated
  ({list of outputs produced this run})".
- **Asset links** — slots for the URLs/paths of the other 8 outputs,
  filled by the harness after rendering.

## Rules

- Strict schema conformance — this output is consumed by software, not
  people. No prose fields beyond `notes`.
- `notes` gets a 2–3 sentence plain-text deal summary (grounded, same
  rules as everything else).
- Missing values are omitted keys, not `null`, not `"N/A"` — downstream
  CRM mappers should never have to parse sentinel strings.
