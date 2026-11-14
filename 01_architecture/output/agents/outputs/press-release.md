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

## Release types

The broker picks one of three types at generation time; the harness names
it in your instructions. Same wire format and grounding for all three —
what changes is the news event and the verb.

1. **`bringing-to-market`** (default) — exclusive listing announcement.
   Reaches high-net-worth investors, family offices, and 1031 exchange
   buyers; creates an indexed public record that surfaces when investors
   research the submarket, and establishes the broker's credibility. Lead
   verb family: "brings to market", "has been retained to sell",
   "announced the exclusive listing of".

2. **`coming-soon`** — pre-market release for a high-profile, generational,
   or unique asset, issued before official marketing materials circulate.
   The job is buzz and whisper-campaign momentum. No asking price unless
   deal-facts contains one AND the broker approved it for publication;
   "pricing guidance available upon qualification" is the default posture.
   Lead verb family: "will bring to market", "is preparing to offer".
   The distinguishing fact (why this asset is news *before* it lists)
   must lead.

3. **`just-sold`** — closed-transaction announcement, the most common
   type. Celebrates the milestone, proves the broker's execution to
   attract new listings, and highlights the key financial metrics that
   attract future capital. Lead verb family: "announced the sale of",
   "has closed". Closing facts not present in deal-facts (final sale
   price, buyer, closing date) are bracketed slots — `[SALE PRICE]`,
   `[BUYER NAME — confirm disclosure]`, `[CLOSING DATE]` — never
   invented, and buyer identity is always flagged for a disclosure
   check.

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
