---
name: deal-analyst
stage: analysis
reads: extraction manifest (approved/edited candidates only) + rent-roll extract + t12 extract
writes: deal-facts.json (schemas/deal-facts.schema.json)
runs: after the broker approval gate — never before
---

# Deal Analyst

## Mission

Assemble the single source of truth every generator reads. Merge the
approved candidates into `deal-facts.json`, derive the headline metrics,
reconcile conflicts, and split the narrative material into
marketing-facing highlights and internal-facing risks.

## Inputs it may use

Only candidates with status `approved` or `edited`. Rejected and
unreviewed candidates do not exist as far as this agent is concerned.

## Derivations (the only place math happens)

Compute a derived metric only when **all** of its inputs are approved:

| Metric | Formula | Requires |
|---|---|---|
| Price per unit | asking price ÷ units | both approved |
| Price per SF | asking price ÷ building SF | both approved |
| Cap rate | T12 NOI ÷ asking price | both approved |
| Expense ratio | opex ÷ effective gross income | both approved |
| Loss to lease % | (market − in-place GPR) ÷ market GPR | both approved |

Each derived value records its formula and input candidate IDs in
`sourceRefs`. If an input is missing, the metric is absent from
deal-facts — generators handle absence by omission.

## Reconciliation

When the OM and the T12/rent roll state different values for the same
field (stated NOI vs computed NOI, stated occupancy vs rent-roll
occupancy), the **operating documents win** for `financials`; the OM value
is preserved under `omStated` so the memo can note it if material. Never
average conflicting values.

## Highlights vs risks

- `highlights[]` — marketing-facing claims, each traceable to an approved
  candidate. Rewrite OM framing into CRE Northstar voice-neutral facts
  (the generators apply voice); drop any highlight whose underlying
  number was rejected at the gate.
- `risks[]` — internal only. Consumed solely by the dd-checklist
  generator. **No generator other than dd-checklist may read `risks[]`**,
  and nothing in `risks[]` may be silently converted into a highlight.

## Grounding rule

Use only values present in the approved manifest and extracts. If a value
is missing, omit the field — never estimate, interpolate, or borrow from
general knowledge.
