/* ============================================================
   shared.js — helpers, constants, and services shared by
   app.js (edulab/Quantica brand apps) and styler/.

   Load ai-models.js first, then shared.js before app.js. Top-level
   const/function declarations here are visible to later classic scripts.

   The pure string helpers between the markers are unit-tested by
   tests/pure.test.mjs.
   ============================================================ */

/* pure-helpers:start */
// Pure string helpers — no DOM.

// Remove ONE wrapping ``` / ```markdown fence if the whole text is fenced.
function stripOuterFence(md) {
  const m = md.trim().match(/^```[a-zA-Z]*\n([\s\S]*?)\n?```$/);
  if (!m) return md;
  // Only strip when the closing fence is the outer one, i.e. the inner
  // content does not itself end with an unbalanced fence opener.
  const inner = m[1];
  const fenceCount = (inner.match(/^```/gm) ?? []).length;
  return fenceCount % 2 === 0 ? inner.trim() : md;
}

// Split markdown into slides on lines that are exactly --- (outside code fences).
function splitSlides(md) {
  const lines = md.split("\n");
  const segments = [];
  let buf = [];
  let inFence = false;
  for (const line of lines) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    if (!inFence && /^\s*---\s*$/.test(line)) {
      segments.push(buf.join("\n"));
      buf = [];
    } else {
      buf.push(line);
    }
  }
  segments.push(buf.join("\n"));
  const slides = segments.map(s => s.trim()).filter(Boolean);
  return slides.length ? slides : [md];
}

// "pl" when Polish diacritics or common PL stopwords are present; default "pl".
function detectLang(text) {
  if (!text || !text.trim()) return "pl";
  const letters = (text.match(/\p{L}/gu) ?? []).length;
  const plChars = (text.match(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g) ?? []).length;
  if (letters && plChars / letters >= 0.005) return "pl";
  if (/\s(się|jest|oraz|które|który|żeby|dla)\s/i.test(text)) return "pl";
  return "en";
}

// Full instruction prompt for Gemini. countHint is optional ("auto"/undefined = model's choice).
function buildPrompt({ lang, countHint, additionalPrompt }) {
  const language =
    lang === "pl" ? "po polsku (in Polish, „polskim” języku)"
    : lang === "en" ? "in English"
    : "in the same language as the source document";
  let p =
    "You are preparing teaching slides from the attached document for a training workshop.\n" +
    "Requirements:\n" +
    "- Cover ALL key concepts and topics of the document — nothing important may be missing.\n" +
    "- One idea per slide; at most ~6 bullet points per slide.\n" +
    "- First slide: `# <deck title>` plus one short intro line.\n" +
    "- Every other slide starts with `## <heading>`.\n" +
    "- Separate slides with a line containing only `---`.\n" +
    "- You may end with a short summary slide.\n" +
    `- Write the slides ${language}.\n`;
  if (countHint && countHint !== "auto") p += `- Aim for about ${countHint} slides.\n`;
  p += "- Output raw markdown only — no surrounding code fence, no commentary.\n";
  if (additionalPrompt?.trim()) {
    p += "\nAdditional instructions from the user (apply them without breaking the markdown format above):\n" +
      additionalPrompt.trim() + "\n";
  }
  return p;
}

// Deck title = text of the first `# ` heading.
function deckTitle(md) {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : "";
}

// A deck opens with a title slide when it starts with a single-# heading.
// One rule for the HTML renderers and the PPTX exporter.
function isTitleSlide(md) {
  return /^#\s/.test(md.trim());
}

// First family name from a CSS font-family list, unquoted.
function firstFont(ff) {
  return ff.split(",")[0].trim().replace(/^["']|["']$/g, "");
}

// Clamp a candidate editor-panel width to [min, maxFraction × viewport].
// null for non-finite input (absent/corrupt storage) — caller keeps the default.
function clampPanelWidth(x, min, maxFraction, viewportW) {
  if (!Number.isFinite(x)) return null;
  return Math.min(Math.max(x, min), Math.max(min, maxFraction * viewportW));
}

// ─── AI provider registry ───────────────────────
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const SUPPORTED_PROVIDER_IDS = ["gemini", "openai", "claude"];

function validateModelCatalog(catalog) {
  if (!catalog || typeof catalog !== "object" || !catalog.providers || typeof catalog.providers !== "object") {
    throw new Error("Invalid AI model catalogue: missing providers");
  }
  const providers = {};
  for (const id of SUPPORTED_PROVIDER_IDS) {
    const p = catalog.providers[id];
    if (!p || typeof p !== "object") throw new Error(`Invalid AI model catalogue: missing provider ${id}`);
    if (typeof p.label !== "string" || !p.label.trim()) throw new Error(`Invalid AI model catalogue: ${id}.label`);
    if (!Array.isArray(p.models) || !p.models.length) throw new Error(`Invalid AI model catalogue: ${id}.models`);
    const models = p.models.map(model => typeof model === "string" ? model.trim() : "");
    if (models.some(model => !model || /\s/.test(model))) throw new Error(`Invalid AI model catalogue: ${id} has an invalid model ID`);
    if (new Set(models).size !== models.length) throw new Error(`Invalid AI model catalogue: ${id} has duplicate model IDs`);
    if (typeof p.keyPlaceholder !== "string") throw new Error(`Invalid AI model catalogue: ${id}.keyPlaceholder`);
    if (typeof p.keyUrl !== "string" || !p.keyUrl.startsWith("https://")) throw new Error(`Invalid AI model catalogue: ${id}.keyUrl`);
    providers[id] = Object.freeze({ ...p, models: Object.freeze(models) });
  }
  const extra = Object.keys(catalog.providers).filter(id => !SUPPORTED_PROVIDER_IDS.includes(id));
  if (extra.length) throw new Error(`Invalid AI model catalogue: unsupported provider ${extra[0]}`);
  const defaultProvider = SUPPORTED_PROVIDER_IDS.includes(catalog.defaultProvider)
    ? catalog.defaultProvider : SUPPORTED_PROVIDER_IDS[0];
  if (!Array.isArray(catalog.imageModels) || !catalog.imageModels.length) {
    throw new Error("Invalid AI model catalogue: missing imageModels");
  }
  const imageModels = catalog.imageModels.map(model => typeof model === "string" ? model.trim() : "");
  if (imageModels.some(model => !model || /\s/.test(model))) {
    throw new Error("Invalid AI model catalogue: invalid image model ID");
  }
  if (new Set(imageModels).size !== imageModels.length) {
    throw new Error("Invalid AI model catalogue: duplicate image model IDs");
  }
  return Object.freeze({
    defaultProvider,
    providers: Object.freeze(providers),
    imageModels: Object.freeze(imageModels),
  });
}

const MODEL_CATALOG = validateModelCatalog(
  typeof AI_MODEL_CATALOG === "undefined" ? null : AI_MODEL_CATALOG
);
const DEFAULT_PROVIDER = MODEL_CATALOG.defaultProvider;
const PROVIDER_INFO = MODEL_CATALOG.providers;
const OPENAI_IMAGE_MODELS = MODEL_CATALOG.imageModels;

// Parse the eduapp_ai JSON (raw string or null) into valid settings,
// folding in the legacy single-provider values ({key, model}) on first run.
function normalizeAiSettings(raw, legacy = {}) {
  let s = {};
  try { s = JSON.parse(raw) ?? {}; } catch { /* corrupt JSON — use defaults */ }
  if (typeof s !== "object" || Array.isArray(s)) s = {};
  const provider = PROVIDER_INFO[s.provider] ? s.provider : DEFAULT_PROVIDER;
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

function buildOpenAIImageRequest({ key, model, prompt }) {
  return {
    url: "https://api.openai.com/v1/images/generations",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
    body: {
      model,
      prompt,
      n: 1,
      size: "1536x1024",
      quality: "low",
      output_format: "jpeg",
      stream: true,
      partial_images: 1,
    },
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
/* pure-helpers:end */

// ─── Cross-app constants (the localStorage names are a contract:
//     all apps share one key / model / UI language) ─────────────
const LS_LANG = "eduapp_lang", LS_KEY = "eduapp_gemini_key", LS_MODEL = "eduapp_model";
const LS_AI = "eduapp_ai";
const MAX_INLINE_MB = 19;
const MAX_INLINE_BYTES = MAX_INLINE_MB * 1024 * 1024;

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

async function generateOpenAIImage({ key, model, prompt, onPartial }) {
  const req = buildOpenAIImageRequest({ key, model, prompt });
  let res;
  try {
    res = await fetch(req.url, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify(req.body),
    });
  } catch (cause) {
    throw makeNetworkError(req.url, cause);
  }
  if (!res.ok) {
    let message = res.statusText;
    try {
      const payload = await res.json();
      message = payload?.error?.message ?? payload?.message ?? message;
    } catch { /* keep HTTP status text */ }
    throw new Error(`${res.status}: ${message}`);
  }
  if (!res.body) throw new Error("OpenAI returned no image stream");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", latestBase64 = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const raw = line.slice(5).trim();
        if (!raw || raw === "[DONE]") continue;
        let event;
        try { event = JSON.parse(raw); } catch { continue; }
        if (event.type === "error" || event.error) {
          const streamError = new Error(event.error?.message ?? event.message ?? "OpenAI image stream failed");
          streamError.code = "api_error";
          throw streamError;
        }
        if (["image_generation.partial_image", "image_generation.completed"].includes(event.type) && event.b64_json) {
          latestBase64 = event.b64_json;
          onPartial?.(`data:image/jpeg;base64,${latestBase64}`, event.type === "image_generation.completed");
        }
      }
    }
  } catch (cause) {
    if (cause?.code === "api_error") throw cause;
    throw makeNetworkError(req.url, cause);
  }
  if (!latestBase64) throw new Error("OpenAI returned no image data");
  return `data:image/jpeg;base64,${latestBase64}`;
}

function makeNetworkError(url, cause) {
  const err = new Error("network_error", { cause });
  err.code = "network_error";
  try { err.host = new URL(url).host; } catch { err.host = url; }
  return err;
}

async function fetchWithNetworkRetry(url, options) {
  try {
    return await fetch(url, options);
  } catch {
    // A single short retry handles transient DNS/connection failures without
    // hiding persistent browser, extension, or firewall blocks.
    await new Promise(resolve => setTimeout(resolve, 500));
    try {
      return await fetch(url, options);
    } catch (cause) {
      throw makeNetworkError(url, cause);
    }
  }
}

// ─── File intake ────────────────────────────────
// Resolves {name, kind:"text"|"pdf", text?|base64?}; rejects Error("type"|"size"|"read").
function readSourceFile(file) {
  return new Promise((resolve, reject) => {
    const name = file.name;
    const isPdf = /\.pdf$/i.test(name) || file.type === "application/pdf";
    const isText = /\.(txt|md|markdown)$/i.test(name) || file.type.startsWith("text/");
    if (!isPdf && !isText) return reject(new Error("type"));
    if (isPdf && file.size > MAX_INLINE_BYTES) return reject(new Error("size"));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    if (isPdf) {
      reader.onload = () => resolve({ name, kind: "pdf", base64: reader.result.split(",")[1] });
      reader.readAsDataURL(file);
    } else {
      reader.onload = () => resolve({ name, kind: "text", text: reader.result });
      reader.readAsText(file);
    }
  });
}

// ─── Provider streaming ─────────────────────────
// Generic SSE POST: builds nothing itself — request comes from a build*Request
// helper, per-event text extraction from a *Chunk helper. onChunk(accumulated)
// fires per chunk (throttling is the caller's job). Returns the full text.
async function streamSseRequest({ url, headers, body }, extractChunk, onChunk) {
  const res = await fetchWithNetworkRetry(url, { method: "POST", headers, body: JSON.stringify(body) });
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
      if (data.type === "error" || data.type === "response.failed" || (data.error && !data.candidates)) {
        throw new Error(data.error?.message ?? data.response?.error?.message ?? data.message ?? "stream error");
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
  const [build, extract] = PROVIDER_STREAMS[provider] ?? PROVIDER_STREAMS[DEFAULT_PROVIDER];
  return streamSseRequest(build({ key, model, source, prompt }), extract, onChunk);
}

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
    chip.innerHTML = "";
    chip.append("⚙ ");
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

// ─── Editor panel resizer (drag the left edge) ───
// Injected once; visuals inherit each app's --accent/--border aliases
// (same convention as the AI selector). Hidden on the mobile breakpoint,
// where the panel is a fixed overlay and the stored width is ignored.
const PANEL_RESIZER_CSS = `
.panel-resizer{position:absolute;left:-3px;top:0;bottom:0;width:6px;
  cursor:col-resize;z-index:25;touch-action:none;}
.panel-resizer:hover,body.panel-resizing .panel-resizer{
  background:color-mix(in srgb, var(--accent, #888) 35%, transparent);}
body.panel-resizing{cursor:col-resize;user-select:none;}
@media (min-width: 769px){.has-panel-resizer{position:relative;}}
@media (max-width: 768px){.panel-resizer{display:none;}}
`;

function mountPanelResizer({ panel, storageKey, min = 280, maxFraction = 0.6 }) {
  if (!document.getElementById("panelResizerCss")) {
    const style = document.createElement("style");
    style.id = "panelResizerCss";
    style.textContent = PANEL_RESIZER_CSS;
    document.head.appendChild(style);
  }
  panel.classList.add("has-panel-resizer");
  const handle = document.createElement("div");
  handle.className = "panel-resizer";
  panel.appendChild(handle);

  const apply = w => panel.style.setProperty("--editor-w", w + "px");
  const stored = clampPanelWidth(
    parseFloat(localStorage.getItem(storageKey)), min, maxFraction, window.innerWidth);
  if (stored !== null) apply(stored); // re-clamped on mount (window may have shrunk)

  // Drag state lives in a flag, with move/up on window: pointer capture is
  // only an optimization (keeps events flowing outside the window), never
  // the mechanism — if it fails the drag still works and always cleans up.
  let width = null, dragging = false;
  handle.addEventListener("pointerdown", e => {
    e.preventDefault();
    dragging = true;
    try { handle.setPointerCapture(e.pointerId); } catch { /* optional */ }
    document.body.classList.add("panel-resizing");
  });
  window.addEventListener("pointermove", e => {
    if (!dragging) return;
    const w = clampPanelWidth(
      panel.getBoundingClientRect().right - e.clientX, min, maxFraction, window.innerWidth);
    if (w !== null) { width = w; apply(w); }
  });
  const finish = () => {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove("panel-resizing");
    if (width !== null) localStorage.setItem(storageKey, String(Math.round(width)));
    width = null;
  };
  window.addEventListener("pointerup", finish);
  window.addEventListener("pointercancel", finish);
  handle.addEventListener("dblclick", () => {
    localStorage.removeItem(storageKey);
    panel.style.removeProperty("--editor-w");
  });
}

// ─── Lazy PPTX dependencies ─────────────────────
const PPTX_CDN = "https://cdn.jsdelivr.net/npm/pptxgenjs@4.0.1/dist/pptxgen.bundle.js";
const PPTX_SRI = "sha384-qb0Xhi7LLYpvW1HCK6oMrmDLSY9sy7vwm6ZlV6KjtrlL9yg30+YN4neTwnmX+Kp8";

function loadScript(src, integrity) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    if (integrity) { s.integrity = integrity; s.crossOrigin = "anonymous"; }
    s.onload = resolve;
    s.onerror = () => reject(new Error("script load failed: " + src));
    document.head.appendChild(s);
  });
}

async function ensurePptxDeps(exporterSrc = "pptx-export.js") {
  if (typeof PptxGenJS === "undefined") await loadScript(PPTX_CDN, PPTX_SRI);
  if (typeof exportDeckToPptx === "undefined") await loadScript(exporterSrc);
}
