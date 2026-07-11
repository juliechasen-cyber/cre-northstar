# Shared rules — all output generators

Prepended to every generator prompt by the harness. Individual generator
files contain only what is specific to that output.

## Inputs

- `deal-facts.json` — the only source of deal information.
- `brand-guidelines.md` — CRE Northstar brand system (colors, type, voice,
  chart rules).

## Grounding (non-negotiable)

Use only values present in `deal-facts.json`. If a value is missing, omit
the claim — never estimate, interpolate, round beyond the source, or borrow
from general knowledge. A wrong number in a broker's investor email is a
fired vendor. Do not read or reference `risks[]` — that array is reserved
for the due-diligence checklist.

## Voice

Professional, credible, restrained — institutional CRE, not consumer real
estate. No hype adjectives ("stunning", "incredible", "rare gem"), no
exclamation points, no emoji. Numbers carry the persuasion; let them.

## Formatting defaults

- Currency: `$4,250,000` (no decimals ≥ $10K); per-unit/PSF to the dollar.
- Percentages: one decimal (`94.5%`).
- Cap rate: two decimals (`5.75%`).
- Dates: `Month D, YYYY`.
- Property is referred to by its name on first mention, "the property"
  after.
