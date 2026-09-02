/* AI provider catalogue.
   Update model IDs here; request/streaming logic lives in pure.js. */
(function (root, factory) {
  const catalog = factory();
  if (typeof module === "object" && module.exports) module.exports = catalog;
  else root.AI_MODEL_CATALOG = catalog;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const AI_MODEL_CATALOG = {
    // New visitors start on OpenAI GPT Luna (cheapest tier of the current GPT
    // family); a browser that already holds a legacy Gemini key stays on Gemini.
    defaultProvider: "openai",
    imageModels: ["gpt-image-2", "gpt-image-1.5", "gpt-image-1-mini"],
    providers: {
      gemini: {
        label: "Gemini",
        models: ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite-preview"],
        // Models that still honour generationConfig sampling. Gemini 3.6 onward
        // deprecates and ignores temperature/top_p/top_k, and Google documents
        // that later generations will reject them with a 400, so anything not
        // listed here (including custom model IDs) is sent without them.
        samplingSupported: ["gemini-3.5-flash", "gemini-3.1-flash-lite-preview"],
        keyPlaceholder: "AIza…",
        keyUrl: "https://aistudio.google.com/apikey",
        // Model discovery: GET {listUrl}?key=<apiKey> returns {models:[{name}]}.
        // Names arrive as "models/gemini-…"; listStrip removes the prefix.
        listUrl: "https://generativelanguage.googleapis.com/v1beta/models",
        listAuth: "query-key",
        listPath: "models",
        listStrip: /^models\//,
        // One page at a time; the walk follows nextPageToken until the
        // response stops offering one.
        listPaging: { size: "pageSize", cursor: "pageToken", token: "nextPageToken" },
        // Tier patterns for the "update list" button. The list endpoint
        // returns IDs and never a tier, so membership is decided here.
        // First match wins, so the narrower pattern leads: flash-lite has to
        // be claimed before the plain flash rule would swallow it.
        tiers: [
          { id: "cheap", test: /(^|-)flash-lite(-|$)/ },
          { id: "mid", test: /(^|-)flash(-|$)/ },
          { id: "best", test: /(^|-)pro(-|$)/ },
        ],
      },
      openai: {
        label: "OpenAI",
        // The GPT-5.6 frontier family, most capable first: Sol for complex work,
        // Terra for the intelligence/cost balance, Luna for high-volume runs.
        // The default is Luna via defaultModel, not by reordering this list.
        models: ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"],
        defaultModel: "gpt-5.6-luna",
        keyPlaceholder: "sk-…",
        keyUrl: "https://platform.openai.com/api-keys",
        // Model discovery: GET {listUrl} with a Bearer token returns {data:[{id}]}.
        listUrl: "https://api.openai.com/v1/models",
        listAuth: "bearer",
        listPath: "data",
        // /v1/models returns the whole catalogue in one response — no cursor.
        // The tier patterns double as the capability filter here, because the
        // rows carry no field saying what a model can do.
        tiers: [
          { id: "best", test: /(^|-)sol(-|$)/ },
          { id: "mid", test: /(^|-)terra(-|$)/ },
          { id: "cheap", test: /(^|-)luna(-|$)/ },
        ],
      },
      claude: {
        label: "Claude",
        models: ["claude-opus-4-8", "claude-sonnet-5", "claude-haiku-4-5"],
        // Models that accept thinking:{type:"disabled"}. Turning thinking off
        // keeps the whole max_tokens budget for slide markdown and avoids a
        // silent pause while the model thinks. Anything absent here (including
        // custom model IDs) is sent without a thinking field, because the
        // parameter shape differs on older models and would be rejected.
        thinkingOptional: ["claude-opus-4-8", "claude-sonnet-5"],
        keyPlaceholder: "sk-ant-…",
        keyUrl: "https://console.anthropic.com/settings/keys",
        // Model discovery: GET {listUrl} with x-api-key + version returns {data:[{id}]}.
        listUrl: "https://api.anthropic.com/v1/models",
        listAuth: "anthropic",
        listPath: "data",
        // Cursor paging: has_more gates the walk, last_id carries the cursor.
        listPaging: { size: "limit", cursor: "after_id", token: "last_id", more: "has_more" },
        tiers: [
          { id: "best", test: /(^|-)opus(-|$)/ },
          { id: "mid", test: /(^|-)sonnet(-|$)/ },
          { id: "cheap", test: /(^|-)haiku(-|$)/ },
        ],
      },
    },
  };

  return AI_MODEL_CATALOG;
});
