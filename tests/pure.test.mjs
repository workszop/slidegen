import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// shared.js is a classic script; evaluate just the pure-helpers section.
const src = readFileSync(new URL("../shared.js", import.meta.url), "utf8");
const section = src.split("/* pure-helpers:start */")[1].split("/* pure-helpers:end */")[0];
const H = new Function(`${section}; return {
  stripOuterFence, splitSlides, detectLang, buildPrompt, deckTitle, isTitleSlide, firstFont,
  clampPanelWidth,
  PROVIDER_INFO, normalizeAiSettings,
  buildGeminiRequest, buildOpenAIRequest, buildClaudeRequest,
  geminiChunk, openaiChunk, claudeChunk,
};`)();

// ── existing helpers keep working ──
test("splitSlides splits on --- outside fences", () => {
  assert.deepEqual(H.splitSlides("# a\n---\n## b"), ["# a", "## b"]);
});

// ── PROVIDER_INFO ──
test("PROVIDER_INFO lists three providers with models", () => {
  assert.deepEqual(Object.keys(H.PROVIDER_INFO), ["gemini", "openai", "claude"]);
  for (const p of Object.values(H.PROVIDER_INFO)) {
    assert.ok(p.label && p.models.length > 0 && p.keyUrl.startsWith("https://"));
  }
});

// ── normalizeAiSettings ──
test("normalizeAiSettings defaults on empty/garbage input", () => {
  for (const raw of [null, "", "not json", "42"]) {
    const s = H.normalizeAiSettings(raw, {});
    assert.equal(s.provider, "gemini");
    assert.equal(s.model, H.PROVIDER_INFO.gemini.models[0]);
    assert.deepEqual(s.keys, { gemini: "", openai: "", claude: "" });
  }
});

test("normalizeAiSettings migrates legacy gemini key and model", () => {
  const s = H.normalizeAiSettings(null, { key: "AIzaLEGACY", model: "gemini-3.1-flash-lite-preview" });
  assert.equal(s.keys.gemini, "AIzaLEGACY");
  assert.equal(s.model, "gemini-3.1-flash-lite-preview");
});

test("normalizeAiSettings keeps stored settings and custom models", () => {
  const raw = JSON.stringify({ provider: "claude", model: "claude-x-experimental", keys: { claude: "sk-ant-1" } });
  const s = H.normalizeAiSettings(raw, { key: "AIzaLEGACY" });
  assert.equal(s.provider, "claude");
  assert.equal(s.model, "claude-x-experimental"); // custom IDs are preserved
  assert.equal(s.keys.claude, "sk-ant-1");
  assert.equal(s.keys.gemini, "AIzaLEGACY");      // legacy key still folded in
});

test("normalizeAiSettings rejects unknown provider", () => {
  const s = H.normalizeAiSettings(JSON.stringify({ provider: "grok" }), {});
  assert.equal(s.provider, "gemini");
});

// ── buildPrompt language modes ──
test("buildPrompt language modes", () => {
  assert.match(H.buildPrompt({ lang: "pl" }), /po polsku/);
  assert.match(H.buildPrompt({ lang: "en" }), /in English/);
  assert.match(H.buildPrompt({ lang: "auto" }), /same language as the source document/);
});

// ── request builders ──
const TEXT_SRC = { name: "notes.md", kind: "text", text: "hello world" };
const PDF_SRC = { name: "doc.pdf", kind: "pdf", base64: "QUJD" };

test("buildGeminiRequest shapes inline PDF and text", () => {
  const r = H.buildGeminiRequest({ key: "K", model: "gemini-3.5-flash", source: PDF_SRC, prompt: "P" });
  assert.match(r.url, /gemini-3\.5-flash:streamGenerateContent\?alt=sse$/);
  assert.equal(r.headers["x-goog-api-key"], "K");
  assert.deepEqual(r.body.contents[0].parts[1], { inline_data: { mime_type: "application/pdf", data: "QUJD" } });
  const t = H.buildGeminiRequest({ key: "K", model: "m", source: TEXT_SRC, prompt: "P" });
  assert.match(t.body.contents[0].parts[1].text, /hello world/);
});

test("buildOpenAIRequest uses responses API with input_file for PDF", () => {
  const r = H.buildOpenAIRequest({ key: "K", model: "gpt-5.6", source: PDF_SRC, prompt: "P" });
  assert.equal(r.url, "https://api.openai.com/v1/responses");
  assert.equal(r.headers.Authorization, "Bearer K");
  assert.equal(r.body.stream, true);
  const parts = r.body.input[0].content;
  assert.equal(parts[0].type, "input_text");
  assert.deepEqual(parts[1], { type: "input_file", filename: "doc.pdf", file_data: "data:application/pdf;base64,QUJD" });
  const t = H.buildOpenAIRequest({ key: "K", model: "gpt-5.6", source: TEXT_SRC, prompt: "P" });
  assert.equal(t.body.input[0].content.length, 1);
  assert.match(t.body.input[0].content[0].text, /hello world/);
});

test("buildClaudeRequest uses document block and browser headers", () => {
  const r = H.buildClaudeRequest({ key: "K", model: "claude-sonnet-5", source: PDF_SRC, prompt: "P" });
  assert.equal(r.url, "https://api.anthropic.com/v1/messages");
  assert.equal(r.headers["x-api-key"], "K");
  assert.equal(r.headers["anthropic-version"], "2023-06-01");
  assert.equal(r.headers["anthropic-dangerous-direct-browser-access"], "true");
  assert.equal(r.body.stream, true);
  assert.equal(r.body.max_tokens, 16000);
  const content = r.body.messages[0].content;
  assert.deepEqual(content[0], { type: "document", source: { type: "base64", media_type: "application/pdf", data: "QUJD" } });
  assert.equal(content[1].type, "text");
  const t = H.buildClaudeRequest({ key: "K", model: "claude-sonnet-5", source: TEXT_SRC, prompt: "P" });
  assert.match(t.body.messages[0].content[0].text, /hello world/);
});

// ── chunk extractors ──
test("chunk extractors pull text deltas and ignore other events", () => {
  assert.equal(H.geminiChunk({ candidates: [{ content: { parts: [{ text: "a" }, { text: "b" }] } }] }), "ab");
  assert.equal(H.geminiChunk({}), "");
  assert.equal(H.openaiChunk({ type: "response.output_text.delta", delta: "x" }), "x");
  assert.equal(H.openaiChunk({ type: "response.created" }), "");
  assert.equal(H.claudeChunk({ type: "content_block_delta", delta: { type: "text_delta", text: "y" } }), "y");
  assert.equal(H.claudeChunk({ type: "message_start" }), "");
});

// ── clampPanelWidth ──
test("clampPanelWidth clamps to [min, maxFraction × viewport]", () => {
  assert.equal(H.clampPanelWidth(400, 280, 0.6, 1200), 400);  // in range
  assert.equal(H.clampPanelWidth(100, 280, 0.6, 1200), 280);  // below min
  assert.equal(H.clampPanelWidth(900, 280, 0.6, 1200), 720);  // above max (0.6 × 1200)
});

test("clampPanelWidth returns null for garbage input", () => {
  assert.equal(H.clampPanelWidth(NaN, 280, 0.6, 1200), null);       // parseFloat(null)
  assert.equal(H.clampPanelWidth(Infinity, 280, 0.6, 1200), null);
  assert.equal(H.clampPanelWidth(undefined, 280, 0.6, 1200), null);
});

test("clampPanelWidth keeps min when viewport shrinks below it", () => {
  assert.equal(H.clampPanelWidth(500, 280, 0.6, 400), 280);   // max(280, 240) = 280
});
