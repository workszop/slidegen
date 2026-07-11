# Multi-provider model selector — design

Date: 2026-07-11
Status: approved (user, 2026-07-11)

## Goal

Let the user pick the AI provider (Gemini, OpenAI, Claude) and model used for
document→slides generation, via a popup that keeps the workspace uncluttered,
with a compact always-visible indicator of the active model. Applies to all
three apps: `index.html` (styler), `edu.html`, `quantica.html`.

## Provider layer (`shared.js`)

Data-driven registry replaces the Gemini-only pipeline:

```js
const PROVIDERS = {
  gemini: { label: "Gemini", models: ["gemini-3.5-flash", "gemini-3.1-flash-lite-preview"],
            keyPlaceholder: "AIza…", keyUrl: "https://aistudio.google.com/apikey",
            stream: streamGeminiSlides },
  openai: { label: "OpenAI", models: [/* verify current IDs against docs at implementation time */],
            keyPlaceholder: "sk-…", keyUrl: "https://platform.openai.com/api-keys",
            stream: streamOpenAISlides },
  claude: { label: "Claude", models: ["claude-opus-4-8", "claude-sonnet-5", "claude-haiku-4-5"],
            keyPlaceholder: "sk-ant-…", keyUrl: "https://console.anthropic.com/settings/keys",
            stream: streamClaudeSlides },
};
```

- All `stream*Slides` functions share the signature
  `{key, model, source, prompt, onChunk}` → full markdown text; throw
  `Error("status: message")` on HTTP errors. Each does its own fetch + SSE parse.
- One dispatcher `streamSlides(aiSettings, {source, prompt, onChunk})` replaces
  direct `streamGeminiSlides` calls in `app.js` and `index.html`.
- PDF payloads per provider:
  - Gemini: `inline_data {mime_type, data}` (existing).
  - Claude: `{type:"document", source:{type:"base64", media_type:"application/pdf", data}}`
    content block before the text block; headers `x-api-key`,
    `anthropic-version: 2023-06-01`, `anthropic-dangerous-direct-browser-access: true`;
    endpoint `POST https://api.anthropic.com/v1/messages` with `stream: true`;
    SSE `content_block_delta` / `text_delta` events. `max_tokens` 16000.
  - OpenAI: chat completions with `{type:"file", file:{filename, file_data:"data:application/pdf;base64,…"}}`
    content part (verify exact current shape against docs at implementation time);
    `stream: true`, SSE `choices[0].delta.content`.
- Rejected alternative: routing all providers through OpenAI-compatible
  endpoints — PDF payload shapes differ per provider anyway, saves little,
  obscures errors.

## Storage

Single localStorage key `eduapp_ai`:

```json
{ "provider": "gemini", "model": "gemini-3.5-flash",
  "keys": { "gemini": "", "openai": "", "claude": "" } }
```

- Keys for all providers persist so switching is instant.
- Custom model: `model` may be any string; if it's not in the provider's
  curated list the dropdown shows "custom…" with the text input filled.
- Migration on first load: fold legacy `eduapp_gemini_key` / `eduapp_model`
  into `eduapp_ai` (keep legacy keys in place; they're harmless).
- Pure helpers (`parseAiSettings`, `migrateAiSettings`, request-body builders)
  live between the `pure-helpers` markers for `node --test`.

## Popup (shared markup + logic, styled per app)

Native `<dialog>` element, injected/authored once per app, containing:

1. **Provider** — segmented control: Gemini | OpenAI | Claude.
2. **Model** — dropdown listing the provider's curated models + "custom…"
   option that reveals a free-text input for any model ID.
3. **API key** — password input for the *selected* provider, with per-provider
   placeholder and help link ("key stays in your browser…" copy, PL/EN).
4. Close/save — persists to `eduapp_ai` on change and on close.

Popup logic lives in `shared.js` (DOM builder + wiring); each app opens it from
its indicator chip. Styling uses each app's existing CSS variables.

## Workspace indicator

- The settings card in edu/quantica drops the API-key field and model select.
  In their place: one compact chip `⚙ Gemini · gemini-3.5-flash` that opens
  the popup. Same chip in the styler (replacing its key field).
- Slide language and slide-count controls stay inline (content settings).
- Chip text updates live when the popup changes settings.

## Errors

- Reuse the existing error panel. "No key" error names the active provider and
  links its key URL. HTTP errors keep the `status: message` format.

## Testing

- `node --test` over the new pure helpers (settings parse/migrate/resolve,
  per-provider request-body builders).
- Live: open each app, verify chip + popup render and persist; generate a deck
  per provider where a key is available; with a dummy key verify the request
  fires to the right endpoint and the error path renders provider-specific
  guidance.
