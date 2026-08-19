/* AI provider catalogue.
   Update model IDs here; request/streaming logic lives in pure.js. */
(function (root, factory) {
  const catalog = factory();
  if (typeof module === "object" && module.exports) module.exports = catalog;
  else root.AI_MODEL_CATALOG = catalog;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const AI_MODEL_CATALOG = {
    defaultProvider: "gemini",
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
      },
      openai: {
        label: "OpenAI",
        // The GPT-5.6 frontier family, most capable first: Sol for complex work,
        // Terra for the intelligence/cost balance, Luna for high-volume runs.
        models: ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"],
        keyPlaceholder: "sk-…",
        keyUrl: "https://platform.openai.com/api-keys",
        // Model discovery: GET {listUrl} with a Bearer token returns {data:[{id}]}.
        listUrl: "https://api.openai.com/v1/models",
        listAuth: "bearer",
        listPath: "data",
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
      },
    },
  };

  return AI_MODEL_CATALOG;
});
