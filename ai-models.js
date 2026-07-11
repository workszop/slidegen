/* AI provider catalogue.
   Update model IDs here; request/streaming logic lives in shared.js. */
const AI_MODEL_CATALOG = {
  defaultProvider: "gemini",
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
      keyPlaceholder: "sk-ant-…",
      keyUrl: "https://console.anthropic.com/settings/keys",
    },
  },
};
