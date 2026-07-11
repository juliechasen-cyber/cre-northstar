# CRE Northstar — Technical Architecture (v1)

> **Status:** DRAFT (2026-07-05) · **Owner:** Julie Chasen (product/brand/prompts) · **Builder:** engineering partner (TBD)
> This folder is the engineering handoff. Everything a builder needs to scope and start the v0.1 build is here.

---

## 1. What we're building

An AI deal-marketing workflow for CRE brokers. A broker uploads four raw
inputs — Offering Memorandum, Rent Roll, T12, property photos — and gets
back 9 pieces of ready-to-send marketing collateral. Full product context:
[../../PRD.md](../../PRD.md).

```
UPLOAD                    EXTRACT                 APPROVE                ANALYZE              GENERATE (fan-out)
──────                    ───────                 ───────                ───────              ──────────────────
OM (pdf)        ──┐   ┌── om-parser        ──┐                                            ┌─ investment-summary
Rent Roll (xlsx)──┼──▶├── rent-roll-parser ──┼─▶ extraction     ──▶ BROKER        ──▶ deal-┼─ executive-memo
T12 (xlsx/pdf)  ──┤   ├── t12-parser       ──┤   manifest           REVIEWS &         facts┼─ linkedin-announcement
Photos (jpg)    ──┘   └── photo-curator    ──┘   (candidates w/     APPROVES          .json┼─ investor-email
                                                  provenance)        each field             ├─ pptx-om
                                                                                            ├─ property-website
                                                                                            ├─ press-release
                                                                                            ├─ dd-checklist
                                                                                            └─ crm-entry
```

Key properties of the design:

- **One approval gate, not many.** Extracted numbers do not reach any
  generator until the broker approves them. After approval, all 9 outputs
  generate in parallel with no further human steps.
- **One source of truth.** Every generator reads only `deal-facts.json`
  (plus the brand system). Generators never see the raw documents, so a
  number can't leak into a LinkedIn post without passing the gate.
- **Prompts are content, not code.** Every agent is a markdown file in
  `agents/`. Julie owns and edits these directly; engineering owns the
  pipeline that runs them. Do not inline prompts into application code.

---

## 2. Design sources & attribution

Four patterns are adapted from
[ahacker-1/cre-acquisition-orchestrator](https://github.com/ahacker-1/cre-acquisition-orchestrator)
(Apache 2.0 — see [NOTICE.md](NOTICE.md)):

| Pattern | What we took | What we deliberately dropped |
|---|---|---|
| Document ingestion | Per-document-type parser agents (their `rent-roll-parser` / `financials-parser` / `offering-memo-parser` split); header-mapping and normalization logic | Their document-orchestrator layer — 4 parsers don't need routing |
| Evidence / provenance | Every extracted value carries `{source doc, page/sheet/row, confidence}`; candidates live in an extraction manifest until approved | Their 3-tier crash-resumable checkpoint system — built for IC audit defense, wrong weight for a marketing tool |
| Approval checkpoint | "Extracted fields don't flow downstream until the operator approves/edits/rejects them" — this is the core trust mechanic | Multiple review gates per phase — we have exactly one |
| Markdown-native prompts + JSON schemas | All agent behavior in `.md` files; JSON Schema contracts on structured data; `workflows.json` presets | Their 31-agent / 6-orchestrator / 5-phase dependency DAG — our shape is a simple fan-out |

**Not borrowed:** their phase-gate orchestration (DD→UW→FIN→LEG→CLO). Their
tool reasons *sequentially* across an acquisition; ours fans out 9 outputs
from one approved fact base. If the build starts sprouting orchestrators,
something has gone wrong.

---

## 3. Folder map (this handoff)

```
output/
├── ARCHITECTURE.md            ← you are here
├── NOTICE.md                  ← Apache 2.0 attribution
├── agents/
│   ├── ingestion/             ← 4 parsers: raw doc → extraction manifest candidates
│   ├── analysis/              ← 1 agent: approved candidates → deal-facts.json
│   └── outputs/               ← 9 generators: deal-facts.json → collateral
├── schemas/                   ← JSON Schema contracts for every structured artifact
└── config/
    └── workflows.json         ← output presets + per-output required facts
```

Related, outside this folder:
- [../../brand-guidelines.md](../../brand-guidelines.md) — colors, type, voice, chart rules. Generators reference it; the pptx/website generators consume its tokens.

---

## 4. Data contracts

| Artifact | Schema | Produced by | Consumed by |
|---|---|---|---|
| Extraction manifest | `schemas/extraction-manifest.schema.json` | 4 ingestion parsers | Review UI, deal-analyst |
| Rent roll extract | `schemas/rent-roll.schema.json` | rent-roll-parser | deal-analyst |
| T12 extract | `schemas/t12.schema.json` | t12-parser | deal-analyst |
| **Deal facts** (the spine) | `schemas/deal-facts.schema.json` | deal-analyst | all 9 generators |
| DD checklist | `schemas/dd-checklist.schema.json` | dd-checklist generator | broker (internal) |
| CRM entry | `schemas/crm-entry.schema.json` | crm-entry generator | broker's CRM |

Narrative outputs (memo, LinkedIn, email, press release) are deliberately
**not** schematized — forcing prose through JSON kills the voice. Their
contract is the format section of their prompt file.

### The approval gate (build spec)

1. Parsers write **candidate fields** into the extraction manifest. Every
   candidate: `{id, field, value, source: {doc, page|sheet, row?, col?}, confidence, status: "extracted"}`.
2. The review UI shows candidates grouped by section, with source location
   and confidence. Broker can **approve**, **edit** (edited value keeps a
   pointer to the original), or **reject** each.
3. Generation is blocked until every fact listed in the selected workflow's
   `requiredFacts` (see `config/workflows.json`) has status `approved` or
   `edited`.
4. deal-analyst assembles `deal-facts.json` from approved/edited candidates
   only. Rejected and unreviewed candidates never leave the manifest.

### Editing & export model (non-negotiable product requirement)

Brokers must never have to copy-paste out of a PDF. Two editing modes, one
mechanism:

1. **Generators emit editable content specs, never final binaries.**
   Prose documents (memo, press release, investment summary, email) →
   structured markdown/JSON sections. Deck → slide-spec JSON. Website →
   section spec. These specs are stored per deal and are the *editable
   source of truth* for every output.
2. **Dashboard editing = editing the content spec.** The review UI grows a
   per-output edit view: plain text fields per section/slide slot, tables
   as tables. Edits re-render the preview instantly. **Do not build a
   browser PowerPoint/Word clone** — brokers edit *content* in the
   dashboard; *design* is enforced by the render templates and is not
   editable there (that's a feature: dashboard edits can't go off-brand).
3. **Downloads are native, editable files rendered on demand:**

   | Output | Download format(s) |
   |---|---|
   | PowerPoint OM | `.pptx` — real text boxes and native tables, never text-in-images |
   | Executive memo, press release, investment summary | `.docx` with proper Word styles (+ send-ready PDF alongside) |
   | Financial data pack | `.xlsx` — rent roll extract, T12 lines, unit mix, each on its own sheet with real formulas for totals (rendered by the harness from the extracts; no generator needed) |
   | DD checklist | `.xlsx` checklist (+ `.docx` and the JSON for tooling) |
   | Investor email | copy-to-clipboard + `.html` |
   | LinkedIn post | copy-to-clipboard |
   | Property website | published page + downloadable `.html` |

   Once downloaded, the broker owns the file — full offline editing in
   PowerPoint/Word with zero platform dependency.
4. **Render fidelity is a hard acceptance criterion:** open the `.pptx` in
   PowerPoint and every text element must be selectable/editable; open the
   `.docx` in Word and headings/tables must use real styles (so the
   broker's own template restyling works). If a renderer produces
   flattened images of text, it fails review.

Sequencing: v0.1 ships generate → download native file (no dashboard
editing yet); the content-spec architecture means in-dashboard editing is
a UI layer added later, not a rework.

### The grounding rule (non-negotiable)

Every generator prompt carries this rule, and the harness should treat a
violation as a bug:

> Use only values present in `deal-facts.json`. If a value is missing, omit
> the claim — never estimate, interpolate, or borrow from general knowledge.
> A wrong number in a broker's investor email is a fired vendor.

---

## 5. Runtime recommendation

Keep the harness thin. This is a pipeline, not a framework project.

- **Stack:** TypeScript/Node (or Python — builder's choice), official
  Anthropic SDK, no agent framework. The whole runtime is: run 4 parsers in
  parallel → persist manifest → wait for approval → run deal-analyst → run
  9 generators in parallel → package.
- **Model:** `claude-opus-4-8` throughout. Extraction accuracy is the
  product's trust foundation and generation quality is its face — don't
  economize here in v1. Revisit per-stage model choice only after evals exist.
- **Extraction calls:** send the document (Files API / base64 PDF) with the
  parser prompt; enforce the extract schemas via structured outputs
  (`output_config.format` with `json_schema`, or `messages.parse()`). This
  guarantees parseable candidates.
- **Doc inputs:** PDFs go to the API natively; XLSX rent rolls/T12s should be
  converted to CSV per sheet before the parser call (deterministic, cheap,
  avoids spreadsheet-parsing hallucinations).
- **Photos:** vision input to photo-curator; originals pass through to the
  pptx/website steps untouched.
- **Rendering:** `.pptx` via pptxgenjs (Node) or python-pptx from the
  pptx-om generator's slide JSON; `.docx` via the `docx` npm package or
  python-docx from prose content specs; `.xlsx` via exceljs or openpyxl
  from the rent-roll/T12 extracts; property website is a static single
  page (host anywhere); PDFs via headless-Chrome print of HTML templates —
  PDFs are always the *send-ready companion*, never the only format.

## 6. v0.1 scope

Full pipeline depth, minimal width: **upload → extract → approve →
Investment Summary only** (workflow preset `summary-only`). This exercises
every architectural piece — parsers, manifest, gate, deal-facts, one
generator, one renderer — so adding the other 8 outputs is prompt work, not
plumbing work.

## 7. Open engineering decisions

- [ ] Hosting/runtime (single VM? serverless? local-first like the reference repo?)
- [ ] Review UI shape — minimal web page is fine; the gate matters, the chrome doesn't
- [ ] Property-website hosting + custom-domain story
- [ ] CRM target — v1 emits schema-shaped JSON; first real integration TBD (broker CRMs: HubSpot? RealNex? Buildout?)
- [ ] Eval harness — the reference repo's `npm run eval` pattern (synthetic deals with known answers) is worth copying once outputs stabilize
