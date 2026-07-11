// Load .env from the 02_build root before the SDK client is constructed.
// fileURLToPath, not URL.pathname — the workspace path contains a space.
import { fileURLToPath } from "node:url";
try {
  process.loadEnvFile(fileURLToPath(new URL("../../.env", import.meta.url)));
} catch {
  // no .env — fall back to whatever is already in the environment
}

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-4-8";
const client = new Anthropic();

let totalIn = 0;
let totalOut = 0;

export function usageSummary() {
  // Opus 4.8: $5/M input, $25/M output
  const cost = (totalIn / 1e6) * 5 + (totalOut / 1e6) * 25;
  return { inputTokens: totalIn, outputTokens: totalOut, estCostUsd: cost.toFixed(4) };
}

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON object in response");
  return JSON.parse(raw.slice(start, end + 1));
}

// One structured call: prompt + document/text blocks in, parsed JSON out.
// Streams (long extractions won't hit request timeouts) with adaptive
// thinking. v0.1 uses instruction-based JSON with one retry; the production
// build should move to output_config.format json_schema per ARCHITECTURE.md §5.
export async function jsonCall({ system, userBlocks, label }) {
  const jsonRule =
    "\n\nRespond with ONLY a single valid JSON object. No prose before or after, no markdown fences.";
  let lastErr;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 32000,
      thinking: { type: "adaptive" },
      system: system + jsonRule,
      messages: [{ role: "user", content: userBlocks }],
    });
    const resp = await stream.finalMessage();
    totalIn += resp.usage.input_tokens;
    totalOut += resp.usage.output_tokens;
    const text = resp.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    try {
      const parsed = extractJson(text);
      console.log(
        `  [${label}] ok (${resp.usage.input_tokens} in / ${resp.usage.output_tokens} out tokens)`
      );
      return parsed;
    } catch (e) {
      lastErr = e;
      console.warn(`  [${label}] attempt ${attempt}: invalid JSON (${e.message}), retrying…`);
    }
  }
  throw new Error(`[${label}] failed to produce valid JSON: ${lastErr.message}`);
}

export function pdfBlock(base64Data) {
  return {
    type: "document",
    source: { type: "base64", media_type: "application/pdf", data: base64Data },
  };
}

export function textBlock(text) {
  return { type: "text", text };
}

export function imageBlock(base64Jpeg) {
  return {
    type: "image",
    source: { type: "base64", media_type: "image/jpeg", data: base64Jpeg },
  };
}
