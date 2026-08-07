/* AI provider catalogue.
   Update model IDs here; request/streaming logic lives in shared.js. */
const AI_MODEL_CATALOG = {
  defaultProvider: "gemini",
  imageModels: ["gpt-image-2", "gpt-image-1.5", "gpt-image-1-mini"],
  providers: {
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
      // Models that accept thinking:{type:"disabled"}. Turning thinking off
      // keeps the whole max_tokens budget for slide markdown and avoids a
      // silent pause while the model thinks. Anything absent here (including
      // custom model IDs) is sent without a thinking field, because the
      // parameter shape differs on older models and would be rejected.
      thinkingOptional: ["claude-opus-4-8", "claude-sonnet-5"],
      keyPlaceholder: "sk-ant-…",
      keyUrl: "https://console.anthropic.com/settings/keys",
    },
  },
};
