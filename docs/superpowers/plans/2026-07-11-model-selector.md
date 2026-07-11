# Multi-Provider Model Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a provider/model selector popup (Gemini, OpenAI, Claude) with a compact in-workspace indicator chip, replacing the inline Gemini-only key/model fields in all three slidegen apps.

**Architecture:** A data-driven `PROVIDER_INFO` registry plus pure request-builder functions live in `shared.js` between the `pure-helpers` markers (unit-testable). A generic SSE streamer + `streamSlides()` dispatcher replaces direct `streamGeminiSlides` calls. A shared `<dialog>`-based popup component (`mountAiSelector`) renders provider/model/key controls and keeps a chip in sync; each app mounts it where its key field used to be. Settings persist in one localStorage key `eduapp_ai` with migration from the legacy `eduapp_gemini_key`/`eduapp_model` keys.

**Tech Stack:** Vanilla JS (no build step), classic scripts, native `<dialog>`, `fetch` + SSE, `node --test` for pure helpers.

## Global Constraints

- No build step — `shared.js` is a classic script loaded via `<script defer src="shared.js">`; top-level `const`/`function` must remain visible to later scripts. No `import`/`export` in `shared.js`.
- Spec: `docs/superpowers/specs/2026-07-11-model-selector-design.md`.
- localStorage schema: `eduapp_ai` = `{"provider": "gemini|openai|claude", "model": "<id>", "keys": {"gemini": "", "openai": "", "claude": ""}}`. Legacy keys `eduapp_gemini_key` / `eduapp_model` are read for migration but never written or deleted.
- Curated models (verified against provider docs 2026-07-11):
  - gemini: `gemini-3.5-flash`, `gemini-3.1-flash-lite-preview`
  - openai: `gpt-5.6`, `gpt-5-mini`, `gpt-5-nano`
  - claude: `claude-opus-4-8`, `claude-sonnet-5`, `claude-haiku-4-5`
- Endpoints/headers (verified 2026-07-11):
  - Gemini: `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse`, header `x-goog-api-key`.
  - OpenAI: `POST https://api.openai.com/v1/responses`, header `Authorization: Bearer <key>`, body `{model, input:[{role:"user",content:[…]}], stream:true}`; PDF as `{type:"input_file", filename, file_data:"data:application/pdf;base64,…"}`; text deltas in SSE events `{type:"response.output_text.delta", delta}`.
  - Claude: `POST https://api.anthropic.com/v1/messages`, headers `x-api-key`, `anthropic-version: 2023-06-01`, `anthropic-dangerous-direct-browser-access: true`; body `{model, max_tokens:16000, stream:true, messages:[…]}`; PDF as `{type:"document", source:{type:"base64", media_type:"application/pdf", data}}` block before the text block; text deltas in `{type:"content_block_delta", delta:{type:"text_delta", text}}`.
- All UI copy bilingual PL (default) / EN, matching each app's existing i18n pattern.
- Commit after every task. Do not push without the user's go-ahead.

---

### Task 1: Pure settings + request-builder helpers with tests

**Files:**
- Modify: `shared.js` (inside the `/* pure-helpers:start */ … /* pure-helpers:end */` block, and the constants section below it)
- Create: `tests/pure.test.mjs`

**Interfaces:**
- Produces (all inside the pure-helpers block; later tasks call these by exactly these names):
  - `const PROVIDER_INFO` — `{gemini|openai|claude: {label, models[], keyPlaceholder, keyUrl}}`
  - `normalizeAiSettings(raw, legacy)` → `{provider, model, keys:{gemini,openai,claude}}` (raw = JSON string or null; legacy = `{key, model}`)
  - `buildGeminiRequest({key, model, source, prompt})` / `buildOpenAIRequest(...)` / `buildClaudeRequest(...)` → `{url, headers, body}` (body is a plain object, not stringified)
  - `geminiChunk(data)` / `openaiChunk(data)` / `claudeChunk(data)` → string (possibly empty) extracted from one parsed SSE data object

- [ ] **Step 1: Write the failing tests**

Create `tests/pure.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// shared.js is a classic script; evaluate just the pure-helpers section.
const src = readFileSync(new URL("../shared.js", import.meta.url), "utf8");
const section = src.split("/* pure-helpers:start */")[1].split("/* pure-helpers:end */")[0];
const H = new Function(`${section}; return {
  stripOuterFence, splitSlides, detectLang, buildPrompt, deckTitle, isTitleSlide, firstFont,
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/andrzey/git-claude/slidegen && node --test tests/`
Expected: FAIL — `PROVIDER_INFO is not defined` (existing-helper test may pass).

- [ ] **Step 3: Implement the helpers in `shared.js`**

Inside the pure-helpers block (before `/* pure-helpers:end */`), add:

```js
// ─── AI provider registry (pure data) ───────────
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const PROVIDER_INFO = {
  gemini: {
    label: "Gemini",
    models: ["gemini-3.5-flash", "gemini-3.1-flash-lite-preview"],
    keyPlaceholder: "AIza…",
    keyUrl: "https://aistudio.google.com/apikey",
  },
  openai: {
    label: "OpenAI",
    models: ["gpt-5.6", "gpt-5-mini", "gpt-5-nano"],
    keyPlaceholder: "sk-…",
    keyUrl: "https://platform.openai.com/api-keys",
  },
  claude: {
    label: "Claude",
    models: ["claude-opus-4-8", "claude-sonnet-5", "claude-haiku-4-5"],
    keyPlaceholder: "sk-ant-…",
    keyUrl: "https://console.anthropic.com/settings/keys",
  },
};

// Parse the eduapp_ai JSON (raw string or null) into valid settings,
// folding in the legacy single-provider values ({key, model}) on first run.
function normalizeAiSettings(raw, legacy = {}) {
  let s = {};
  try { s = JSON.parse(raw) ?? {}; } catch { /* corrupt JSON — use defaults */ }
  if (typeof s !== "object" || Array.isArray(s)) s = {};
  const provider = PROVIDER_INFO[s.provider] ? s.provider : "gemini";
  const keys = { gemini: "", openai: "", claude: "" };
  if (s.keys && typeof s.keys === "object") {
    for (const p of Object.keys(keys)) if (typeof s.keys[p] === "string") keys[p] = s.keys[p];
  }
  if (!keys.gemini && typeof legacy.key === "string") keys.gemini = legacy.key;
  let model = typeof s.model === "string" && s.model.trim() ? s.model.trim() : "";
  if (!model) {
    model = (provider === "gemini" && typeof legacy.model === "string" && legacy.model)
      ? legacy.model : PROVIDER_INFO[provider].models[0];
  }
  return { provider, model, keys };
}

// ─── Per-provider request builders (pure) ────────
// Each returns {url, headers, body} for the provider's streaming endpoint.
function buildGeminiRequest({ key, model, source, prompt }) {
  const parts = [{ text: prompt }];
  if (source.kind === "pdf") {
    parts.push({ inline_data: { mime_type: "application/pdf", data: source.base64 } });
  } else {
    parts.push({ text: "\n\n--- DOCUMENT ---\n\n" + source.text });
  }
  return {
    url: `${GEMINI_BASE}/${model}:streamGenerateContent?alt=sse`,
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: { contents: [{ parts }], generationConfig: { temperature: 0.4 } },
  };
}

function buildOpenAIRequest({ key, model, source, prompt }) {
  const content = [{ type: "input_text", text: prompt }];
  if (source.kind === "pdf") {
    content.push({
      type: "input_file",
      filename: source.name || "document.pdf",
      file_data: "data:application/pdf;base64," + source.base64,
    });
  } else {
    content[0].text += "\n\n--- DOCUMENT ---\n\n" + source.text;
  }
  return {
    url: "https://api.openai.com/v1/responses",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
    body: { model, input: [{ role: "user", content }], stream: true },
  };
}

function buildClaudeRequest({ key, model, source, prompt }) {
  const content = [];
  if (source.kind === "pdf") {
    content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: source.base64 } });
    content.push({ type: "text", text: prompt });
  } else {
    content.push({ type: "text", text: prompt + "\n\n--- DOCUMENT ---\n\n" + source.text });
  }
  return {
    url: "https://api.anthropic.com/v1/messages",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: { model, max_tokens: 16000, stream: true, messages: [{ role: "user", content }] },
  };
}

// ─── Per-provider SSE chunk extractors (pure) ────
function geminiChunk(data) {
  return (data.candidates?.[0]?.content?.parts ?? []).map(p => p.text ?? "").join("");
}
function openaiChunk(data) {
  return data.type === "response.output_text.delta" ? (data.delta ?? "") : "";
}
function claudeChunk(data) {
  return data.type === "content_block_delta" && data.delta?.type === "text_delta"
    ? (data.delta.text ?? "") : "";
}
```

Then delete the now-duplicate `const GEMINI_BASE = …` line from the constants section below the pure block (it moved inside).

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/`
Expected: all PASS.

- [ ] **Step 5: Syntax-check and commit**

```bash
node --check shared.js
git add shared.js tests/pure.test.mjs
git commit -m "Add provider registry, settings normalizer, and request builders (pure, tested)"
```

---

### Task 2: Generic SSE streamer, `streamSlides` dispatcher, settings load/save

**Files:**
- Modify: `shared.js` (constants section + the `─── Gemini streaming ───` section)

**Interfaces:**
- Consumes: Task 1's builders/extractors, `normalizeAiSettings`, `PROVIDER_INFO`.
- Produces:
  - `const LS_AI = "eduapp_ai"`
  - `loadAiSettings()` → settings object (reads `LS_AI` + legacy keys)
  - `saveAiSettings(settings)` → void
  - `streamSlides({provider, model, key, source, prompt, onChunk})` → Promise\<string\> (full markdown; throws `Error("status: message")` on HTTP errors, `Error(message)` on mid-stream error events)
  - `streamGeminiSlides` stays as a thin wrapper (removed in Task 5 after all callers migrate).

- [ ] **Step 1: Add `LS_AI` + load/save near the other `LS_*` constants**

In the "Cross-app constants" section of `shared.js`:

```js
const LS_AI = "eduapp_ai";

// Current AI settings; folds legacy eduapp_gemini_key / eduapp_model in on first run.
function loadAiSettings() {
  return normalizeAiSettings(localStorage.getItem(LS_AI), {
    key: localStorage.getItem(LS_KEY) ?? "",
    model: localStorage.getItem(LS_MODEL) ?? "",
  });
}
function saveAiSettings(settings) {
  localStorage.setItem(LS_AI, JSON.stringify(settings));
}
```

Keep `LS_KEY` / `LS_MODEL` constants (read-only legacy). `MODELS` and `resolveModel()` stay until Task 5 removes them.

- [ ] **Step 2: Replace the Gemini streaming section with a generic streamer + dispatcher**

Replace the whole `streamGeminiSlides` function (keeping its section header comment updated) with:

```js
// ─── Provider streaming ─────────────────────────
// Generic SSE POST: builds nothing itself — request comes from a build*Request
// helper, per-event text extraction from a *Chunk helper. onChunk(accumulated)
// fires per chunk (throttling is the caller's job). Returns the full text.
async function streamSseRequest({ url, headers, body }, extractChunk, onChunk) {
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) {
    let msg;
    try {
      const e = JSON.parse(await res.text());
      msg = e?.error?.message ?? e?.message;
    } catch { /* non-JSON error body */ }
    throw new Error(`${res.status}: ${msg ?? res.statusText}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "", acc = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      let data;
      try { data = JSON.parse(payload); } catch { continue; }
      // Mid-stream provider errors (e.g. Claude overloaded) arrive as data events.
      if (data.type === "error" || (data.error && !data.candidates)) {
        throw new Error(data.error?.message ?? "stream error");
      }
      const chunk = extractChunk(data);
      if (!chunk) continue;
      acc += chunk;
      onChunk?.(acc);
    }
  }
  return acc;
}

const PROVIDER_STREAMS = {
  gemini: [buildGeminiRequest, geminiChunk],
  openai: [buildOpenAIRequest, openaiChunk],
  claude: [buildClaudeRequest, claudeChunk],
};

// Streams slide markdown from whichever provider the settings select.
function streamSlides({ provider, model, key, source, prompt, onChunk }) {
  const [build, extract] = PROVIDER_STREAMS[provider] ?? PROVIDER_STREAMS.gemini;
  return streamSseRequest(build({ key, model, source, prompt }), extract, onChunk);
}

// Legacy name — TODO(Task 5): remove once app.js and index.html use streamSlides.
function streamGeminiSlides({ key, model, source, prompt, onChunk }) {
  return streamSlides({ provider: "gemini", key, model, source, prompt, onChunk });
}
```

- [ ] **Step 3: Verify**

```bash
node --check shared.js && node --test tests/
```
Expected: syntax OK, all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add shared.js
git commit -m "Add generic SSE streamer and streamSlides dispatcher over the provider registry"
```

---

### Task 3: Shared popup + chip component (`mountAiSelector`)

**Files:**
- Modify: `shared.js` (new section at the end, before the PPTX section)

**Interfaces:**
- Consumes: `PROVIDER_INFO`, `loadAiSettings`, `saveAiSettings`.
- Produces: `mountAiSelector({ chip, getLang })` → `{ refresh() }`.
  - `chip`: a `<button>` element provided by the app; the component fills its text and opens the dialog on click.
  - `getLang`: `() => "pl" | "en"` so the dialog follows the app's UI language.
  - `refresh()`: re-renders chip + dialog strings (call after a language switch).

- [ ] **Step 1: Add the component to `shared.js`**

Add before the "Lazy PPTX dependencies" section:

```js
// ─── AI model selector (chip + <dialog>) ─────────
// One implementation for all apps; visuals inherit each app's fonts/colors
// via CSS variables with neutral fallbacks.
const AI_SELECTOR_CSS = `
.ai-chip{display:inline-flex;align-items:center;gap:.45em;padding:.4em .85em;
  border:1px solid var(--border, currentColor);border-radius:999px;background:transparent;
  color:inherit;font:inherit;font-size:.85em;cursor:pointer;max-width:100%;}
.ai-chip:hover{border-color:var(--accent, currentColor);}
.ai-chip .ai-chip-model{opacity:.75;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ai-dialog{border:1px solid var(--border, #8884);border-radius:12px;padding:1.5rem;
  max-width:26rem;width:calc(100vw - 2rem);background:var(--bg, Canvas);color:inherit;font:inherit;}
.ai-dialog::backdrop{background:rgba(0,0,0,.45);}
.ai-dialog h2{margin:0 0 1rem;font-size:1.1rem;}
.ai-dialog .ai-field{margin-bottom:1rem;display:block;}
.ai-dialog label{display:block;font-size:.8em;opacity:.8;margin-bottom:.3em;}
.ai-dialog select,.ai-dialog input{width:100%;box-sizing:border-box;padding:.5em .6em;
  border:1px solid var(--border, #8884);border-radius:8px;background:transparent;color:inherit;font:inherit;}
.ai-dialog .ai-providers{display:flex;gap:.4rem;}
.ai-dialog .ai-providers button{flex:1;padding:.5em 0;border:1px solid var(--border, #8884);
  border-radius:8px;background:transparent;color:inherit;font:inherit;cursor:pointer;}
.ai-dialog .ai-providers button[aria-pressed="true"]{border-color:var(--accent, currentColor);
  background:var(--accent, currentColor);color:var(--bg, Canvas);}
.ai-dialog .ai-note{font-size:.75em;opacity:.7;margin:.4em 0 0;}
.ai-dialog .ai-note a{color:inherit;}
.ai-dialog .ai-actions{display:flex;justify-content:flex-end;margin-top:1.2rem;}
.ai-dialog .ai-actions button{padding:.5em 1.4em;border:1px solid var(--border, #8884);
  border-radius:999px;background:transparent;color:inherit;font:inherit;cursor:pointer;}
`;

const AI_STRINGS = {
  pl: {
    title: "Model AI", provider: "Dostawca", model: "Model",
    custom: "inny model…", customLabel: "Identyfikator modelu",
    keyLabel: "Klucz API", close: "Zamknij",
    keyHelp: "Klucz zostaje w Twojej przeglądarce (localStorage) i jest wysyłany wyłącznie do wybranego dostawcy. Wygenerujesz go na",
  },
  en: {
    title: "AI model", provider: "Provider", model: "Model",
    custom: "custom model…", customLabel: "Model ID",
    keyLabel: "API key", close: "Close",
    keyHelp: "The key stays in your browser (localStorage) and is sent only to the selected provider. Generate one at",
  },
};

function mountAiSelector({ chip, getLang }) {
  const style = document.createElement("style");
  style.textContent = AI_SELECTOR_CSS;
  document.head.appendChild(style);

  const dialog = document.createElement("dialog");
  dialog.className = "ai-dialog";
  document.body.appendChild(dialog);

  chip.classList.add("ai-chip");
  chip.type = "button";
  chip.addEventListener("click", () => { renderDialog(); dialog.showModal(); });

  let settings = loadAiSettings();

  function save() { saveAiSettings(settings); renderChip(); }

  function renderChip() {
    const info = PROVIDER_INFO[settings.provider];
    chip.innerHTML = "";
    chip.append("⚙ " + info.label + " · ");
    const m = document.createElement("span");
    m.className = "ai-chip-model";
    m.textContent = settings.model;
    chip.appendChild(m);
  }

  function renderDialog() {
    const t = AI_STRINGS[getLang()] ?? AI_STRINGS.pl;
    const info = PROVIDER_INFO[settings.provider];
    const isCurated = info.models.includes(settings.model);
    dialog.innerHTML = `
      <h2>${t.title}</h2>
      <div class="ai-field">
        <label>${t.provider}</label>
        <div class="ai-providers" role="group"></div>
      </div>
      <div class="ai-field">
        <label for="aiModelSelect">${t.model}</label>
        <select id="aiModelSelect"></select>
      </div>
      <div class="ai-field ai-custom" hidden>
        <label for="aiModelCustom">${t.customLabel}</label>
        <input id="aiModelCustom" type="text" spellcheck="false" autocomplete="off" />
      </div>
      <div class="ai-field">
        <label for="aiKey">${t.keyLabel} — ${info.label}</label>
        <input id="aiKey" type="password" autocomplete="off" spellcheck="false" placeholder="${info.keyPlaceholder}" />
        <p class="ai-note">${t.keyHelp}
          <a href="${info.keyUrl}" target="_blank" rel="noopener">${info.keyUrl.replace("https://", "")}</a></p>
      </div>
      <div class="ai-actions"><button type="button" class="ai-close">${t.close}</button></div>`;

    const providersEl = dialog.querySelector(".ai-providers");
    for (const [id, p] of Object.entries(PROVIDER_INFO)) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = p.label;
      b.setAttribute("aria-pressed", String(id === settings.provider));
      b.addEventListener("click", () => {
        if (id === settings.provider) return;
        settings.provider = id;
        settings.model = PROVIDER_INFO[id].models[0];
        save();
        renderDialog();
      });
      providersEl.appendChild(b);
    }

    const modelSel = dialog.querySelector("#aiModelSelect");
    for (const m of info.models) {
      const opt = document.createElement("option");
      opt.value = m; opt.textContent = m;
      modelSel.appendChild(opt);
    }
    const customOpt = document.createElement("option");
    customOpt.value = "__custom__"; customOpt.textContent = t.custom;
    modelSel.appendChild(customOpt);
    modelSel.value = isCurated ? settings.model : "__custom__";

    const customField = dialog.querySelector(".ai-custom");
    const customInput = dialog.querySelector("#aiModelCustom");
    customField.hidden = isCurated;
    customInput.value = isCurated ? "" : settings.model;

    modelSel.addEventListener("change", () => {
      if (modelSel.value === "__custom__") {
        customField.hidden = false;
        customInput.focus();
      } else {
        customField.hidden = true;
        settings.model = modelSel.value;
        save();
      }
    });
    customInput.addEventListener("input", () => {
      const v = customInput.value.trim();
      if (v) { settings.model = v; save(); }
    });

    const keyInput = dialog.querySelector("#aiKey");
    keyInput.value = settings.keys[settings.provider] ?? "";
    keyInput.addEventListener("input", () => {
      settings.keys[settings.provider] = keyInput.value.trim();
      save();
    });

    dialog.querySelector(".ai-close").addEventListener("click", () => dialog.close());
  }

  renderChip();
  return { refresh: renderChip };
}
```

- [ ] **Step 2: Verify syntax + tests still pass**

```bash
node --check shared.js && node --test tests/
```
Expected: OK / PASS.

- [ ] **Step 3: Commit**

```bash
git add shared.js
git commit -m "Add shared AI selector component: chip + provider/model/key dialog"
```

---

### Task 4: Integrate selector into `app.js` (edu.html + quantica.html)

**Files:**
- Modify: `app.js` — settings card markup (~lines 231–259), STRINGS (~lines 90–160), DOM refs (~lines 358–362), `generateSlides()` (~lines 554–599), listeners (~lines 623–624), init (~lines 677–683)

**Interfaces:**
- Consumes: `mountAiSelector`, `loadAiSettings`, `streamSlides`, `PROVIDER_INFO` from `shared.js`.

- [ ] **Step 1: Replace the key/model fields in the settings card**

In the template HTML, replace:

```html
      <div class="field">
        <label class="field-label" for="apiKey" data-i18n="apiKeyLabel"></label>
        <input type="password" id="apiKey" class="mono-input" placeholder="AIza…" autocomplete="off" spellcheck="false" />
        <p class="field-help"><span data-i18n="apiKeyHelp"></span>
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a></p>
      </div>
      <div class="settings-row">
        <div class="field">
          <label class="field-label" for="model" data-i18n="modelLabel"></label>
          <select id="model" class="mono-input"></select>
        </div>
```

with:

```html
      <div class="field">
        <span class="field-label" data-i18n="aiModelLabel"></span>
        <button id="aiChip"></button>
      </div>
      <div class="settings-row">
```

(The slide-language and count fields inside `.settings-row` stay unchanged.)

- [ ] **Step 2: Update STRINGS (both `pl` and `en`)**

Remove `apiKeyLabel`, `apiKeyHelp`, `modelLabel`. Add/replace:

```js
// pl:
aiModelLabel: "Model AI",
errNoKeyBody: "Wklej klucz API dostawcy {provider} w ustawieniach modelu (kliknij wskaźnik modelu). Wygenerujesz go na {url}.",
// en:
aiModelLabel: "AI model",
errNoKeyBody: "Paste your {provider} API key in the model settings (click the model chip). Generate one at {url}.",
```

- [ ] **Step 3: Update DOM refs, listeners, and init**

Replace `const apiKeyEl = document.getElementById("apiKey");` and `const modelEl = document.getElementById("model");` with:

```js
  const aiChipEl = document.getElementById("aiChip");
```

Delete these listener lines:

```js
  apiKeyEl.addEventListener("input", () => localStorage.setItem(LS_KEY, apiKeyEl.value.trim()));
  modelEl.addEventListener("change", () => localStorage.setItem(LS_MODEL, modelEl.value));
```

In the Init section, delete the `MODELS.forEach(...)` block, `apiKeyEl.value = ...`, and `modelEl.value = resolveModel();`, and add:

```js
  const aiSelector = mountAiSelector({ chip: aiChipEl, getLang: () => uiLang });
```

If `setUiLang` re-renders i18n text, add `aiSelector.refresh();` at the end of `setUiLang` (locate `function setUiLang` and append the call inside it).

- [ ] **Step 4: Rewrite `generateSlides()` to use the dispatcher**

Replace the key check and `streamGeminiSlides` call:

```js
  async function generateSlides() {
    const ai = loadAiSettings();
    const key = ai.keys[ai.provider]?.trim();
    if (!key) {
      const info = PROVIDER_INFO[ai.provider];
      return showError(t("errNoKeyTitle"),
        t("errNoKeyBody").replace("{provider}", info.label).replace("{url}", info.keyUrl.replace("https://", "")));
    }
    if (!state.source || state.generating) return;

    state.generating = true;
    errorPanelEl.classList.add("hidden");
    genStatusEl.classList.remove("hidden");
    genStatusTextEl.textContent = t("genSending");
    generateBtn.disabled = true;
    let started = false, lastRender = 0;
    try {
      const acc = await streamSlides({
        provider: ai.provider,
        model: ai.model,
        key,
        source: state.source,
        prompt: buildPrompt({ lang: state.slideLang, countHint: countHintEl.value }),
        onChunk(text) {
          /* body unchanged from the existing onChunk */
        },
      });
      if (!acc.trim()) throw new Error(t("errEmpty"));
      setMd(stripOuterFence(acc.trim()));
      setView("edit");
    } catch (err) {
      showError(t("errApiTitle"), String(err.message ?? err));
    } finally {
      state.generating = false;
      genStatusEl.classList.add("hidden");
      generateBtn.disabled = !state.source;
    }
  }
```

Keep the existing `onChunk` body verbatim (the throttled editor/preview updates). Also update the section header comment `// ─── Gemini ───` to `// ─── Generation (provider-agnostic) ───`.

- [ ] **Step 5: Verify**

```bash
node --check app.js
python3 -m http.server 8765 --directory /home/andrzey/git-claude/slidegen &
sleep 1
google-chrome --headless=new --disable-gpu --screenshot=/tmp/claude-1000/edu.png --window-size=1400,1000 "http://localhost:8765/edu.html" 2>/dev/null
kill %1
```

Read `/tmp/claude-1000/edu.png` and confirm: no key/model fields; a chip like `⚙ Gemini · gemini-3.5-flash` appears in the settings card. Repeat the screenshot for `quantica.html`. Then check the dialog opens (headless click is impractical — verify interactively in Task 6, but ensure no console errors: rerun with `--enable-logging=stderr` and grep for `Uncaught`).

- [ ] **Step 6: Commit**

```bash
git add app.js
git commit -m "edu/quantica: replace inline key+model fields with shared AI selector chip"
```

---

### Task 5: Integrate selector into `index.html` (styler) and remove legacy code

**Files:**
- Modify: `index.html` — sidebar section (~lines 360–377), STRINGS (~lines 505–560), listeners/init (~lines 860–946), `generateSlidesFromSource` (~lines 866–899)
- Modify: `shared.js` — remove legacy `streamGeminiSlides`, `MODELS`, `resolveModel`

**Interfaces:**
- Consumes: `mountAiSelector`, `loadAiSettings`, `streamSlides`, `PROVIDER_INFO`.

- [ ] **Step 1: Replace the Gemini section markup**

Replace:

```html
    <section>
      <h2>Gemini</h2>
      <div class="field">
        <label for="apiKey" data-i18n="apiKeyLabel"></label>
        <input type="password" id="apiKey" placeholder="AIza…" autocomplete="off" spellcheck="false" />
        <p class="note"><span data-i18n="apiKeyHelp"></span>
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a></p>
      </div>
```

with:

```html
    <section>
      <h2 data-i18n="aiSectionTitle"></h2>
      <div class="field">
        <button id="aiChip"></button>
      </div>
```

- [ ] **Step 2: Update STRINGS in `index.html` (pl + en)**

Remove `apiKeyLabel` / `apiKeyHelp`. Add:

```js
// pl:
aiSectionTitle: "Model AI",
errNoKey: "Wklej klucz API dostawcy {provider} w ustawieniach modelu (kliknij wskaźnik). Wygenerujesz go na {url}.",
// en:
aiSectionTitle: "AI model",
errNoKey: "Paste your {provider} API key in the model settings (click the chip). Generate one at {url}.",
```

(There is an existing `errNoKey` string — replace its text with the above.)

- [ ] **Step 3: Update JS in `index.html`**

- Remove the `apiKeyEl` DOM ref (line ~823) and its two uses (`addEventListener` line ~860, `apiKeyEl.value = ...` line ~946).
- Add after the other init code:

```js
const aiSelector = mountAiSelector({ chip: $("aiChip"), getLang: () => uiLang });
```

If the styler has a `setUiLang`/`applyI18n` function, append `aiSelector.refresh();` inside it.

- In `generateSlidesFromSource`, replace the key check and call:

```js
async function generateSlidesFromSource() {
  const ai = loadAiSettings();
  const key = ai.keys[ai.provider]?.trim();
  if (!key) {
    const info = PROVIDER_INFO[ai.provider];
    return note(genNoteEl,
      t("errNoKey").replace("{provider}", info.label).replace("{url}", info.keyUrl.replace("https://", "")), true);
  }
  if (!state.source || state.generating) return;

  state.generating = true;
  reflectSource();
  note(genNoteEl, t("genSending"));
  let lastRender = 0;
  try {
    const acc = await streamSlides({
      provider: ai.provider,
      model: ai.model,
      key,
      source: state.source,
      prompt: buildPrompt({ lang: state.slideLang }),
      onChunk(text) {
        /* body unchanged from the existing onChunk */
      },
    });
    if (!acc.trim()) throw new Error(t("errEmpty"));
    setMd(stripOuterFence(acc.trim()));
    note(genNoteEl, t("genDone"));
  } catch (err) {
    note(genNoteEl, String(err.message ?? err), true);
  } finally {
    state.generating = false;
    reflectSource();
  }
}
```

- [ ] **Step 4: Remove legacy code from `shared.js`**

Delete the `streamGeminiSlides` wrapper, the `MODELS` constant, and `resolveModel()` (grep first to confirm no remaining callers):

```bash
grep -rn "streamGeminiSlides\|resolveModel\|MODELS" app.js index.html edu.html quantica.html shared.js
```
Expected after deletion: no matches outside comments.

- [ ] **Step 5: Verify**

```bash
node --check shared.js && node --test tests/
python3 -m http.server 8765 --directory /home/andrzey/git-claude/slidegen &
sleep 1
google-chrome --headless=new --disable-gpu --screenshot=/tmp/claude-1000/styler.png --window-size=1400,1000 "http://localhost:8765/index.html" 2>/dev/null
kill %1
```
Read the screenshot: sidebar shows the "Model AI" section with the chip, no key field, no console `Uncaught` errors.

- [ ] **Step 6: Commit**

```bash
git add index.html shared.js
git commit -m "styler: adopt AI selector chip; drop legacy Gemini-only pipeline"
```

---

### Task 6: Live verification, README, wrap-up

**Files:**
- Modify: `README.md` (features section)

- [ ] **Step 1: Full test + syntax sweep**

```bash
node --test tests/ && node --check shared.js && node --check app.js && node --check pptx-export.js
```
Expected: all PASS / no errors.

- [ ] **Step 2: Interactive browser verification (Claude-in-Chrome or ask the user)**

For each of `edu.html`, `quantica.html`, `index.html` served locally:
1. Chip renders with the persisted provider/model; legacy Gemini key (if present in localStorage) appears pre-filled under Gemini in the dialog.
2. Open dialog → switch provider → model list swaps, key field swaps, chip updates.
3. "custom…" reveals the text input; typing updates the chip; reload persists it.
4. With a dummy key per provider, click Generate: DevTools Network shows a request to the right endpoint (`generativelanguage.googleapis.com` / `api.openai.com/v1/responses` / `api.anthropic.com/v1/messages`) and the error panel shows `401: …`-style text.
5. With the user's real Gemini key: generate a deck end-to-end from `sample.md` to confirm no regression. If the user provides OpenAI/Claude keys, repeat for those.

- [ ] **Step 3: Update README**

In `README.md`, update the features bullet:

```markdown
- **Document → slides via your choice of AI** — drop a `.txt`, `.md`, or `.pdf`
  and pick the provider and model (Gemini, OpenAI, or Claude) in the model
  popup; your API key is stored only in your browser and sent only to the
  selected provider; slides stream in live
```

Also mention the chip: "The active provider/model shows as a compact chip in the workspace; click it to change provider, model (including any custom model ID), or key."

- [ ] **Step 4: Commit and hand off**

```bash
git add README.md
git commit -m "README: document multi-provider model selector"
```

Ask the user whether to push to `main` (GitHub Pages deploys from it).
