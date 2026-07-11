# PRD — CRE Northstar

> **Status:** DRAFT (2026-07-05) · **Owner:** Julie Chasen · **Client:** self (venture)

---

## 1. Goal

Build an AI-powered deal-marketing workflow for commercial real estate
brokers. Broker uploads the raw deal documents; the tool analyzes them and
produces the full package of investment marketing collateral a broker
normally spends days assembling by hand.

CRE Northstar is the working proof that Julie can bridge institutional CRE
practice and applied AI — the tool itself is the credibility.

---

## 2. Core Workflow

```
Broker uploads:
  • Offering Memorandum (OM)
  • Rent Roll
  • T12 (trailing twelve months financials)
  • Property photos
        ↓
   AI analyzes everything
        ↓
   Generates deliverable package (§4)
```

One-shot workflow. No dashboards to configure, no accounts to set up before
seeing value. Upload → results.

---

## 3. Audience

- **Primary user:** CRE brokers marketing a deal — the person who currently
  spends 3–5 days per listing assembling marketing materials
- **Secondary user:** principals / sponsors packaging their own deals for
  investors
- **Not for:** consumer / residential / retail-investor audiences, LP-side
  underwriting workflows

---

## 4. Deliverables (tool outputs)

Every input package produces the following, ready to send or lightly edit:

| # | Output | Format |
|---|---|---|
| 1 | Investment Summary | PDF / 1-pager |
| 2 | Executive Memo | PDF / narrative |
| 3 | LinkedIn announcement post | copy + suggested image |
| 4 | Investor email | subject line + body |
| 5 | PowerPoint OM | editable .pptx |
| 6 | Property website | hosted single-page site |
| 7 | Press release | copy |
| 8 | Due diligence checklist | structured list |
| 9 | CRM entry | structured record |

Voice, layout, and data hierarchy all follow the CRE Northstar brand
system ([brand-guidelines.md](brand-guidelines.md)) so every output ships
looking like it came from the same institution.

---

## 5. Out of Scope (v1)

- User accounts, subscription tiers, billing — v1 is a working tool, not a
  SaaS company
- Consumer / residential real estate
- Julie writing production code — she owns product, positioning, voice,
  and brand; engineering is delegated
- Replacing / rebranding Julie's personal practice
  ([juliechasen.com](https://juliechasen.com))
- Multi-deal portfolios, LP dashboards, investor-side tooling — v1 is
  single-deal, broker-side only

---

## 6. Success Criteria

At 90 days from first working demo:

- [ ] A broker can upload OM + Rent Roll + T12 + photos and receive all 9
  outputs in under 15 minutes
- [ ] Outputs are usable with light edits — not full rewrites
- [ ] At least 3 CRE professionals have run a real deal through the tool
  and given feedback
- [ ] Julie can point a prospect to a live demo without caveating
- [ ] One documented learning about which of the 9 outputs brokers actually
  care about most

---

## 7. Timeline

| Milestone | Target | Status |
|---|---|---|
| Brand + positioning locked | 2026-07-15 | tagline + positioning open |
| Technical architecture drafted | 2026-07-05 | ✅ done — [01_architecture/output/](01_architecture/output/ARCHITECTURE.md) |
| Engineering partner decided | 2026-07-15 | open |
| Working demo — 1 output (Investment Summary, `summary-only` workflow) | TBD | not started |
| Working demo — all 9 outputs | TBD | blocked on above |
| First broker runs a real deal | +30d after demo | — |
| First learning captured | +30d after first broker | — |

---

## 8. Open Questions

- [ ] **Tagline** and one-sentence positioning — **owner:** Julie
- [ ] **Category name** — "AI platform" / "studio" / "workflow" / "tool" — **owner:** Julie
- [ ] **Engineering partner** — who builds against [01_architecture/output/](01_architecture/output/ARCHITECTURE.md)? — **owner:** Julie
- [ ] **Distribution model** — free demo → paid pilot? White-label to brokerages? Julie's own service offering with the tool as the engine? — **owner:** Julie
- [x] **Priority output** — Investment Summary is v0.1 (`summary-only` workflow preset) — decided 2026-07-05
- [ ] **Domain** — crenorthstar.com or similar? — **owner:** Julie
- [ ] **Email address** for the brand — **owner:** Julie
- [ ] **LinkedIn presence** — new company page or run through Julie's personal? — **owner:** Julie
- [ ] **Logo source files** — SVG + PNG (512, 1024) into `assets/logo/` — **owner:** Julie

---

## 9. References

- [CONTEXT.md](CONTEXT.md) — client context and open items
- [brand-guidelines.md](brand-guidelines.md) — brand system
- [01_architecture/output/ARCHITECTURE.md](01_architecture/output/ARCHITECTURE.md) — technical architecture + engineering handoff (agent prompts, schemas, workflow presets)
- Design source: [ahacker-1/cre-acquisition-orchestrator](https://github.com/ahacker-1/cre-acquisition-orchestrator) (Apache 2.0) — 4 patterns adapted, see [NOTICE](01_architecture/output/NOTICE.md)
- Visual reference: [rockco.com](https://www.rockco.com) — institutional restraint
- Template: [templates/frameworks/PRD-template.md](../../templates/frameworks/PRD-template.md)
