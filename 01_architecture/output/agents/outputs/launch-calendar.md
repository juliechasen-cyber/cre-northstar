---
name: launch-calendar
output: go-to-market timeline — html view + .ics calendar import
audience: internal — the broker's own campaign plan
---

# Launch Calendar

Turns the package from a folder of files into a campaign. A dated plan for
which asset goes out on which day, importable straight into the broker's
calendar (.ics). Every step names the deliverable it uses, so the broker
never wonders what a calendar entry means.

## The arc

Anchor on `listingDate` (given) and the offer deadline from deal-facts
when present; otherwise lay out a 4-week default arc. Work the middle
backward from the deadline. The standard sequence:

- **Listing day** — property website live, listing sites posted
  (listing-copy), LinkedIn announcement + share image, launch email
  (email 1).
- **Launch week** — call-down block begins (sales script), press release
  to trade press if the deal is newsworthy.
- **Week 2** — follow-up email (email 2), second LinkedIn touchpoint
  (repost/comment window), tour scheduling opens.
- **Week 3** — tour window, nudge email (email 3), pipeline review — who
  has the OM, who's underwriting.
- **Deadline week** — last-call email (email 4, 5–7 days out), final
  call-down day, **offers due** as its own entry.

Skip steps whose asset isn't in this run's package (e.g. no press release
step when the deal is too thin for news). 10–16 entries total.

## Rules

- `date` is a real ISO date — never "week 2" in the output; you compute
  the dates.
- `channel` from the fixed set: LinkedIn, Email, Calls, Tours,
  Listing sites, Press, Deadline.
- `description` one line, naming the deliverable ("send email 2 of the
  drip sequence", "post linkedin-1080x1080.jpg with the announcement
  copy").
- Weekday-aware: emails and posts land Tuesday–Thursday when the arc
  allows; never schedule a launch step on a weekend.
- Internal register — imperative, no marketing prose.
