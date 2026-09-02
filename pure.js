/* ============================================================
   pure.js — pure helpers and AI provider services shared by
   app.js / shared.js and unit-tested directly by pure.test.mjs.

   Load ai-models.js first, then pure.js before shared.js. In the
   browser every export is attached to window (classic-script
   contract, load order IS the module system); under Node the same
   object is module.exports, so tests import it like deck-model.js.
   ============================================================ */
(function (root, factory) {
  const catalog = (typeof module === "object" && module.exports)
    ? require("./ai-models.js")
    : root.AI_MODEL_CATALOG;
  const api = factory(root, catalog);
  if (typeof module === "object" && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function (root, AI_MODEL_CATALOG) {
  "use strict";
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

// Mark every line that sits inside a CLOSED ``` or ~~~ fence. An unterminated
// fence is deliberately not treated as one: otherwise a single stray opener
// hides every later separator and collapses the rest of the document into one
// slide.
function fencedLines(lines) {
  const fenced = new Array(lines.length).fill(false);
  let openIndex = -1;
  let openChar = "";
  lines.forEach((line, index) => {
    const match = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (!match) return;
    const char = match[1][0];
    if (openIndex === -1) {
      openIndex = index;
      openChar = char;
    } else if (char === openChar) {
      for (let i = openIndex; i <= index; i += 1) fenced[i] = true;
      openIndex = -1;
      openChar = "";
    }
  });
  return fenced;
}

// A --- directly under paragraph text can be a setext H2 underline rather than
// a slide break, and this app's own decks put --- straight after the intro
// line, so the previous line alone cannot decide it. Treat it as a heading
// underline only when what follows is not a new slide: every slide in this
// format opens with a # or ## heading, whereas a setext heading is followed by
// its own body text.
function isSetextUnderline(previousLine, followingLines) {
  const text = String(previousLine ?? "").trim();
  if (!text) return false;
  if (/^(#{1,6}\s|>|[-*+]\s|\d+[.)]\s|\||`{3,}|~{3,})/.test(text)) return false;
  const nextContent = (followingLines ?? []).find(line => line.trim());
  return !!nextContent && !/^#{1,6}\s/.test(nextContent.trim());
}

// Split markdown into slides on lines that are exactly --- (outside code fences).
function splitSlides(md) {
  const lines = String(md).split("\n");
  const fenced = fencedLines(lines);
  const segments = [];
  let buf = [];
  lines.forEach((line, index) => {
    const isSeparator = !fenced[index]
      && /^\s*---\s*$/.test(line)
      && !isSetextUnderline(lines[index - 1], lines.slice(index + 1));
    if (isSeparator) {
      segments.push(buf.join("\n"));
      buf = [];
    } else {
      buf.push(line);
    }
  });
  segments.push(buf.join("\n"));
  const slides = segments.map(s => s.trim()).filter(Boolean);
  return slides.length ? slides : [md];
}

// "pl" when Polish diacritics or common PL stopwords are present. The stopword
// check runs on a diacritic-stripped copy too, so Polish typed without its
// marks (ALL-CAPS, ASCII-normalised) is not misread as English.
function detectLang(text) {
  if (!text || !text.trim()) return "pl";
  const letters = (text.match(/\p{L}/gu) ?? []).length;
  const plChars = (text.match(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g) ?? []).length;
  if (letters && plChars / letters >= 0.005) return "pl";
  const flat = String(text).toLowerCase().replace(/[ąćęłńóśźż]/g, m => (
    { ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z" }[m]
  ));
  if (/\s(sie|jest|oraz|ktore|ktory|zeby|dla|albo|przez|mozna|rowniez|takze|wiec|juz|czy)\s/i.test(flat)) return "pl";
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


// Keep generated images attached to unchanged slide markdown when slides are
// inserted, removed, or reordered. Changed slides intentionally lose images
// that no longer describe their content.
function reconcileSlideImages(previousSegments, previousImages, nextSegments) {
  const imagesBySegment = new Map();
  (previousSegments ?? []).forEach((segment, index) => {
    const queue = imagesBySegment.get(segment) ?? [];
    queue.push(previousImages?.[index]);
    imagesBySegment.set(segment, queue);
  });
  return (nextSegments ?? []).map(segment => imagesBySegment.get(segment)?.shift());
}

// Markup for a slide with a generated illustration. The leading h1/h2 is the
// slide title and stays above the image grid at full width — only the body
// copy shares its row with the picture (mirrors the PPTX TITLE_IMAGE layout).
function illustratedSlideHtml(slideHtml, imageHtml) {
  const html = String(slideHtml ?? "");
  const heading = html.match(/^\s*<h([12])[^>]*>[\s\S]*?<\/h\1>/i)?.[0] ?? "";
  const body = html.slice(heading.length);
  return `${heading}<div class="slide-layout"><div class="slide-copy">${body}</div>${imageHtml}</div>`;
}

// Target pixel size for an uploaded slide image: shrink so the long edge is
// at most maxEdge (matching the generated-image size class), never upscale.
// null for degenerate input — caller skips the file.
function fitWithin(width, height, maxEdge) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) return null;
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

// Canvas re-encode settings for an uploaded image: PNG only when transparency
// would be lost, JPEG otherwise to keep photo uploads export-friendly.
function uploadEncoding(hasAlpha) {
  return hasAlpha
    ? { mime: "image/png", quality: undefined }
    : { mime: "image/jpeg", quality: 0.85 };
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
// Capability tiers, ordered the way the picker groups them. Every provider
// declares one pattern per tier so a freshly listed model can be sorted into
// "best / balanced / cost-effective" without a hand-edited release note.
const TIER_IDS = ["best", "mid", "cheap"];

function validateProviderTiers(id, tiers) {
  if (!Array.isArray(tiers) || tiers.length !== TIER_IDS.length) {
    throw new Error(`Invalid AI model catalogue: ${id}.tiers`);
  }
  const seen = new Set();
  for (const tier of tiers) {
    if (!tier || !TIER_IDS.includes(tier.id)) throw new Error(`Invalid AI model catalogue: ${id} tier id`);
    if (seen.has(tier.id)) throw new Error(`Invalid AI model catalogue: ${id} duplicate tier ${tier.id}`);
    seen.add(tier.id);
    // A /g pattern carries lastIndex between calls, so the same ID would
    // classify differently on a second pass. Reject it at load time.
    if (!(tier.test instanceof RegExp) || tier.test.global) {
      throw new Error(`Invalid AI model catalogue: ${id} tier ${tier.id} needs a non-global RegExp`);
    }
  }
  return Object.freeze(tiers.map(tier => Object.freeze({ id: tier.id, test: tier.test })));
}

function validateModelCatalog(catalog) {
  if (!catalog || typeof catalog !== "object" || !catalog.providers || typeof catalog.providers !== "object") {
    throw new Error("Invalid AI model catalogue: missing providers");
  }
  /** @type {Record<string, any>} */
  const providers = {};
  for (const id of SUPPORTED_PROVIDER_IDS) {
    const p = catalog.providers[id];
    if (!p || typeof p !== "object") throw new Error(`Invalid AI model catalogue: missing provider ${id}`);
    if (typeof p.label !== "string" || !p.label.trim()) throw new Error(`Invalid AI model catalogue: ${id}.label`);
    if (!Array.isArray(p.models) || !p.models.length) throw new Error(`Invalid AI model catalogue: ${id}.models`);
    const models = p.models.map(model => typeof model === "string" ? model.trim() : "");
    if (models.some(model => !model || /\s/.test(model))) throw new Error(`Invalid AI model catalogue: ${id} has an invalid model ID`);
    if (new Set(models).size !== models.length) throw new Error(`Invalid AI model catalogue: ${id} has duplicate model IDs`);
    if (p.defaultModel !== undefined && !models.includes(p.defaultModel)) {
      throw new Error(`Invalid AI model catalogue: ${id}.defaultModel is not in its models list`);
    }
    if (typeof p.keyPlaceholder !== "string") throw new Error(`Invalid AI model catalogue: ${id}.keyPlaceholder`);
    if (typeof p.keyUrl !== "string" || !p.keyUrl.startsWith("https://")) throw new Error(`Invalid AI model catalogue: ${id}.keyUrl`);
    providers[id] = Object.freeze({
      ...p,
      models: Object.freeze(models),
      tiers: validateProviderTiers(id, p.tiers),
    });
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
  // A browser that only holds a legacy single-provider Gemini key keeps Gemini;
  // everyone else without a stored provider gets the catalogue default.
  const hasLegacyKey = typeof legacy.key === "string" && legacy.key.trim();
  const provider = PROVIDER_INFO[s.provider] ? s.provider : (hasLegacyKey ? "gemini" : DEFAULT_PROVIDER);
  const keys = { gemini: "", openai: "", claude: "" };
  if (s.keys && typeof s.keys === "object") {
    for (const p of Object.keys(keys)) if (typeof s.keys[p] === "string") keys[p] = s.keys[p];
  }
  if (!keys.gemini && typeof legacy.key === "string") keys.gemini = legacy.key;
  let model = typeof s.model === "string" && s.model.trim() ? s.model.trim() : "";
  if (!model) {
    model = (provider === "gemini" && typeof legacy.model === "string" && legacy.model)
      ? legacy.model : defaultModelFor(provider);
  }
  // Illustrations always run through OpenAI, so the image model is a single
  // setting independent of the text provider. Custom IDs are preserved the
  // same way custom text models are.
  let imageModel = typeof s.imageModel === "string" && s.imageModel.trim() ? s.imageModel.trim() : "";
  if (!imageModel) imageModel = OPENAI_IMAGE_MODELS[0];
  return { provider, model, imageModel, keys, catalog: normalizeCatalogOverlay(s.catalog) };
}

// ─── Tier overlay (what the "update list" button writes) ─────
// The app is a static page with no build step, so an update cannot rewrite
// ai-models.js; it stores the three resolved IDs per provider alongside the
// rest of the settings instead. That makes the overlay untrusted input on the
// way back in, so it is validated exactly like the curated catalogue and
// anything malformed is dropped. ai-models.js stays the seed and the recovery
// path: clearing storage returns the app to a known-good list.
function normalizeCatalogOverlay(raw) {
  /** @type {Record<string, any>} */
  const out = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const providerId of SUPPORTED_PROVIDER_IDS) {
    const entry = raw[providerId];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    /** @type {Record<string, string>} */
    const tiers = {};
    for (const tier of TIER_IDS) {
      const id = entry.tiers?.[tier];
      if (typeof id !== "string") continue;
      const trimmed = id.trim();
      if (trimmed && !/\s/.test(trimmed)) tiers[tier] = trimmed;
    }
    if (!Object.keys(tiers).length) continue;
    const updatedAt = Number(entry.updatedAt);
    out[providerId] = { tiers, updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : 0 };
  }
  return out;
}

// The tier slots the picker should show, merged per tier: the stored overlay
// wins where an update filled a slot, and the curated list — classified on the
// fly — backs the rest. So the groups are populated on a first visit, and an
// update that could only resolve two tiers does not blank the third.
function tierPicks(providerId, settings) {
  const seeded = pickTierModels(providerId, PROVIDER_INFO[providerId]?.models ?? []);
  const stored = settings?.catalog?.[providerId]?.tiers ?? {};
  /** @type {Record<string, string|null>} */
  const picks = {};
  for (const tier of TIER_IDS) picks[tier] = stored[tier] ?? seeded[tier];
  return picks;
}

// Every model ID the picker treats as known. Curated order still leads, so a
// visitor who never presses update sees exactly what they see today.
function effectiveModels(providerId, settings) {
  const curated = PROVIDER_INFO[providerId]?.models ?? [];
  const stored = settings?.catalog?.[providerId]?.tiers ?? {};
  return [...new Set([...curated, ...TIER_IDS.map(tier => stored[tier]).filter(Boolean)])];
}

// The model a fresh visitor gets, and where switching providers lands. An
// explicit catalogue defaultModel wins (OpenAI: GPT Luna, the cheapest tier -
// picking "best" for someone would quietly raise their bill); otherwise the
// balanced tier from a discovery update, else the first curated model. An
// unknown provider id resolves to the catalogue default provider.
function defaultModelFor(providerId, settings) {
  const info = PROVIDER_INFO[providerId] ?? PROVIDER_INFO[DEFAULT_PROVIDER];
  return info.defaultModel
    ?? (PROVIDER_INFO[providerId] ? settings?.catalog?.[providerId]?.tiers?.mid : null)
    ?? info.models[0];
}

// ─── Model discovery ─────────────────────────────
// Each provider exposes a list endpoint (catalog listUrl/listAuth/listPath).
// discoverProviderModels fetches it with the saved key and merges the live IDs
// with the curated list, so a model the provider added after the last app
// update appears without waiting for ai-models.js to catch up. Discovery is
// best-effort: any failure (no key, offline, CORS, non-JSON) returns the
// curated list unchanged, and the curated order always leads so a new visitor
// still gets the intended default.

// One page per request. Providers page their model lists (Gemini and Anthropic
// both cut off well below the size of their catalogues), so a single response
// is a partial answer, not the answer; the walk follows the cursor. The page
// cap is the guard against a response that keeps handing back a cursor.
const MODEL_PAGE_SIZE = 50;
const MODEL_PAGE_LIMIT = 20;

// Recency the provider volunteers, in seconds: OpenAI sends `created` as an
// epoch, Anthropic sends `created_at` as ISO-8601, Gemini sends neither.
// 0 means "unknown", which sorts last among equal versions.
function modelTimestamp(row) {
  const created = row?.created;
  if (typeof created === "number" && Number.isFinite(created)) return created;
  if (typeof row?.created_at === "string") {
    const ms = Date.parse(row.created_at);
    if (Number.isFinite(ms)) return Math.floor(ms / 1000);
  }
  return 0;
}

// Normalized {id, created} rows from one list payload. Gemini publishes
// supportedGenerationMethods, so models that cannot stream slide text —
// embeddings, image, video, TTS — are dropped here instead of being left for
// the tier patterns to miss. Providers without that field fall through, and
// the tier patterns are the filter of last resort.
function providerModelRows(providerId, payload) {
  const info = PROVIDER_INFO[providerId];
  if (!info?.listPath) return [];
  const rows = payload?.[info.listPath];
  if (!Array.isArray(rows)) return [];
  const strip = info.listStrip instanceof RegExp ? info.listStrip : null;
  const out = [];
  for (const row of rows) {
    let id = String(row?.id ?? row?.name ?? "");
    if (strip) id = id.replace(strip, "");
    id = id.trim();
    if (!id || /\s/.test(id)) continue;
    const methods = row?.supportedGenerationMethods;
    if (Array.isArray(methods) && !methods.includes("streamGenerateContent")) continue;
    out.push({ id, created: modelTimestamp(row) });
  }
  return out;
}

function providerModelIds(providerId, payload) {
  return providerModelRows(providerId, payload).map(row => row.id);
}

// The next page's cursor, or "" when the walk is done. `more` (Anthropic's
// has_more) gates the token: the last page still echoes a last_id, and
// following it would fetch the same tail forever.
function nextPageCursor(info, payload) {
  const paging = info?.listPaging;
  if (!paging?.token) return "";
  if (paging.more && !payload?.[paging.more]) return "";
  const token = payload?.[paging.token];
  return typeof token === "string" && token ? token : "";
}

function modelListUrl(info, key, cursor) {
  const url = new URL(info.listUrl);
  if (info.listAuth === "query-key") url.searchParams.set("key", key);
  if (info.listPaging?.size) url.searchParams.set(info.listPaging.size, String(MODEL_PAGE_SIZE));
  if (cursor && info.listPaging?.cursor) url.searchParams.set(info.listPaging.cursor, cursor);
  return url.toString();
}

function modelListHeaders(info, key) {
  /** @type {Record<string, string>} */
  const headers = {};
  if (info.listAuth === "bearer") headers.Authorization = "Bearer " + key;
  else if (info.listAuth === "anthropic") {
    headers["x-api-key"] = key;
    headers["anthropic-version"] = "2023-06-01";
    headers["anthropic-dangerous-direct-browser-access"] = "true";
  }
  return headers;
}

// Walks every page of a provider's model list. Resolves to {rows, error}:
// rows are whatever arrived before the walk stopped, error is a short code
// when it stopped early (null on a clean walk). Partial rows are kept
// deliberately — a cursor that fails on page three still tells the caller
// more than an empty list does.
async function fetchProviderModelRows(providerId, key, options = {}) {
  const { signal, timeoutMs = 15000 } = /** @type {{ signal?: any, timeoutMs?: number }} */ (options);
  const info = PROVIDER_INFO[providerId];
  if (!info?.listUrl) return { rows: [], error: "unsupported" };
  if (!key) return { rows: [], error: "no-key" };
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new DOMException("Model list timed out", "TimeoutError")), timeoutMs);
  const forwardAbort = () => controller.abort(signal.reason);
  if (signal?.aborted) forwardAbort();
  else signal?.addEventListener("abort", forwardAbort, { once: true });
  /** @type {{id: string, created: number}[]} */
  const rows = [];
  const seen = new Set();
  let error = null;
  let cursor = "";
  try {
    for (let page = 0; page < MODEL_PAGE_LIMIT; page += 1) {
      const res = await fetch(modelListUrl(info, key, cursor), {
        headers: modelListHeaders(info, key),
        signal: controller.signal,
      });
      if (!res.ok) { error = "http-" + res.status; break; }
      const payload = await res.json().catch(() => null);
      if (!payload) { error = "parse"; break; }
      // A repeated ID across pages means the cursor is not advancing; keep
      // the first sighting and let the cursor check below end the walk.
      for (const row of providerModelRows(providerId, payload)) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        rows.push(row);
      }
      cursor = nextPageCursor(info, payload);
      if (!cursor) break;
      if (page === MODEL_PAGE_LIMIT - 1) error = "truncated";
    }
  } catch {
    error = "network";
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", forwardAbort);
  }
  return { rows, error };
}

async function discoverProviderModels(providerId, key, options = {}) {
  const curated = PROVIDER_INFO[providerId]?.models ?? [];
  const { rows } = await fetchProviderModelRows(providerId, key, options);
  if (!rows.length) return curated.slice();
  // Curated order leads; live IDs the catalog does not know yet follow,
  // deduplicated so a repeated entry in the list response appears once.
  const extra = [...new Set(rows.map(row => row.id).filter(id => !curated.includes(id)))];
  return [...curated, ...extra];
}

// ─── Tier classification ─────────────────────────
// The list endpoints return IDs, never a tier, so "which of these is the
// flagship" is decided by the per-provider patterns in ai-models.js plus the
// version ordering below. Everything here is pure and offline; the network
// half is fetchProviderModelRows above.

// IDs that name a moving target or a dated snapshot rather than a stable
// release. Preferred against, never banned: a tier whose only candidate is a
// preview still beats an empty tier.
const UNSTABLE_MODEL_ID = /(^|-)(preview|exp|experimental|nightly|alpha|beta|rc\d*|latest)(-|$)/;
const SNAPSHOT_MODEL_ID = /-(\d{8}|\d{4}(-\d{2}){1,2}|\d{2}-\d{4})$/;

// Every digit run in an ID, in order: "gemini-3.7-flash" and
// "claude-opus-4-8" both reduce to [4-ish, minor]. Dots and hyphens are read
// the same way because providers use them interchangeably as version
// separators. Comparing the segments numerically is the point — as strings,
// "3.9" sorts above "3.10".
function modelVersionKey(id) {
  return (String(id ?? "").match(/\d+/g) ?? []).map(Number);
}

// -1 stands in for a missing segment, so [3] ranks below [3, 1].
function compareVersionKeys(a, b) {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const av = a[i] ?? -1;
    const bv = b[i] ?? -1;
    if (av !== bv) return av - bv;
  }
  return 0;
}

function classifyModel(providerId, id) {
  if (typeof id !== "string" || !id) return null;
  for (const tier of PROVIDER_INFO[providerId]?.tiers ?? []) {
    if (tier.test.test(id)) return tier.id;
  }
  return null;
}

// Newest first: version, then whatever recency the provider volunteered,
// then the shorter ID — an alias is always shorter than its dated snapshot,
// so "claude-sonnet-5" wins over "claude-sonnet-5-20260115" on a tie.
function compareTierCandidates(a, b) {
  const byVersion = compareVersionKeys(modelVersionKey(b.id), modelVersionKey(a.id));
  if (byVersion) return byVersion;
  if (a.created !== b.created) return b.created - a.created;
  return a.id.length - b.id.length;
}

// Resolves {best, mid, cheap} from a list of rows (or bare ID strings).
// A tier with no candidate stays null so the caller can keep the curated
// value and say which slots it could not fill.
function pickTierModels(providerId, rows) {
  /** @type {Record<string, {id: string, created: number}[]>} */
  const buckets = { best: [], mid: [], cheap: [] };
  for (const row of Array.isArray(rows) ? rows : []) {
    const id = typeof row === "string" ? row : row?.id;
    if (typeof id !== "string" || !id || /\s/.test(id)) continue;
    const tier = classifyModel(providerId, id);
    if (!tier) continue;
    const created = typeof row === "string" ? 0 : Number(row?.created) || 0;
    buckets[tier].push({ id, created });
  }
  /** @type {Record<string, string|null>} */
  const picks = {};
  for (const tier of TIER_IDS) {
    const all = buckets[tier];
    const stable = all.filter(row => !UNSTABLE_MODEL_ID.test(row.id) && !SNAPSHOT_MODEL_ID.test(row.id));
    const pool = stable.length ? stable : all;
    picks[tier] = pool.sort(compareTierCandidates)[0]?.id ?? null;
  }
  return picks;
}

// What the "update list" button runs. Returns the resolved tiers, the full
// live ID list for the picker's "all models" group, and a reason code when
// something went wrong — unlike ambient discovery, an explicit click has to
// be able to say why nothing happened.
async function updateProviderModels(providerId, key, options = {}) {
  const { rows, error } = await fetchProviderModelRows(providerId, key, options);
  const tiers = pickTierModels(providerId, rows);
  const matched = TIER_IDS.filter(tier => tiers[tier]);
  return {
    tiers,
    ids: rows.map(row => row.id),
    total: rows.length,
    matched,
    // A clean walk that matched nothing is its own failure: the endpoint
    // answered, so the tier patterns are what went stale.
    error: error ?? (rows.length ? (matched.length ? null : "no-match") : "empty"),
  };
}

// ─── Per-provider request builders (pure) ────────
// Each returns {url, headers, body} for the provider's streaming endpoint.
// Gemini 3.6 onward ignores temperature/top_p/top_k and later generations are
// documented to reject them outright, so the parameter is sent only to the
// models that still honour it. Unlisted and custom IDs get nothing, which is
// the safe direction: a missing sampling hint costs a little consistency, a
// rejected one costs the whole request.
function geminiGenerationConfig(model) {
  const supported = PROVIDER_INFO.gemini?.samplingSupported ?? [];
  return supported.includes(model) ? { temperature: 0.4 } : null;
}

function buildGeminiRequest({ key, model, source, prompt }) {
  /** @type {any[]} */
  const parts = [{ text: prompt }];
  if (source.kind === "pdf") {
    parts.push({ inline_data: { mime_type: "application/pdf", data: source.base64 } });
  } else {
    parts.push({ text: "\n\n--- DOCUMENT ---\n\n" + source.text });
  }
  const generationConfig = geminiGenerationConfig(model);
  return {
    url: `${GEMINI_BASE}/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: { contents: [{ parts }], ...(generationConfig ? { generationConfig } : {}) },
  };
}

function buildOpenAIRequest({ key, model, source, prompt }) {
  /** @type {any[]} */
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

// Sonnet 5 and Opus 4.8 run adaptive thinking unless told otherwise, and
// thinking shares the max_tokens budget. Turning it off for slide generation
// (a formatting task, not a reasoning one) keeps the budget for markdown and
// removes the long silent gap before the first visible chunk.
function claudeThinking(model) {
  const optional = PROVIDER_INFO.claude?.thinkingOptional ?? [];
  return optional.includes(model) ? { type: "disabled" } : null;
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
    // 64000 is the output ceiling of the smallest model offered (Haiku 4.5);
    // Sonnet 5 and Opus 4.8 allow 128000. The request streams, so the large
    // budget costs nothing until it is used. Sonnet 5 thinks by default and
    // thinking shares this budget, which the previous 16000 truncated.
    body: {
      model,
      max_tokens: 64000,
      stream: true,
      ...(claudeThinking(model) ? { thinking: claudeThinking(model) } : {}),
      messages: [{ role: "user", content }],
    },
  };
}

// Build the OpenAI image prompt for ONE slide. The full deck is passed as
// read-only context so the illustration fits the presentation; only the
// target slide is illustrated.
function buildSlideImagePrompt({ slideMd, direction, deckSegments }) {
  const deck = (deckSegments ?? []).map(s => s.trim()).filter(Boolean).join("\n\n---\n\n");
  let prompt =
    "Create one landscape editorial illustration for a presentation slide. " +
    "Create a black and white contour image in the style of Notion, " +
    "with simple composition and generous negative space. " +
    "Do not include text, letters, numbers, logos, watermarks, UI, frames, or slide layouts.\n\n" +
    "Here is the full presentation for context only — do NOT illustrate these slides, " +
    "they are provided so the illustration fits the deck:\n\n" +
    deck +
    "\n\nNow illustrate the central idea of THIS slide only:\n\n" +
    (slideMd ?? "").trim();
  if (direction?.trim()) {
    prompt += "\n\nAdditional direction from the user:\n" + direction.trim();
  }
  return prompt;
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

// Why the model stopped, normalised across providers: "" (still fine),
// "truncated" (hit the output cap — the deck is real but cut short) or
// "blocked" (safety/refusal — no usable content). Without this a truncated
// deck reports success and a refusal reports "empty response".
function providerStopReason(data) {
  const raw = data?.type === "message_delta" ? data.delta?.stop_reason           // Claude
    : data?.type === "response.incomplete" ? data.response?.incomplete_details?.reason // OpenAI
      : data?.candidates?.[0]?.finishReason;                                     // Gemini
  switch (String(raw ?? "").toLowerCase()) {
    case "max_tokens":
    case "max_output_tokens":
      return "truncated";
    case "refusal":
    case "safety":
    case "recitation":
    case "blocklist":
    case "prohibited_content":
    case "content_filter":
      return "blocked";
    default:
      return "";
  }
}

// Parse complete Server-Sent Events from a buffer. The caller retains the
// remainder and passes it back with the next decoded network chunk. SSE allows
// an event payload to span several `data:` lines; those lines are joined with
// newlines as required by the format.
function parseSseFrames(input, { final = false } = {}) {
  const events = [];
  const buffer = String(input ?? "");
  const separator = /\r?\n\r?\n/g;
  let end = 0;
  let match;

  const addFrame = frame => {
    const dataLines = [];
    let event = "message";
    for (const line of frame.split(/\r?\n/)) {
      if (!line || line.startsWith(":")) continue;
      const colon = line.indexOf(":");
      const field = colon < 0 ? line : line.slice(0, colon);
      let value = colon < 0 ? "" : line.slice(colon + 1);
      if (value.startsWith(" ")) value = value.slice(1);
      if (field === "event") event = value || "message";
      if (field === "data") dataLines.push(value);
    }
    if (dataLines.length) events.push({ event, data: dataLines.join("\n") });
  };

  while ((match = separator.exec(buffer))) {
    addFrame(buffer.slice(end, match.index));
    end = match.index + match[0].length;
  }
  const remainder = buffer.slice(end);
  if (final && remainder) {
    addFrame(remainder);
    return { events, remainder: "" };
  }
  return { events, remainder };
}

  return {
    stripOuterFence, fencedLines, isSetextUnderline, splitSlides, detectLang,
    buildPrompt, deckTitle, reconcileSlideImages, illustratedSlideHtml,
    firstFont, clampPanelWidth, fitWithin, uploadEncoding,
    GEMINI_BASE, SUPPORTED_PROVIDER_IDS,
    validateModelCatalog, MODEL_CATALOG, DEFAULT_PROVIDER, PROVIDER_INFO,
    OPENAI_IMAGE_MODELS, normalizeAiSettings,
    TIER_IDS, normalizeCatalogOverlay, tierPicks, effectiveModels, defaultModelFor,
    providerModelIds, providerModelRows, discoverProviderModels,
    fetchProviderModelRows, updateProviderModels,
    modelVersionKey, compareVersionKeys, classifyModel, pickTierModels,
    geminiGenerationConfig, buildGeminiRequest, buildOpenAIRequest,
    claudeThinking, buildClaudeRequest, buildSlideImagePrompt,
    buildOpenAIImageRequest, geminiChunk, openaiChunk, claudeChunk,
    providerStopReason, parseSseFrames,
  };
});
