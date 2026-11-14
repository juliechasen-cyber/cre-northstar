---
noteId: "34bafb60e05411f1b258611ef0aa5bcb"
tags: []
name: "press-release-style"
role: "style reference appended to the press-release generator prompt"
source: "templates/press-releases/style-guide.md (workspace). Update the template first, then sync here. Anchors use the fictional demo deal."

---

# Press Release — Writing Style Reference

House style for every press release this product generates. Structure and
tone below; the deal's facts always come from deal-facts.json only.

## Structure (wire format)

1. `FOR IMMEDIATE RELEASE` — top line.
2. **Headline** — title case, bold, ≤ 90 chars. Front-load the numbers
   ("48-Unit", "$10.9 Million"). Use a superlative ("largest", "first",
   "rare") ONLY if it is grounded in an approved fact; then bound it
   ("the largest multifamily offering in the submarket this year" needs a
   sourced fact — otherwise no superlative at all).
3. **Deck** — italic, one sentence stating the significance the headline
   hints at. Goes in `subtitle`.
4. **Dateline lede** — `City, State (Month Day, Year) –` then the 5 Ws in
   ~30 words: who is bringing what to market, size, ask (or "unpriced"),
   the one distinguishing fact.
5. **Context ¶** — status, vintage, history, submarket position.
6. **Detail ¶** — concrete specs with exact numbers (units, SF, amenities,
   financial headlines). Numbers do the persuading, not adjectives.
7. **Quote — broker voice** — 2–3 sentences: one about the offering, one
   about the market. Marked `[DRAFT QUOTE — approve or edit]`. Attribution:
   `"…," said <Title>, <Name>.` — title before name, past tense.
8. **Industry-context ¶** — only if a term needs defining for a general
   business reader; skip otherwise.
9. **Process line** — offer process / how to get the OM.
10. **Boilerplate** — `[FIRM BOILERPLATE]` slot, never generated.
11. **Media contact block**, then `##` end marker as the last footer line.

## Tone

- Third person throughout; "we" only inside the quote (spoken voice).
- Active voice, past tense for attribution.
- Matter-of-fact news register. Confidence comes from numbers and named
  places, not adjectives. Adjectives are allowed inside the quote only.
- Sentence rhythm: short declarative for the claim, longer sentence for the
  specs. No contractions. No exclamation points, ever.

## Vocabulary

- Lead verbs: "announced", "brings to market", "listed".
- Specific numbers everywhere: "$4.5 million", "13 units", "15,174 square
  feet" — numerals for facts; ordinals may be spelled ("third").
- Name the geography: streets, submarkets, distances — geographic
  specificity reads as news.
- Banned: "revolutionary", "game-changing", "best-in-class", "world-class",
  "leading provider", "trusted partner", "leverage", "synergize".

## Style anchors — never reuse their names, numbers, or claims

These excerpts show the register to match. They are written for the
fictional demo deal (Hillcrest Gardens) and are style anchors only; every
fact in your output still comes from deal-facts.json.

Lead — who + what + amount + location, then the one distinguishing fact on
its own sentence so it lands:

> CRE Northstar today announced bringing to market the 48-unit, $10.95
> million Hillcrest Gardens Apartments at 4180 Terrace Crest Dr. in San
> Diego, CA. It is offered at a 6.33% cap rate on in-place income, with rents
> roughly 8% below market.

Quote — one sentence on the relationship/offering, one on the substance:

> "We are thrilled to bring Hillcrest Gardens to market and to offer
> investors an asset whose upside lives in the rent roll rather than a
> renovation program," said <Title>, <Name>.

Detail paragraph — specs stacked into one flowing sentence:

> …the 1987-vintage property features 20 two-bedroom units among its 48
> apartments along with 93.6% occupancy, $692,800 in trailing 12-month net
> operating income, and 41,280 square feet of building area.
