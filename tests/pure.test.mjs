import { test } from "node:test";
import assert from "node:assert/strict";

import H from "../pure.js";

// The model-discovery helpers share the same export object; D is a
// convenience alias so discovery-focused tests read alongside the rest.
const D = H;

// ── existing helpers keep working ──
test("splitSlides splits on --- outside fences", () => {
  assert.deepEqual(H.splitSlides("# a\n---\n## b"), ["# a", "## b"]);
});

test("reconcileSlideImages follows unchanged slides across structural edits", () => {
  const previous = ["# Title", "## Alpha", "## Beta"];
  const images = [undefined, "alpha.jpg", "beta.jpg"];
  assert.deepEqual(
    H.reconcileSlideImages(previous, images, ["# Title", "## New", "## Beta", "## Alpha"]),
    [undefined, undefined, "beta.jpg", "alpha.jpg"],
  );
});

test("reconcileSlideImages drops images for edited slides and preserves duplicate occurrences", () => {
  assert.deepEqual(
    H.reconcileSlideImages(["same", "same", "old"], [undefined, "second.jpg", "old.jpg"], ["same", "same", "new"]),
    [undefined, "second.jpg", undefined],
  );
});

test("illustratedSlideHtml keeps the slide heading full-width above the image row", () => {
  const img = '<img class="slide-generated-image" alt="">';
  assert.equal(
    H.illustratedSlideHtml('<h2 id="s">Head</h2>\n<p>Body</p>', img),
    '<h2 id="s">Head</h2><div class="slide-layout"><div class="slide-copy">\n<p>Body</p></div>' + img + "</div>",
  );
  assert.equal(
    H.illustratedSlideHtml("<h1>Deck</h1>\n<p>Sub</p>", img),
    '<h1>Deck</h1><div class="slide-layout"><div class="slide-copy">\n<p>Sub</p></div>' + img + "</div>",
  );
});

test("illustratedSlideHtml wraps the whole slide when it has no leading heading", () => {
  const img = '<img class="slide-generated-image" alt="">';
  assert.equal(
    H.illustratedSlideHtml("<p>Body</p>\n<h2>Later</h2>", img),
    '<div class="slide-layout"><div class="slide-copy"><p>Body</p>\n<h2>Later</h2></div>' + img + "</div>",
  );
  assert.equal(
    H.illustratedSlideHtml("<h3>Minor</h3><p>Body</p>", img),
    '<div class="slide-layout"><div class="slide-copy"><h3>Minor</h3><p>Body</p></div>' + img + "</div>",
  );
});

// ── PROVIDER_INFO ──
test("PROVIDER_INFO lists three providers with models", () => {
  assert.deepEqual(Object.keys(H.PROVIDER_INFO), ["gemini", "openai", "claude"]);
  for (const p of Object.values(H.PROVIDER_INFO)) {
    assert.ok(p.label && p.models.length > 0 && p.keyUrl.startsWith("https://"));
  }
});

test("validateModelCatalog rejects unsafe or ambiguous entries", () => {
  const valid = {
    defaultProvider: "gemini",
    imageModels: [...H.OPENAI_IMAGE_MODELS],
    providers: Object.fromEntries(Object.entries(H.PROVIDER_INFO).map(([id, p]) => [id, {
      ...p, models: [...p.models],
    }])),
  };
  assert.throws(() => H.validateModelCatalog({}), /missing providers/);
  assert.throws(() => H.validateModelCatalog({
    ...valid,
    providers: { ...valid.providers, openai: { ...valid.providers.openai, models: ["same", "same"] } },
  }), /duplicate model IDs/);
  assert.throws(() => H.validateModelCatalog({
    ...valid,
    providers: { ...valid.providers, claude: { ...valid.providers.claude, keyUrl: "http://example.test" } },
  }), /claude\.keyUrl/);
});

test("validateModelCatalog falls back to the first supported default", () => {
  const providers = Object.fromEntries(Object.entries(H.PROVIDER_INFO).map(([id, p]) => [id, {
    ...p, models: [...p.models],
  }]));
  const result = H.validateModelCatalog({
    defaultProvider: "unknown",
    imageModels: [...H.OPENAI_IMAGE_MODELS],
    providers,
  });
  assert.equal(result.defaultProvider, "gemini");
});

// ── normalizeAiSettings ──
test("normalizeAiSettings defaults on empty/garbage input", () => {
  for (const raw of [null, "", "not json", "42"]) {
    const s = H.normalizeAiSettings(raw, {});
    assert.equal(s.provider, "gemini");
    assert.equal(s.model, H.PROVIDER_INFO.gemini.models[0]);
    assert.deepEqual(s.keys, { gemini: "", openai: "", claude: "" });
    assert.equal(s.imageModel, H.OPENAI_IMAGE_MODELS[0]);
  }
});

test("normalizeAiSettings keeps a stored image model, including custom IDs", () => {
  const stored = H.normalizeAiSettings(JSON.stringify({ imageModel: "gpt-image-1-mini" }), {});
  assert.equal(stored.imageModel, "gpt-image-1-mini");
  const custom = H.normalizeAiSettings(JSON.stringify({ imageModel: " gpt-image-next " }), {});
  assert.equal(custom.imageModel, "gpt-image-next");
  const blank = H.normalizeAiSettings(JSON.stringify({ imageModel: "   " }), {});
  assert.equal(blank.imageModel, H.OPENAI_IMAGE_MODELS[0]);
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

test("buildPrompt appends additional instructions after the format contract", () => {
  const prompt = H.buildPrompt({ lang: "pl", additionalPrompt: "Skup się na przykładach." });
  assert.match(prompt, /Additional instructions from the user/);
  assert.match(prompt, /Skup się na przykładach\./);
  assert.ok(prompt.indexOf("Output raw markdown") < prompt.indexOf("Skup się na przykładach"));
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
  const r = H.buildOpenAIRequest({ key: "K", model: "gpt-5.6-sol", source: PDF_SRC, prompt: "P" });
  assert.equal(r.url, "https://api.openai.com/v1/responses");
  assert.equal(r.headers.Authorization, "Bearer K");
  assert.equal(r.body.stream, true);
  const parts = r.body.input[0].content;
  assert.equal(parts[0].type, "input_text");
  assert.deepEqual(parts[1], { type: "input_file", filename: "doc.pdf", file_data: "data:application/pdf;base64,QUJD" });
  const t = H.buildOpenAIRequest({ key: "K", model: "gpt-5.6-sol", source: TEXT_SRC, prompt: "P" });
  assert.equal(t.body.input[0].content.length, 1);
  assert.match(t.body.input[0].content[0].text, /hello world/);
});

test("buildOpenAIImageRequest uses the image endpoint and landscape JPEG", () => {
  const r = H.buildOpenAIImageRequest({ key: "K", model: "gpt-image-2", prompt: "P" });
  assert.equal(r.url, "https://api.openai.com/v1/images/generations");
  assert.equal(r.headers.Authorization, "Bearer K");
  assert.deepEqual(r.body, {
    model: "gpt-image-2", prompt: "P", n: 1,
    size: "1536x1024", quality: "low", output_format: "jpeg",
    stream: true, partial_images: 1,
  });
});

test("buildClaudeRequest uses document block and browser headers", () => {
  const r = H.buildClaudeRequest({ key: "K", model: "claude-sonnet-5", source: PDF_SRC, prompt: "P" });
  assert.equal(r.url, "https://api.anthropic.com/v1/messages");
  assert.equal(r.headers["x-api-key"], "K");
  assert.equal(r.headers["anthropic-version"], "2023-06-01");
  assert.equal(r.headers["anthropic-dangerous-direct-browser-access"], "true");
  assert.equal(r.body.stream, true);
  assert.equal(r.body.max_tokens, 64000);
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

// ── SSE frame parsing ──
test("parseSseFrames joins multi-line data and accepts CRLF events", () => {
  const parsed = H.parseSseFrames(
    "event: response.output_text.delta\r\ndata: {\"type\":\"response.output_text.delta\",\r\ndata: \"delta\":\"hello\"}\r\n\r\n",
  );
  assert.deepEqual(parsed, {
    events: [{
      event: "response.output_text.delta",
      data: "{\"type\":\"response.output_text.delta\",\n\"delta\":\"hello\"}",
    }],
    remainder: "",
  });
});

test("parseSseFrames retains incomplete chunks and flushes the final event", () => {
  const first = H.parseSseFrames("data: {\"type\":\"message\",\"text\":\"za");
  assert.deepEqual(first.events, []);
  const second = H.parseSseFrames(first.remainder + "żółć\"}");
  assert.deepEqual(second.events, []);
  const final = H.parseSseFrames(second.remainder, { final: true });
  assert.deepEqual(final, {
    events: [{ event: "message", data: "{\"type\":\"message\",\"text\":\"zażółć\"}" }],
    remainder: "",
  });
});

test("parseSseFrames ignores comments and preserves separate event names", () => {
  const parsed = H.parseSseFrames(": heartbeat\n\nevent: error\ndata: {\"error\":{\"message\":\"overloaded\"}}\n\n");
  assert.deepEqual(parsed.events, [{
    event: "error",
    data: "{\"error\":{\"message\":\"overloaded\"}}",
  }]);
  assert.equal(parsed.remainder, "");
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

// ── buildSlideImagePrompt (deck context + target slide) ──
test("buildSlideImagePrompt embeds every deck segment as context", () => {
  const p = H.buildSlideImagePrompt({
    slideMd: "## Target\n- point",
    direction: "",
    deckSegments: ["# Title", "## Target\n- point", "## Other"],
  });
  assert.match(p, /do NOT illustrate these/i);
  assert.match(p, /# Title/);
  assert.match(p, /## Other/);
  // the target slide appears under the "illustrate THIS slide" instruction
  assert.match(p, /illustrate the central idea of THIS slide[\s\S]*## Target/i);
  // no leftover user-direction heading when direction is empty
  assert.doesNotMatch(p, /Additional direction from the user/);
});

test("buildSlideImagePrompt appends user direction when provided", () => {
  const p = H.buildSlideImagePrompt({
    slideMd: "## Target",
    direction: "  flat vector, warm palette  ",
    deckSegments: ["## Target"],
  });
  assert.match(p, /Additional direction from the user:\nflat vector, warm palette/);
});

test("buildSlideImagePrompt forbids text and layout artefacts", () => {
  const p = H.buildSlideImagePrompt({ slideMd: "x", direction: "", deckSegments: ["x"] });
  assert.match(p, /black and white contour image in the style of Notion/);
  assert.match(p, /Do not include text, letters, numbers, logos/);
});

// ── splitSlides edge cases ──
test("splitSlides keeps a setext H2 underline with its heading", () => {
  assert.deepEqual(
    H.splitSlides("Wprowadzenie\n---\n\nTresc akapitu."),
    ["Wprowadzenie\n---\n\nTresc akapitu."],
  );
});

test("splitSlides still splits on --- after a block-level line", () => {
  assert.equal(H.splitSlides("# A\n---\n# B").length, 2);
  assert.equal(H.splitSlides("# A\n\n---\n\n# B").length, 2);
});

test("splitSlides ignores an unterminated fence instead of swallowing the deck", () => {
  assert.equal(H.splitSlides("# A\n\n```js\ncode\n\n---\n\n# B\n\n---\n\n# C").length, 3);
});

test("splitSlides honours ~~~ fences", () => {
  assert.equal(H.splitSlides("# A\n\n~~~\n---\n~~~\n\n---\n\n# B").length, 2);
});

test("splitSlides still hides --- inside a closed ``` fence", () => {
  assert.equal(H.splitSlides("# A\n\n```\n---\n```\n\n---\n\n# B").length, 2);
});

// ── provider stop reasons ──
test("providerStopReason maps truncation across providers", () => {
  assert.equal(H.providerStopReason({ type: "message_delta", delta: { stop_reason: "max_tokens" } }), "truncated");
  assert.equal(H.providerStopReason({ type: "response.incomplete", response: { incomplete_details: { reason: "max_output_tokens" } } }), "truncated");
  assert.equal(H.providerStopReason({ candidates: [{ finishReason: "MAX_TOKENS" }] }), "truncated");
});

test("providerStopReason maps refusals and safety blocks", () => {
  assert.equal(H.providerStopReason({ type: "message_delta", delta: { stop_reason: "refusal" } }), "blocked");
  assert.equal(H.providerStopReason({ candidates: [{ finishReason: "SAFETY" }] }), "blocked");
  assert.equal(H.providerStopReason({ type: "response.incomplete", response: { incomplete_details: { reason: "content_filter" } } }), "blocked");
});

test("providerStopReason stays quiet for normal completion and unrelated events", () => {
  assert.equal(H.providerStopReason({ type: "message_delta", delta: { stop_reason: "end_turn" } }), "");
  assert.equal(H.providerStopReason({ candidates: [{ finishReason: "STOP" }] }), "");
  assert.equal(H.providerStopReason({ type: "content_block_delta", delta: { type: "text_delta", text: "x" } }), "");
  assert.equal(H.providerStopReason(null), "");
});

// ── Claude thinking config ──
test("buildClaudeRequest disables thinking only where the parameter is valid", () => {
  const build = model => H.buildClaudeRequest({
    key: "k", model, source: { kind: "text", text: "doc" }, prompt: "p",
  }).body;
  assert.deepEqual(build("claude-sonnet-5").thinking, { type: "disabled" });
  assert.deepEqual(build("claude-opus-4-8").thinking, { type: "disabled" });
  assert.equal("thinking" in build("claude-haiku-4-5"), false, "older models take a different thinking shape");
  assert.equal("thinking" in build("some-custom-model"), false, "custom model IDs must not get an unvalidated parameter");
});

test("splitSlides keeps this app's own format: --- straight after the intro line", () => {
  // The bundled example decks separate slides without a blank line before ---.
  const md = "# doc2slide\nA short guide.\n---\n## What is this?\n\n- a bullet";
  assert.equal(H.splitSlides(md).length, 2);
});

// ── Gemini default model and sampling deprecation ──
test("the default Gemini model is gemini-3.6-flash", () => {
  assert.equal(H.PROVIDER_INFO.gemini.models[0], "gemini-3.6-flash");
  // normalizeAiSettings picks models[0] when nothing is stored.
  assert.equal(H.normalizeAiSettings(null).model, "gemini-3.6-flash");
});

test("temperature is sent only to Gemini models that still honour it", () => {
  const body = model => H.buildGeminiRequest({
    key: "K", model, source: { kind: "text", text: "doc" }, prompt: "P",
  }).body;
  assert.equal("generationConfig" in body("gemini-3.6-flash"), false,
    "3.6 deprecates sampling and later generations reject it");
  assert.deepEqual(body("gemini-3.5-flash").generationConfig, { temperature: 0.4 });
  assert.deepEqual(body("gemini-3.1-flash-lite-preview").generationConfig, { temperature: 0.4 });
  assert.equal("generationConfig" in body("some-custom-gemini"), false,
    "custom IDs must not receive a parameter that may be rejected");
});

test("a stored model choice still wins over the new default", () => {
  const s = H.normalizeAiSettings(JSON.stringify({ provider: "gemini", model: "gemini-3.5-flash" }));
  assert.equal(s.model, "gemini-3.5-flash");
});

test("the Gemini model ID is URL-encoded into the endpoint", () => {
  const r = H.buildGeminiRequest({
    key: "K", model: "evil/../models/x?key=leak",
    source: { kind: "text", text: "d" }, prompt: "p",
  });
  assert.doesNotMatch(r.url, /\?key=leak/, "a crafted ID must not inject query parameters");
  assert.match(r.url, /alt=sse$/);
});

test("the OpenAI catalogue is the GPT-5.6 frontier family, most capable first", () => {
  assert.deepEqual(H.PROVIDER_INFO.openai.models,
    ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"]);
  assert.equal(H.normalizeAiSettings(JSON.stringify({ provider: "openai" })).model, "gpt-5.6-sol");
});

test("OpenAI requests carry no sampling parameters to deprecate", () => {
  const body = H.buildOpenAIRequest({
    key: "K", model: "gpt-5.6-sol", source: { kind: "text", text: "d" }, prompt: "p",
  }).body;
  assert.deepEqual(Object.keys(body).sort(), ["input", "model", "stream"]);
});

// ── model discovery ──
test("every provider declares discovery metadata with a matching auth shape", () => {
  for (const [id, info] of Object.entries(D.PROVIDER_INFO)) {
    assert.ok(info.listUrl.startsWith("https://"), `${id} needs an HTTPS list endpoint`);
    assert.ok(["query-key", "bearer", "anthropic"].includes(info.listAuth), `${id} auth shape`);
    assert.ok(typeof info.listPath === "string" && info.listPath, `${id} needs a list path`);
  }
  // Gemini names arrive prefixed; the others use bare ids.
  assert.ok(D.PROVIDER_INFO.gemini.listStrip instanceof RegExp);
});

test("providerModelIds reads each provider's list shape and strips prefixes", () => {
  assert.deepEqual(
    D.providerModelIds("gemini", { models: [{ name: "models/gemini-9-flash" }, { name: "models/gemini-9-pro" }] }),
    ["gemini-9-flash", "gemini-9-pro"],
  );
  assert.deepEqual(
    D.providerModelIds("openai", { data: [{ id: "gpt-9" }, { id: "gpt-9-mini" }] }),
    ["gpt-9", "gpt-9-mini"],
  );
  assert.deepEqual(
    D.providerModelIds("claude", { data: [{ id: "claude-9" }] }),
    ["claude-9"],
  );
});

test("providerModelIds drops blanks, whitespace ids, and malformed rows", () => {
  assert.deepEqual(
    D.providerModelIds("openai", { data: [{ id: "ok" }, { id: "has space" }, { id: "  " }, {}, { id: 42 }] }),
    ["ok", "42"],
  );
  assert.deepEqual(D.providerModelIds("openai", null), []);
  assert.deepEqual(D.providerModelIds("openai", { wrong: [] }), []);
});

test("discoverProviderModels returns the curated list without a key", async () => {
  const curated = D.PROVIDER_INFO.openai.models;
  assert.deepEqual(await D.discoverProviderModels("openai", ""), curated.slice());
  assert.deepEqual(await D.discoverProviderModels("openai", null), curated.slice());
  assert.deepEqual(await D.discoverProviderModels("openai"), curated.slice());
});

test("discoverProviderModels merges live ids after the curated order", async () => {
  const curated = D.PROVIDER_INFO.openai.models;
  const payload = { data: [...curated.map(id => ({ id })), { id: "gpt-9-new" }, { id: "gpt-9-new" }] };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => ({
    ok: true,
    json: async () => payload,
  });
  try {
    const merged = await D.discoverProviderModels("openai", "sk-x");
    // Curated leads, the unknown live id follows, duplicates collapse.
    assert.deepEqual(merged, [...curated, "gpt-9-new"]);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("discoverProviderModels is best-effort on HTTP and parse failures", async () => {
  const curated = D.PROVIDER_INFO.openai.models;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, json: async () => ({}) });
  try {
    assert.deepEqual(await D.discoverProviderModels("openai", "sk-x"), curated.slice());
  } finally {
    globalThis.fetch = realFetch;
  }
  globalThis.fetch = async () => { throw new Error("offline"); };
  try {
    assert.deepEqual(await D.discoverProviderModels("openai", "sk-x"), curated.slice());
  } finally {
    globalThis.fetch = realFetch;
  }
});

// ── uploaded-image helpers ──
test("fitWithin downscales the long edge to the cap and keeps aspect", () => {
  assert.deepEqual(H.fitWithin(3200, 2000, 1600), { width: 1600, height: 1000 });
  assert.deepEqual(H.fitWithin(2000, 3200, 1600), { width: 1000, height: 1600 });
});

test("fitWithin never upscales and returns integer pixels", () => {
  assert.deepEqual(H.fitWithin(800, 500, 1600), { width: 800, height: 500 });
  const odd = H.fitWithin(3001, 1000, 1600);
  assert.ok(Number.isInteger(odd.width) && Number.isInteger(odd.height));
  assert.ok(odd.width <= 1600 && odd.height >= 1);
});

test("fitWithin rejects degenerate dimensions", () => {
  assert.equal(H.fitWithin(0, 100, 1600), null);
  assert.equal(H.fitWithin(100, -5, 1600), null);
  assert.equal(H.fitWithin(NaN, 100, 1600), null);
});

test("uploadEncoding keeps PNG for transparent images, JPEG otherwise", () => {
  assert.deepEqual(H.uploadEncoding(true), { mime: "image/png", quality: undefined });
  assert.deepEqual(H.uploadEncoding(false), { mime: "image/jpeg", quality: 0.85 });
});
