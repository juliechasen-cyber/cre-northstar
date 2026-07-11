# CRE Northstar

Julie's own venture — "the north star" — CRE + AI focus, in development.

## Status

New venture (as of 2026-07-05). Brand guidelines drafted at [brand-guidelines.md](brand-guidelines.md).

## What we know

- **Name:** CRE Northstar. "Northstar" is one word.
- **What it is:** AI-powered deal-marketing workflow for CRE brokers. Broker uploads OM + Rent Roll + T12 + photos; the tool generates 9 marketing outputs (Investment Summary, Executive Memo, LinkedIn post, investor email, PowerPoint OM, property website, press release, DD checklist, CRM entry). See [PRD.md](PRD.md).
- **Audience:** primary = CRE brokers marketing deals; secondary = principals packaging their own deals.
- **Look & feel reference:** [rockco.com](https://www.rockco.com) — institutional, restrained, polished.
- **Voice direction:** professional, credible, restrained. No playful or unprofessional tone.
- **Colors:** 7 official (Steel Navy, Charcoal, Lime, Teal, Gray, Mist, Off-white). Aquamarine removed. See brand-guidelines.md §2.
- **Type:** Georgia headlines, Calibri body — universal system fonts.
- **Logo:** compass rose / north star mark, paired with **NORTHSTAR** wordmark (Georgia 700, all caps, Steel Navy). "CRE" is a sector prefix used in long-form contexts, not part of the visual signature.
- **Photography:** buildings and people. Architectural / editorial for buildings; professional context for people. No stock warmth.
- **Charts & data viz:** Steel Navy → Teal → Lime → Charcoal → Gray series order; Georgia hero numbers; Tufte-style restraint. See brand-guidelines.md §6.

## Structure

Follow workspace conventions:
- Stages: `NN_short-name/` (e.g. `01_discovery/`, `02_strategy/`)
- Each stage owns its `output/` — that's the handoff to the next stage
- Finished deliverables → `deliverables/`

Current stages:
- `01_architecture/output/` — technical architecture + engineering handoff: 14 agent prompts (markdown-native), 6 JSON schemas, workflow presets, [ARCHITECTURE.md](01_architecture/output/ARCHITECTURE.md). Patterns adapted (with attribution) from [ahacker-1/cre-acquisition-orchestrator](https://github.com/ahacker-1/cre-acquisition-orchestrator), Apache 2.0.

## Open items

- [ ] **Logo source files** — Julie needs to drop the compass rose SVG (and PNG at 512 / 1024) into `assets/logo/`. Claude has seen the image in-chat but can't save the source file from the conversation.
- [ ] **Tagline** and one-sentence positioning
- [ ] **What CRE Northstar is called categorically** — "AI platform" / "studio" / "workflow" / "tool"? Revisit as positioning firms up.
- [ ] **Engineering partner** — who builds against the architecture handoff at [01_architecture/output/](01_architecture/output/ARCHITECTURE.md)? Julie owns product, voice, brand, and the agent prompt files; the pipeline code is delegated.
- [ ] **Distribution model** — free demo → paid pilot? White-label to brokerages? Julie's own service offering with the tool as the engine?
- [x] **v0.1 scope** — Investment Summary first (`summary-only` workflow) — decided 2026-07-05.
- [ ] **Domain / URL** — is there a `crenorthstar.com` or similar?
- [ ] **Email address** for the brand
- [ ] **Voice specifics** — beyond "professional, restrained," any signature words to always or never use?
