/* ============================================================
   shared.js — helpers, constants, and services shared by
   app.js (edulab/Quantica brand apps) and styler/.

   Load with <script defer src="shared.js"> BEFORE app.js, or as
   <script src="../shared.js"> in styler. Top-level const/function
   declarations here are visible to later classic scripts.

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
function buildPrompt({ lang, countHint }) {
  const language = lang === "pl" ? "po polsku (in Polish, „polskim” języku)" : "in English";
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
  p += "- Output raw markdown only — no surrounding code fence, no commentary.";
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
/* pure-helpers:end */

// ─── Cross-app constants (the localStorage names are a contract:
//     all apps share one key / model / UI language) ─────────────
const LS_LANG = "eduapp_lang", LS_KEY = "eduapp_gemini_key", LS_MODEL = "eduapp_model";
const MODELS = ["gemini-3.5-flash", "gemini-3.1-flash-lite-preview"];
const MAX_INLINE_MB = 19;
const MAX_INLINE_BYTES = MAX_INLINE_MB * 1024 * 1024;
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Stored model if it is still offered, else the current default.
function resolveModel() {
  const saved = localStorage.getItem(LS_MODEL);
  return MODELS.includes(saved) ? saved : MODELS[0];
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

// ─── Gemini streaming ───────────────────────────
// Streams slide markdown for a source document; onChunk(accumulatedText)
// fires per SSE chunk (throttling is the caller's job). Returns the full
// text; throws Error("status: message") on HTTP errors.
async function streamGeminiSlides({ key, model, source, prompt, onChunk }) {
  const parts = [{ text: prompt }];
  if (source.kind === "pdf") {
    parts.push({ inline_data: { mime_type: "application/pdf", data: source.base64 } });
  } else {
    parts.push({ text: "\n\n--- DOCUMENT ---\n\n" + source.text });
  }
  const res = await fetch(`${GEMINI_BASE}/${model}:streamGenerateContent?alt=sse`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.4 } }),
  });
  if (!res.ok) {
    let msg;
    try { msg = JSON.parse(await res.text())?.error?.message; } catch { /* non-JSON error body */ }
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
      let data;
      try { data = JSON.parse(line.slice(5).trim()); } catch { continue; }
      const chunk = (data.candidates?.[0]?.content?.parts ?? []).map(p => p.text ?? "").join("");
      if (!chunk) continue;
      acc += chunk;
      onChunk?.(acc);
    }
  }
  return acc;
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
