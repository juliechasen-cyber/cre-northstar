import path from "node:path";
import { fileURLToPath } from "node:url";

// 02_build/ project root
export const buildRoot = fileURLToPath(new URL("../..", import.meta.url));

// 01_architecture/output — agents, schemas, config live there; the build
// consumes them read-only so Julie keeps owning the prompts as .md files.
export const archRoot = path.resolve(buildRoot, "../01_architecture/output");
export const agentsRoot = path.join(archRoot, "agents");
export const schemasRoot = path.join(archRoot, "schemas");

// brand-guidelines.md lives at the client root
export const brandGuidelines = path.resolve(buildRoot, "../brand-guidelines.md");

export const fixturesDir = path.join(buildRoot, "fixtures");
export const runsDir = path.join(buildRoot, "runs");

export function runDir(dealId) {
  return path.join(runsDir, dealId);
}
