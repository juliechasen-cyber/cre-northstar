import path from "node:path";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { readJson } from "./files.mjs";
import { schemasRoot } from "./paths.mjs";

const strictAjv = new Ajv({ allErrors: true, strict: false });
addFormats(strictAjv);
// Lenient twin used by conformToSchema: strips properties the schema forbids
// and coerces near-miss scalars ("94" → 94). Mutates the object it validates.
const lenientAjv = new Ajv({ allErrors: true, strict: false, removeAdditional: true, coerceTypes: true });
addFormats(lenientAjv);

const compiledCache = new Map();
function compiled(instance, kind, name) {
  const key = `${kind}:${name}`;
  if (!compiledCache.has(key)) {
    compiledCache.set(key, instance.compile(readJson(path.join(schemasRoot, `${name}.schema.json`))));
  }
  return compiledCache.get(key);
}

const fmtErr = (e) => `${e.instancePath || "(root)"} ${e.message}`;

// Strict validation. Reached only for code-built artifacts or after
// conformToSchema, so a failure here is a pipeline bug, not broker data.
export function validateAgainst(name, obj) {
  const validate = compiled(strictAjv, "strict", name);
  if (!validate(obj)) {
    const details = validate.errors
      .slice(0, 5)
      .map((e) => `  ${fmtErr(e)}`)
      .join("\n");
    throw new Error(`does not conform to ${name}.schema.json:\n${details}`);
  }
  return obj;
}

// Object-property paths in obj, array indices collapsed to "[]" so a spliced
// list doesn't read as a wall of removed keys in the before/after diff.
function keyPaths(obj, prefix = "", acc = new Set()) {
  if (Array.isArray(obj)) {
    for (const v of obj) keyPaths(v, `${prefix}[]`, acc);
  } else if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      const p = prefix ? `${prefix}.${k}` : k;
      acc.add(p);
      keyPaths(v, p, acc);
    }
  }
  return acc;
}

// null means "unknown" in model output; the schemas express unknown as
// absence. Strip nulls before validating so coercion can never turn a null
// NOI into a $0 NOI.
function stripNulls(obj) {
  if (Array.isArray(obj)) {
    for (let i = obj.length - 1; i >= 0; i--) {
      if (obj[i] == null) obj.splice(i, 1);
      else stripNulls(obj[i]);
    }
  } else if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      if (v == null) delete obj[k];
      else stripNulls(v);
    }
  }
}

// Delete the value at a JSON pointer ("/highlights/3/sourceRef"). Array
// elements are spliced, not holed — schemas don't allow null gaps.
function deleteAtPointer(obj, pointer) {
  const parts = pointer.split("/").slice(1).map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));
  if (parts.length === 0) return false;
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cur = cur?.[parts[i]];
    if (cur == null || typeof cur !== "object") return false;
  }
  const last = parts[parts.length - 1];
  if (Array.isArray(cur)) {
    const idx = Number(last);
    if (!Number.isInteger(idx) || idx < 0 || idx >= cur.length) return false;
    cur.splice(idx, 1);
    return true;
  }
  if (typeof cur === "object" && last in cur) {
    delete cur[last];
    return true;
  }
  return false;
}

// Make model output fit the schema instead of failing the run: accept messy
// input, publish strictly. In order — prune extra properties the schema
// forbids, coerce near-miss scalar types, then drop any value that still
// can't validate. A dropped fact becomes an omission downstream, never an
// estimate; an array item missing its required source is removed entirely
// (grounding-positive). Root-level problems (wrong overall shape, missing
// required root fields) are not salvageable here — the caller repairs or
// fails with a broker-friendly message. Mutates obj.
// Returns { ok, notes, errors }.
export function conformToSchema(name, obj) {
  const validate = compiled(lenientAjv, "lenient", name);
  stripNulls(obj);
  const before = keyPaths(obj);
  const notes = [];
  const salvaged = new Set();
  let errors = [];
  let ok = false;
  for (let pass = 0; pass < 25; pass++) {
    ok = validate(obj);
    if (ok) break;
    errors = validate.errors.map(fmtErr);
    const err = validate.errors[0];
    if (!err.instancePath) break; // root problem — pruning can't fix it
    const where = err.instancePath.slice(1).replace(/\//g, ".");
    if (!deleteAtPointer(obj, err.instancePath)) break;
    salvaged.add(where);
    notes.push(
      err.keyword === "required"
        ? `dropped ${where} — missing required "${err.params?.missingProperty}"`
        : `set aside ${where} — ${err.message}`
    );
  }
  if (ok) {
    errors = [];
    const after = keyPaths(obj);
    const removed = [...before].filter((p) => !after.has(p));
    // report only top-most removed paths, minus ones salvage already noted
    for (const p of removed) {
      if (removed.some((q) => q !== p && p.startsWith(q + "."))) continue;
      if (salvaged.has(p) || [...salvaged].some((s) => p.startsWith(s + "."))) continue;
      notes.push(`set aside ${p} — outside the expected format`);
    }
  }
  return { ok, notes, errors };
}
