// CRE Northstar local dashboard server (v0.2) — the real product loop on
// your own machine: upload documents → extract → review gate → generate →
// download. Binds to localhost only; nothing leaves the machine except the
// Anthropic API calls the pipeline itself makes.
//
//   npm run dashboard   →   http://localhost:4820
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import busboy from "busboy";
import { extract } from "./steps/extract.mjs";
import { analyze } from "./steps/analyze.mjs";
import { generate } from "./steps/generate.mjs";
import { render } from "./steps/render.mjs";
import { usageSummary } from "./lib/client.mjs";
import { readJson, writeJson } from "./lib/files.mjs";
import { archRoot, runsDir, runDir } from "./lib/paths.mjs";

const PORT = 4820;
const dashboardHtml = path.join(path.dirname(fileURLToPath(import.meta.url)), "server", "dashboard.html");
const workflows = readJson(path.join(archRoot, "config/workflows.json"));

// Job state per deal: { phase, detail, error, notes, assetLinks, costUsd }
// phases: uploading → extracting → review → analyzing → generating → done
// Kept in memory and mirrored to runs/<deal>/job.json so a browser can
// re-attach after a server restart (#deal= hash on the dashboard).
const jobs = new Map();
const setJob = (dealId, patch) => {
  const job = { ...(jobs.get(dealId) ?? {}), ...patch };
  jobs.set(dealId, job);
  try {
    writeJson(path.join(runDir(dealId), "job.json"), job);
  } catch {}
  return job;
};
const TRANSIENT = new Set(["uploaded", "extracting", "analyzing", "generating"]);
const getJob = (dealId) => {
  if (jobs.has(dealId)) return jobs.get(dealId);
  try {
    const job = readJson(path.join(runDir(dealId), "job.json"));
    // a transient phase from a previous server process can never finish
    if (TRANSIENT.has(job.phase)) {
      if (fs.existsSync(path.join(runDir(dealId), "manifest.json"))) {
        job.phase = "review";
        job.error = "The server restarted mid-run. Your documents and review are saved — hit Generate to continue.";
      } else {
        job.phase = "error";
        job.error = "The server restarted before your documents finished processing — please upload them again.";
      }
    }
    jobs.set(dealId, job);
    return job;
  } catch {
    return null;
  }
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function sendJson(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data ? JSON.parse(data) : {}));
    req.on("error", reject);
  });
}

function factPresent(facts, dotPath) {
  let cur = facts;
  for (const key of dotPath.split(".")) {
    if (cur == null || typeof cur !== "object" || !(key in cur)) return false;
    cur = cur[key];
  }
  return cur != null;
}

// --- upload: multipart with files om / rentRoll / t12 (docs) + photo1..4
// and logo (brand assets), field dealName. Brand assets get processed by
// steps/extract.mjs after the main parser wave. ---
function handleUpload(req, res) {
  const bb = busboy({ headers: req.headers, limits: { fileSize: 30 * 1024 * 1024, files: 9 } });
  let dealName = "";
  const saved = {};
  const pending = [];
  // stage files to a temp dir until we know the deal name → final dealId dir
  const tmpDir = fs.mkdtempSync(path.join(runsDir, ".upload-"));

  const targets = {
    om: { base: "offering-memo", exts: [".pdf"], subdir: "" },
    rentRoll: { base: "rent-roll", exts: [".xlsx", ".csv"], subdir: "" },
    t12: { base: "t12", exts: [".xlsx", ".csv"], subdir: "" },
    photo1: { base: "photo-01", exts: [".jpg", ".jpeg", ".png"], subdir: "photos" },
    photo2: { base: "photo-02", exts: [".jpg", ".jpeg", ".png"], subdir: "photos" },
    photo3: { base: "photo-03", exts: [".jpg", ".jpeg", ".png"], subdir: "photos" },
    photo4: { base: "photo-04", exts: [".jpg", ".jpeg", ".png"], subdir: "photos" },
    logo: { base: "logo", exts: [".png", ".jpg", ".jpeg"], subdir: "" },
  };

  bb.on("field", (name, val) => { if (name === "dealName") dealName = val; });
  bb.on("file", (name, file, info) => {
    const target = targets[name];
    const ext = path.extname(info.filename || "").toLowerCase();
    if (!target || !target.exts.includes(ext)) {
      file.resume(); // drain and ignore unsupported slot/type
      return;
    }
    const dest = path.join(tmpDir, `${target.base}${ext}`);
    const ws = fs.createWriteStream(dest);
    file.pipe(ws);
    pending.push(
      new Promise((resolve, reject) => {
        ws.on("finish", () => { saved[name] = { file: info.filename, stored: dest, subdir: target.subdir }; resolve(); });
        ws.on("error", reject);
        file.on("limit", () => reject(new Error(`${info.filename} exceeds the 30 MB upload limit`)));
      })
    );
  });
  bb.on("close", async () => {
    try {
      await Promise.all(pending);
      const hasDoc = saved.om || saved.rentRoll || saved.t12;
      if (!hasDoc) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        return sendJson(res, 400, { error: "no supported documents received (PDF for the OM; XLSX/CSV for rent roll and T12)" });
      }
      const slug = (dealName || "deal").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "deal";
      // minute-precision stamp + collision suffix — same-named deals must never share a folder
      const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
      let dealId = `${slug}-${stamp}`;
      if (fs.existsSync(runDir(dealId))) dealId += `-${Math.random().toString(36).slice(2, 5)}`;
      const inputDir = path.join(runDir(dealId), "inputs");
      fs.mkdirSync(inputDir, { recursive: true });
      for (const s of Object.values(saved)) {
        const destDir = s.subdir ? path.join(inputDir, s.subdir) : inputDir;
        fs.mkdirSync(destDir, { recursive: true });
        fs.renameSync(s.stored, path.join(destDir, path.basename(s.stored)));
      }
      fs.rmSync(tmpDir, { recursive: true, force: true });
      setJob(dealId, { phase: "uploaded", files: Object.fromEntries(Object.entries(saved).map(([k, v]) => [k, v.file])) });
      sendJson(res, 200, { dealId, files: jobs.get(dealId).files });
    } catch (e) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      sendJson(res, 400, { error: e.message });
    }
  });
  req.pipe(bb);
}

async function startExtract(dealId) {
  setJob(dealId, { phase: "extracting", error: null });
  try {
    const manifest = await extract({ dealId, inputDir: path.join(runDir(dealId), "inputs") });
    setJob(dealId, { phase: "review", candidates: manifest.candidates.length });
  } catch (e) {
    setJob(dealId, { phase: "error", error: e.message });
  }
}

async function startGenerate(dealId, workflowId) {
  const workflow = workflows.workflows.find((w) => w.id === workflowId);
  if (!workflow) return setJob(dealId, { phase: "error", error: `unknown workflow ${workflowId}` });
  try {
    setJob(dealId, { phase: "analyzing", error: null, notes: null });
    await analyze({ dealId });
    const dealFacts = readJson(path.join(runDir(dealId), "deal-facts.json"));
    if (!dealFacts.property?.name) {
      return setJob(dealId, {
        phase: "error",
        error: "we couldn't determine the property name from the approved facts — approve or edit it at the review gate, then hit Generate again.",
      });
    }
    // Missing facts don't block a run: the affected values are simply omitted
    // from every output (never estimated) and reported in the deal room.
    const missingFacts = (workflow.requiredFacts ?? []).filter((f) => !factPresent(dealFacts, f));
    let analysis = [];
    try {
      analysis = readJson(path.join(runDir(dealId), "analysis-notes.json")).notes ?? [];
    } catch {}
    setJob(dealId, { phase: "generating", outputs: workflow.outputs });
    const gen = await generate({ dealId, outputs: workflow.outputs });
    const rr = await render({ dealId, outputs: gen.produced });
    const skipped = [...gen.skipped, ...rr.skipped];
    const usage = usageSummary();
    setJob(dealId, {
      phase: "done",
      assetLinks: Object.fromEntries(
        Object.entries(rr.assetLinks).map(([k, files]) => [k, files.map((f) => `/runs/${dealId}/${path.basename(f)}`)])
      ),
      costUsd: usage.estCostUsd,
      notes: { missingFacts, analysis, skipped },
    });
  } catch (e) {
    setJob(dealId, {
      phase: "error",
      error: `${e.message} — your upload and review are saved; adjust at the gate if needed and hit Generate again.`,
    });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const dealId = url.searchParams.get("deal");

  try {
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(fs.readFileSync(dashboardHtml));
    }

    if (req.method === "POST" && url.pathname === "/api/upload") return handleUpload(req, res);

    if (req.method === "POST" && url.pathname === "/api/extract") {
      startExtract(dealId); // async — poll /api/status
      return sendJson(res, 200, { started: true });
    }

    if (req.method === "GET" && url.pathname === "/api/status") {
      return sendJson(res, 200, getJob(dealId) ?? { phase: "unknown" });
    }

    if (req.method === "GET" && url.pathname === "/api/manifest") {
      return sendJson(res, 200, readJson(path.join(runDir(dealId), "manifest.json")));
    }

    if (req.method === "POST" && url.pathname === "/api/review") {
      const { decisions } = await readBody(req); // [{id, status, editedValue?}]
      const manifestPath = path.join(runDir(dealId), "manifest.json");
      const manifest = readJson(manifestPath);
      const byId = new Map(manifest.candidates.map((c) => [c.id, c]));
      for (const d of decisions ?? []) {
        const c = byId.get(d.id);
        if (!c || !["approved", "edited", "rejected"].includes(d.status)) continue;
        c.status = d.status;
        if (d.status === "edited") c.editedValue = d.editedValue;
      }
      manifest.reviewedAt = new Date().toISOString();
      writeJson(manifestPath, manifest);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "POST" && url.pathname === "/api/generate") {
      startGenerate(dealId, url.searchParams.get("workflow") ?? "full-package"); // async — poll
      return sendJson(res, 200, { started: true });
    }

    if (req.method === "GET" && url.pathname === "/api/workflows") {
      return sendJson(res, 200, workflows.workflows.map(({ id, name, summary, outputs }) => ({ id, name, summary, outputs })));
    }

    // static: /runs/<dealId>/<file> — outputs only, no traversal
    if (req.method === "GET" && url.pathname.startsWith("/runs/")) {
      const rel = decodeURIComponent(url.pathname.slice("/runs/".length));
      const abs = path.resolve(runsDir, rel);
      if (!abs.startsWith(path.resolve(runsDir) + path.sep) || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
        res.writeHead(404); return res.end("not found");
      }
      const ext = path.extname(abs).toLowerCase();
      res.writeHead(200, {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        ...(ext === ".docx" || ext === ".pptx" || ext === ".xlsx"
          ? { "Content-Disposition": `attachment; filename="${path.basename(abs)}"` }
          : {}),
      });
      return fs.createReadStream(abs).pipe(res);
    }

    res.writeHead(404); res.end("not found");
  } catch (e) {
    sendJson(res, 500, { error: e.message });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`CRE Northstar dashboard → http://localhost:${PORT}`);
});
