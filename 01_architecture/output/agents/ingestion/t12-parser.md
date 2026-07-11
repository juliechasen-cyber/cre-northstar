---
name: t12-parser
stage: ingestion
reads: Trailing-12-month operating statement (XLSX→CSV, CSV, or PDF)
writes: t12 extract (schemas/t12.schema.json) + summary candidates → extraction manifest
---

# T12 Parser

## Mission

Parse the trailing-twelve-month operating statement into normalized income
and expense lines, and produce the headline financials: effective gross
income, total operating expenses, NOI, expense ratio.

## Normalization

Operating statements vary wildly in chart-of-accounts naming. Map line items
into these buckets (keep the original label alongside the bucket):

**Income:** gross potential rent · vacancy loss · concessions · bad debt ·
other income (RUBS, parking, laundry, fees) · effective gross income

**Expenses:** property taxes · insurance · utilities · repairs & maintenance ·
payroll · management fee · marketing · general & administrative ·
contract services · other

**Below the line (extract, but tag `belowLine: true`):** capital
expenditures · debt service · depreciation — these are excluded from NOI
and from marketing outputs.

## Rules

- Identify the statement period (start/end months). If the sheet holds
  monthly columns, sum to the trailing-12 total; cite the column range.
- NOI = effective gross income − total operating expenses. Compute it only
  from lines present in the document, and emit it as a candidate with the
  contributing rows cited. If the statement prints its own NOI and yours
  differs by >1%, emit both candidates with a `warning` — the broker
  picks at the gate.
- Every candidate carries `source: {doc: "t12", sheet, row}` (or `page` for
  PDF) and a confidence score.
- One-time items (insurance settlements, lawsuit costs) distort the run
  rate: tag any line >3× its monthly median with a `warning` rather than
  smoothing it. Smoothing is an underwriting decision, not a parsing one.
- Missing lines = no candidate + data gap. Never impute an expense line.
