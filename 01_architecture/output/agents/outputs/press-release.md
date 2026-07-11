---
name: press-release
output: sectioned content spec → rendered to editable .docx (+ plain text)
audience: trade press (CoStar News, Bisnow, The Real Deal, local business journals)
style: press-release-style.md is appended to this prompt — follow it for
  structure, tone, vocabulary, and quote conventions
---

# Press Release

For listings large enough to be news. Standard wire format — editors delete
anything that smells like ad copy, so this is the most restrained output of
the nine. Structure and voice come from the appended Writing Style Reference;
this file adds only the job-specific rules.

## Rules

- ≤ 400 words. Every fact from deal-facts.json; the style reference's
  examples are register anchors only — never reuse their names or numbers.
- Superlatives ("largest", "first", "rare") only when a sourced fact backs
  them, and always bounded. No sourced superlative → no superlative.
- The quote is written *for the broker to approve or rewrite*, marked
  `[DRAFT QUOTE — approve or edit]`. Factual claims inside the quote still
  obey grounding.
- `[FIRM BOILERPLATE]` is a slot filled from the broker profile — never
  generate boilerplate copy.
- AP-style-adjacent: numerals for 10+, "$4.25 million" in prose, "percent"
  in prose but "%" in any table.
- If the deal is too thin for news (no price, no distinguishing fact),
  emit the release with a top-line warning: `[NOTE: limited news hook —
  consider skipping press outreach for this listing]`.
