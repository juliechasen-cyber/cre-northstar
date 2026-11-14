import fs from "node:fs";
import path from "node:path";
import { jsonCall, textBlock } from "../lib/client.mjs";
import { loadPrompt, readJson, writeJson } from "../lib/files.mjs";
import { agentsRoot, brandGuidelines, runDir } from "../lib/paths.mjs";
import { REGISTRY } from "../outputs/registry.mjs";

const PARALLEL = 4; // parallel generator calls per wave — polite to rate limits

// Run the generators named in `outputs` against deal-facts, writing one
// editable <name>.spec.json each. Grounding enforced in code, not just
// prompt: risks[] reaches only generators flagged includeRisks (dd-checklist);
// manifest data gaps only those flagged includeGaps.
export async function generate({ dealId, outputs, options = {} }) {
  const outDir = runDir(dealId);
  const dealFacts = readJson(path.join(outDir, "deal-facts.json"));
  const manifest = readJson(path.join(outDir, "manifest.json"));

  const marketingFacts = { ...dealFacts };
  delete marketingFacts.risks;

  const shared = loadPrompt(agentsRoot, "outputs/_shared-rules.md");
  const brand = fs.readFileSync(brandGuidelines, "utf8");
  const nowIso = new Date().toISOString();

  const produced = [];
  const skipped = [];

  // One failed output never sinks the package — it's skipped with a reason
  // and reported; the broker can regenerate to retry it.
  async function runOne(name) {
    try {
      const entry = REGISTRY[name];
      if (!entry) throw new Error(`unknown output "${name}"`);

      const facts = entry.includeRisks ? dealFacts : marketingFacts;
      const blocks = [textBlock(`## deal-facts.json\n${JSON.stringify(facts, null, 1)}`)];
      if (entry.includeGaps)
        blocks.push(
          textBlock(`## Data gaps from the extraction manifest\n${JSON.stringify(manifest.dataGaps ?? [], null, 1)}`)
        );

      const system =
        shared +
        "\n\n" +
        loadPrompt(agentsRoot, entry.prompt) +
        (entry.stylePrompt ? "\n\n" + loadPrompt(agentsRoot, entry.stylePrompt) : "") +
        "\n\n## Brand guidelines\n\n" +
        brand +
        entry.contract +
        (name === "press-release" && options.pressReleaseType
          ? `\n\n## Release type for this run\n\nThe broker selected "${options.pressReleaseType}". Write that release per the Release types section of your instructions.`
          : "") +
        `\n\nGiven values: dealId "${dealId}", generatedAt "${nowIso}", listingDate "${nowIso.slice(0, 10)}".`;

      const spec = await jsonCall({ label: name, system, userBlocks: blocks });
      writeJson(path.join(outDir, `${name}.spec.json`), spec);
      produced.push(name);
    } catch (e) {
      console.warn(`  [${name}] skipped: ${e.message}`);
      skipped.push({ name, error: e.message });
    }
  }

  console.log(`generate: ${outputs.length} outputs (waves of ${PARALLEL})…`);
  for (let i = 0; i < outputs.length; i += PARALLEL) {
    await Promise.all(outputs.slice(i, i + PARALLEL).map(runOne));
  }
  if (skipped.length) console.warn(`generate: skipped ${skipped.map((s) => s.name).join(", ")}`);
  console.log(`generate: content specs → ${outDir}/*.spec.json`);
  return { produced, skipped };
}
