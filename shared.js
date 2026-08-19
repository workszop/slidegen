/* ============================================================
   shared.js — DOM, storage, streaming transport, and UI services
   shared by app.js (edulab/Quantica brand apps).

   Load ai-models.js then pure.js first, then shared.js before
   app.js. Pure string helpers, the AI provider catalogue, model
   discovery, and the request builders live in pure.js; this file
   consumes them as globals.
   ============================================================ */

// ─── Cross-app constants (the localStorage names are a contract:
//     all apps share one key / model / UI language) ─────────────
const LS_LANG = "eduapp_lang", LS_KEY = "eduapp_gemini_key", LS_MODEL = "eduapp_model";
const LS_AI = "eduapp_ai";
const MAX_INLINE_MB = 19;
const MAX_INLINE_BYTES = MAX_INLINE_MB * 1024 * 1024;
const MAX_TEXT_MB = 2;
const MAX_TEXT_BYTES = MAX_TEXT_MB * 1024 * 1024;
const DEFAULT_STREAM_TIMEOUT_MS = 180_000;
const DEFAULT_IMAGE_TIMEOUT_MS = 180_000;

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

async function generateOpenAIImage({ key, model, prompt, onPartial, signal, timeoutMs = DEFAULT_IMAGE_TIMEOUT_MS }) {
  const req = buildOpenAIImageRequest({ key, model, prompt });
  const request = createRequestSignal(signal, timeoutMs);
  try {
    const res = await fetch(req.url, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify(req.body),
      signal: request.signal,
    });
    if (!res.ok) throw await responseError(res);
    if (!res.body) throw makeResponseError("OpenAI returned no image stream");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "", latestBase64 = "";
    const handleFrames = frames => {
      for (const frame of frames) {
        const raw = frame.data.trim();
        if (!raw || raw === "[DONE]") continue;
        let event;
        try { event = JSON.parse(raw); } catch { continue; }
        const message = providerErrorMessage(event, frame.event);
        if (message) throw makeProviderError(message);
        if (["image_generation.partial_image", "image_generation.completed"].includes(event.type) && event.b64_json) {
          latestBase64 = event.b64_json;
          onPartial?.(`data:image/jpeg;base64,${latestBase64}`, event.type === "image_generation.completed");
        }
      }
    };
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parsed = parseSseFrames(buffer);
      buffer = parsed.remainder;
      handleFrames(parsed.events);
    }
    buffer += decoder.decode();
    handleFrames(parseSseFrames(buffer, { final: true }).events);
    if (!latestBase64) throw new Error("OpenAI returned no image data");
    return `data:image/jpeg;base64,${latestBase64}`;
  } catch (cause) {
    if (cause?.isResponseError || cause?.code === "api_error" || cause?.code === "timeout") throw cause;
    if (request.signal.aborted) throw transportError(req.url, cause, request.signal);
    if (isAbortError(cause)) throw cause;
    throw transportError(req.url, cause, request.signal);
  } finally {
    request.cleanup();
  }
}

function makeNetworkError(url, cause) {
  const err = new Error("network_error", { cause });
  err.code = "network_error";
  try { err.host = new URL(url).host; } catch { err.host = url; }
  return err;
}

function makeTimeoutError(timeoutMs) {
  const err = new Error(`Request timed out after ${Math.ceil(timeoutMs / 1000)} seconds`);
  err.code = "timeout";
  return err;
}

function isAbortError(cause) {
  return cause?.name === "AbortError" || cause?.name === "TimeoutError";
}

function transportError(url, cause, signal) {
  if (signal?.aborted) return signal.reason ?? cause;
  if (isAbortError(cause)) return cause;
  return makeNetworkError(url, cause);
}

// A distinct controller lets callers cancel while also giving a stalled
// browser request a bounded lifetime. POST requests are deliberately not
// retried: a provider may have accepted and billed the first request.
function createRequestSignal(externalSignal, timeoutMs) {
  const controller = new AbortController();
  const safeTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_STREAM_TIMEOUT_MS;
  const forwardAbort = () => controller.abort(externalSignal.reason);
  if (externalSignal?.aborted) forwardAbort();
  else externalSignal?.addEventListener("abort", forwardAbort, { once: true });
  const timeoutId = setTimeout(() => controller.abort(makeTimeoutError(safeTimeout)), safeTimeout);
  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timeoutId);
      externalSignal?.removeEventListener("abort", forwardAbort);
    },
  };
}

async function responseError(res) {
  let message = res.statusText;
  try {
    const payload = JSON.parse(await res.text());
    message = payload?.error?.message ?? payload?.message ?? message;
  } catch { /* keep HTTP status text */ }
  return makeResponseError(`${res.status}: ${message}`);
}

function makeResponseError(message) {
  const err = new Error(message);
  err.isResponseError = true;
  return err;
}

function makeProviderError(message, { code = "api_error" } = {}) {
  const err = new Error(message || "stream error");
  err.code = code;
  return err;
}

function providerErrorMessage(data, eventName = "") {
  if (eventName === "error" || data?.type === "error" || data?.type === "response.failed" || data?.error) {
    return data?.error?.message ?? data?.response?.error?.message ?? data?.message ?? "stream error";
  }
  return "";
}

// ─── File intake ────────────────────────────────
// Resolves {name, kind:"text"|"pdf", text?|base64?}; rejects Error("type"|"size"|"read").
function readSourceFile(file) {
  return new Promise((resolve, reject) => {
    const name = file.name ?? "document";
    const fileType = file.type ?? "";
    const isPdf = /\.pdf$/i.test(name) || fileType === "application/pdf";
    const isText = /\.(txt|md|markdown)$/i.test(name) || fileType.startsWith("text/");
    if (!isPdf && !isText) return reject(new Error("type"));
    if (isPdf && file.size > MAX_INLINE_BYTES) return reject(new Error("size"));
    if (isText && file.size > MAX_TEXT_BYTES) return reject(new Error("size"));
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
async function streamSseRequest({ url, headers, body }, extractChunk, onChunk, { signal, timeoutMs = DEFAULT_STREAM_TIMEOUT_MS, onNotice } = {}) {
  const request = createRequestSignal(signal, timeoutMs);
  let stopReason = "";
  try {
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: request.signal });
    if (!res.ok) throw await responseError(res);
    if (!res.body) throw makeResponseError("Provider returned no response stream");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "", acc = "";
    const handleFrames = frames => {
      for (const frame of frames) {
        const payload = frame.data.trim();
        if (!payload || payload === "[DONE]") continue;
        let data;
        try { data = JSON.parse(payload); } catch { continue; }
        const message = providerErrorMessage(data, frame.event);
        if (message) throw makeProviderError(message);
        stopReason = providerStopReason(data) || stopReason;
        const chunk = extractChunk(data);
        if (!chunk) continue;
        acc += chunk;
        onChunk?.(acc);
      }
    };
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parsed = parseSseFrames(buf);
      buf = parsed.remainder;
      handleFrames(parsed.events);
    }
    buf += decoder.decode();
    handleFrames(parseSseFrames(buf, { final: true }).events);
    // A refusal yields no text, so reporting it beats the caller's generic
    // "empty response". A truncated deck is still usable, so it is surfaced
    // as a notice rather than discarded.
    if (stopReason === "blocked") throw makeProviderError("blocked", { code: "blocked" });
    if (stopReason === "truncated") onNotice?.({ code: "truncated" });
    return acc;
  } catch (cause) {
    if (cause?.isResponseError || cause?.code === "api_error" || cause?.code === "blocked" || cause?.code === "timeout") throw cause;
    if (request.signal.aborted) throw transportError(url, cause, request.signal);
    if (isAbortError(cause)) throw cause;
    throw transportError(url, cause, request.signal);
  } finally {
    request.cleanup();
  }
}

const PROVIDER_STREAMS = {
  gemini: [buildGeminiRequest, geminiChunk],
  openai: [buildOpenAIRequest, openaiChunk],
  claude: [buildClaudeRequest, claudeChunk],
};

// Streams slide markdown from whichever provider the settings select.
function streamSlides({ provider, model, key, source, prompt, onChunk, onNotice, signal, timeoutMs }) {
  const [build, extract] = PROVIDER_STREAMS[provider] ?? PROVIDER_STREAMS[DEFAULT_PROVIDER];
  return streamSseRequest(build({ key, model, source, prompt }), extract, onChunk, { signal, timeoutMs, onNotice });
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
    imageModel: "Model obrazu",
    imageHelp: "Ilustracje generuje OpenAI niezależnie od dostawcy tekstu i wymagają klucza OpenAI.",
    discovered: "wykryty",
  },
  en: {
    title: "AI model", provider: "Provider", model: "Model",
    custom: "custom model…", customLabel: "Model ID",
    keyLabel: "API key", close: "Close",
    keyHelp: "The key stays in your browser (localStorage) and is sent only to the selected provider. Generate one at",
    imageModel: "Image model",
    imageHelp: "Illustrations are generated by OpenAI regardless of the text provider and need an OpenAI key.",
    discovered: "discovered",
  },
};

function mountAiSelector({ chip, getLang, images = false }) {
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
      ${images ? `
      <div class="ai-field">
        <label for="aiImageModel">${t.imageModel}</label>
        <select id="aiImageModel"></select>
        <p class="ai-note">${t.imageHelp}</p>
      </div>` : ""}
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
    const customOpt = () => {
      const o = document.createElement("option");
      o.value = "__custom__"; o.textContent = t.custom;
      return o;
    };
    // Populate the select from a model list; discovered models the curated
    // catalog does not know are tagged so the user can tell them apart.
    const fillModels = list => {
      const current = modelSel.value;
      modelSel.innerHTML = "";
      for (const m of list) {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = info.models.includes(m) ? m : `${m} (${t.discovered})`;
        modelSel.appendChild(opt);
      }
      modelSel.appendChild(customOpt());
      modelSel.value = list.includes(current) && current !== "__custom__" ? current
        : (isCurated ? settings.model : "__custom__");
    };
    fillModels(info.models);
    if (modelSel.value === "__custom__" && isCurated) modelSel.value = settings.model;

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

    const imageSel = dialog.querySelector("#aiImageModel");
    if (imageSel) {
      for (const m of OPENAI_IMAGE_MODELS) {
        const opt = document.createElement("option");
        opt.value = m; opt.textContent = m;
        imageSel.appendChild(opt);
      }
      // A stored custom ID stays selectable instead of silently snapping back.
      if (!OPENAI_IMAGE_MODELS.includes(settings.imageModel)) {
        const opt = document.createElement("option");
        opt.value = settings.imageModel; opt.textContent = settings.imageModel;
        imageSel.appendChild(opt);
      }
      imageSel.value = settings.imageModel;
      imageSel.addEventListener("change", () => {
        settings.imageModel = imageSel.value;
        save();
      });
    }

    dialog.querySelector(".ai-close").addEventListener("click", () => dialog.close());

    // Discover live models once the dialog is up; a saved key unlocks the
    // provider's list endpoint. Best-effort: failure leaves the curated list.
    const discoverKey = settings.keys[settings.provider]?.trim();
    if (discoverKey && !settings.provider.startsWith("__")) {
      const forProvider = settings.provider;
      discoverProviderModels(forProvider, discoverKey).then(list => {
        // The user may have switched providers while the fetch was in flight;
        // only repopulate when the dialog still shows this provider.
        if (!dialog.open || settings.provider !== forProvider) return;
        const extra = list.filter(m => !info.models.includes(m));
        if (extra.length) fillModels(list);
      }).catch(() => { /* discovery is best-effort */ });
    }
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
const JSZIP_CDN = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";
const JSZIP_SRI = "sha384-+mbV2IY1Zk/X1p/nWllGySJSUN8uMs+gUAN10Or95UBH0fpj6GfKgPmgC5EXieXG";

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
  if (typeof JSZip === "undefined") await loadScript(JSZIP_CDN, JSZIP_SRI);
  if (typeof exportDeckToPptx === "undefined") await loadScript(exporterSrc);
}
