---
name: rent-roll-parser
stage: ingestion
reads: Rent Roll (XLSX→CSV, CSV, or PDF)
writes: rent-roll extract (schemas/rent-roll.schema.json) + summary candidates → extraction manifest
adapted-from: ahacker-1/cre-acquisition-orchestrator rent-roll-parser (Apache 2.0 — see NOTICE.md)
---

# Rent Roll Parser

## Mission

Parse the rent roll into a structured unit-level extract, then aggregate it
into the summary numbers the marketing outputs need: unit mix, occupancy,
in-place vs market rent, gross potential rent, loss to lease.

## Column recognition

Rent rolls have no standard format. Map columns by scanning the first ~10
rows for a header row, using these aliases:

| Field | Possible headers |
|---|---|
| Unit ID | Unit, Unit #, Unit No, Apt, Apartment |
| Unit type | Type, Floorplan, Floor Plan, Bed/Bath, BR/BA |
| Sq ft | SF, SqFt, Sq Ft, Square Feet, Size |
| Market rent | Market, Market Rent, Asking Rent, Quoted Rent |
| Actual rent | Rent, Current Rent, Contract Rent, In-Place Rent, Actual |
| Status | Status, Occupancy, Occupied |
| Lease end | Lease End, Expiration, Expires |

Normalize unit types to `NBR/NBA` form ("2x2", "2Bed/2Bath", "B2" → "2BR/2BA";
studios → "Studio"). Strip `$` and commas from currency; parse to numbers.

## Aggregation

1. **Unit mix** — group by normalized type: count, % of total, avg SF, avg
   market rent, avg in-place rent, occupied count.
2. **Totals** — total units, occupied, vacant, physical occupancy rate,
   total SF.
3. **Income** — gross potential rent (annual + monthly), in-place rent
   (annual + monthly), loss to lease ($ and %), avg rent/SF.
4. **Lease expirations** — next 30/60/90 days, month-to-month count.

Write the full extract to `rent-roll.json`; write the aggregate values
(totals, income, occupancy) as candidates into the extraction manifest, each
with `source: {doc: "rent-roll", sheet, row}` pointing at the cells that
produced it (for aggregates, cite the data range).

## Known messes and how to handle them

- **Multiple rent columns** (Base / Additional / Total): prefer Total, else
  sum Base + Additional; record which in `note`.
- **Non-revenue statuses** ("Model", "Down", "Notice"): map to occupied /
  vacant / notice / non-revenue; exclude non-revenue units from occupancy.
- **Missing market rents:** emit no market-rent candidates; flag as a data
  gap in the manifest. Never backfill from comparable units — this tool
  markets the deal, and an estimated number must never look extracted.

## Validation (run before writing candidates)

1. Sum of unit-mix counts = total units.
2. Occupied + vacant (+ non-revenue) = total units.
3. No unit rent > 5× the average (flag as likely data error, confidence ≤ 0.5).
4. No unit SF > 3× the average (same treatment).

Failed validations lower confidence and add a `warning` — they never block
the pipeline; the broker sees them at the review gate.
