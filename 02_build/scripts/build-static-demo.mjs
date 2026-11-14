// Exports the fictional demo deal room as a static site in ../docs/demo/
// for GitHub Pages: same dashboard, server calls answered from local files.
//   node scripts/build-static-demo.mjs
import fs from "node:fs";
import path from "node:path";
import { archRoot, buildRoot, runDir } from "../src/lib/paths.mjs";

const out = path.resolve(buildRoot, "../docs/demo");
const dealOut = path.join(out, "demo-deal");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(dealOut, { recursive: true });

for (const f of fs.readdirSync(runDir("demo-deal"))) {
  if (f !== "job.json") fs.copyFileSync(path.join(runDir("demo-deal"), f), path.join(dealOut, f));
}
const job = fs.readFileSync(path.join(runDir("demo-deal"), "job.json"), "utf8");
fs.writeFileSync(path.join(dealOut, "job.json"), job.replaceAll("/runs/demo-deal/", "demo-deal/"));

const { workflows } = JSON.parse(fs.readFileSync(path.join(archRoot, "config/workflows.json"), "utf8"));
fs.writeFileSync(path.join(out, "workflows.json"),
  JSON.stringify(workflows.map(({ id, name, summary, outputs }) => ({ id, name, summary, outputs }))));

const shim = `<style>#unlock{display:none}</style>
<script>
(() => {
  const realFetch = window.fetch.bind(window);
  window.fetch = (input, opts) => {
    const u = typeof input === "string" ? input : input.url;
    if (u.startsWith("/api/workflows")) return realFetch("workflows.json");
    if (u.startsWith("/api/demo")) return realFetch("demo-deal/job.json");
    if (u.startsWith("/runs/demo-deal/")) return realFetch(u.slice("/runs/".length));
    if (u.startsWith("/api/")) return Promise.resolve(new Response('{"error":"static demo"}', { status: 401 }));
    return realFetch(input, opts);
  };
  if (!location.hash) location.hash = "demo";
})();
</script>
<script>`;

const swaps = [
  ["<script>", shim],
  [/<div class="live-badge">.*?<\/div>/s,
    `<div class="live-badge"><b>ONLINE DEMO</b> — a fictional deal, pre-generated. Clone the repo to run the real pipeline on your own documents.</div>`],
  ["This action needs an access code — the demo deal room below is free to explore.",
    "This online demo can't process documents — clone the repo to run your own deal. The demo deal room is free to explore."],
  ["Enter your access code (left) to run your own deal.", "Clone the repo to run your own deal."],
];
let html = fs.readFileSync(path.join(buildRoot, "src/server/dashboard.html"), "utf8");
for (const [from, to] of swaps) {
  const next = html.replace(from, to);
  if (next === html) throw new Error(`dashboard.html changed — could not find: ${from}`);
  html = next;
}
fs.writeFileSync(path.join(out, "index.html"), html);
console.log(`static demo → ${path.relative(process.cwd(), out)}`);
