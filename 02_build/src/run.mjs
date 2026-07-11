// CRE Northstar pipeline:
//   extract (3 parsers → manifest) → review gate → analyze (deal-facts)
//   → generate (content specs) → render (native files)
//
// Usage:
//   node src/run.mjs [--deal <id>] [--input <dir>] [--workflow <preset>]
//                    [--approve-all] [--from <step>]
//
// Presets come from 01_architecture/output/config/workflows.json
// (summary-only · quick-announce · web-presence · internal-prep · full-package).
// Without --approve-all the pipeline stops at the review gate so candidates
// can be reviewed/edited in runs/<deal>/manifest.json, then resume with
// --from analyze. After hand-editing a <output>.spec.json, re-run --from render.
import path from "node:path";
import { extract } from "./steps/extract.mjs";
import { review } from "./steps/review.mjs";
import { analyze } from "./steps/analyze.mjs";
import { generate } from "./steps/generate.mjs";
import { render } from "./steps/render.mjs";
import { usageSummary } from "./lib/client.mjs";
import { fixturesDir, archRoot, runDir } from "./lib/paths.mjs";
import { readJson } from "./lib/files.mjs";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

const dealId = arg("deal", "demo-001");
const inputDir = arg("input", fixturesDir);
const approveAll = process.argv.includes("--approve-all");
const workflowId = arg("workflow", "summary-only");
const from = arg("from", "extract");

const workflows = readJson(path.join(archRoot, "config/workflows.json"));
const workflow = workflows.workflows.find((w) => w.id === workflowId);
if (!workflow) {
  console.error(
    `unknown workflow "${workflowId}" (${workflows.workflows.map((w) => w.id).join(" | ")})`
  );
  process.exit(1);
}

const steps = ["extract", "review", "analyze", "generate", "render"];
const startAt = steps.indexOf(from);
if (startAt === -1) {
  console.error(`unknown --from step "${from}" (${steps.join(" | ")})`);
  process.exit(1);
}
const runStep = (name) => startAt <= steps.indexOf(name);

// Does a dot-path resolve to a value in deal-facts? Used to report which of
// the workflow's expected facts are absent (and therefore omitted).
function factPresent(facts, dotPath) {
  let cur = facts;
  for (const key of dotPath.split(".")) {
    if (cur == null || typeof cur !== "object" || !(key in cur)) return false;
    cur = cur[key];
  }
  return cur != null;
}

console.log(`CRE Northstar pipeline — deal ${dealId} · workflow ${workflow.id} (${workflow.outputs.length} outputs)\n`);
const t0 = Date.now();

if (runStep("extract")) await extract({ dealId, inputDir });

if (runStep("review")) {
  const manifest = review({ dealId, approveAll });
  const actionable = manifest.candidates.some(
    (c) => c.status === "approved" || c.status === "edited"
  );
  if (!actionable) process.exit(0); // gate is open — broker reviews, then --from analyze
}

if (runStep("analyze")) await analyze({ dealId });

// Absent facts never block a run — the values are omitted from every output
// (never estimated). requiredFacts is a reporting contract, not a gate.
const dealFacts = readJson(path.join(runDir(dealId), "deal-facts.json"));
const missing = (workflow.requiredFacts ?? []).filter((f) => !factPresent(dealFacts, f));
if (missing.length) {
  console.warn(
    `note: facts absent for ${workflow.id} (omitted from outputs, never estimated): ${missing.join(", ")}`
  );
}

if (runStep("generate")) await generate({ dealId, outputs: workflow.outputs });
if (runStep("render")) await render({ dealId, outputs: workflow.outputs });

const u = usageSummary();
console.log(
  `\ndone in ${((Date.now() - t0) / 1000).toFixed(0)}s — ${u.inputTokens} in / ${u.outputTokens} out tokens, ~$${u.estCostUsd}`
);
