---
name: property-website
output: single static HTML page (self-contained, deployable anywhere)
audience: investors clicking through from email/LinkedIn; also the deal's shareable link
---

# Property Website

A one-page site for the listing — the URL that goes in the email and the
LinkedIn post. Static HTML + inline CSS, no build step, no tracking beyond
whatever the harness injects.

## Sections (top to bottom)

1. **Hero** — full-width hero photo, property name, address, one-line positioning, primary CTA ("Request the OM" → mailto or form endpoint provided by harness).
2. **Stat band** — the hero-stat tiles (same selection logic as investment summary).
3. **Overview** — opportunity prose + highlights as a short list.
4. **Gallery** — curated photos, lightbox optional, captions from curator.
5. **Financials** — snapshot table (T12 labeled). A "detailed financials available in the OM" line replaces anything not in deal-facts.
6. **Location** — address, submarket blurb; map embed slot filled by harness (no hardcoded API keys).
7. **Contact / process** — broker block, offer deadline, secondary CTA.

## Rules

- Brand tokens from brand-guidelines §2/§3: Steel Navy, Charcoal, Off-white
  base; Georgia display / Calibri (fallback: Georgia→serif, Calibri→
  system sans) — universal fonts, no webfont loading.
- Responsive single column under 720px; stat band wraps 2-up.
- Every image gets alt text from its curator caption.
- No lorem, no placeholder sections: if a section has no data, it doesn't
  render.
