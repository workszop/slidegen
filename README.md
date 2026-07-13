# doc2slide

Slide generator from txt, markdown or pdf — a zero-build presentation style
studio in the **edulab** look, plus two deck-first workspaces (edulab and
Quantica Lab) that turn any document into a branded slide deck with your
choice of AI provider.

**Live apps:**

- doc2slide — studio stylów: https://workszop.github.io/slidegen/
- doc2slide — edulab: https://workszop.github.io/slidegen/edu.html
- doc2slide — Quantica Lab: https://workszop.github.io/slidegen/quantica.html
- doc2slide · lab — edulab with experimental OpenAI illustrations:
  https://workszop.github.io/slidegen/experimental.html

## Features

- **4 templates** — Papier, Atrament, Żurnal, Pastel; every derived tone
  (quotes, hairlines, code blocks) recalculates automatically from your colors
- **Any Google Font** — separate heading/body choosers previewing each font in
  its own typeface; type any name from fonts.google.com
- **Logo upload** — appears top-right on every slide (default: the edulab
  rocking horse, auto-inverting on dark backgrounds)
- **Full-bleed workbench layout, shared by all three apps** — the style
  studio (`index.html`) and both deck-first workspaces (`edu.html` /
  `quantica.html`) fill the viewport edge-to-edge with the same recipe: a
  panel on the left, the live deck filling the stage, and an editor panel
  that opens to the right of the deck. No bordered card, no page margins —
  the deck itself is the page. Below 768px the layout stacks (panel on top,
  deck below with a tall minimum height) and the editor opens as an overlay
  instead of a side panel.
- **Deck-first workspace (edu.html / quantica.html)** — each app opens
  straight into an example deck about itself, no upload required first. The
  panel holds everything: **Document** (drop/paste a `.txt`, `.md`, or
  `.pdf`), **Generate** (AI model chip + slide count/language), **Style**
  (four brand-locked presets), and **Actions** (edit, present, download). The
  deck shows prev/next navigation, a slide counter, and a progress bar that
  tracks the current slide; the editor panel opens to the right of the deck —
  toggle it manually or let it auto-open as slides stream in during
  generation.
- **Document → slides via your choice of AI** — pick the provider and model
  (Gemini, OpenAI, or Claude) from the model chip in the **Generate** section;
  your API key is stored only in your browser and sent only to the selected
  provider; slides stream in live, replacing the example deck. Slide language
  is PL / EN / Auto (default) — Auto asks the model to match the language of
  the source document, so an English source produces an English deck and a
  Polish source produces a Polish deck.
- **4 brand style presets per app** — one click restyles the whole deck
  (stage, present mode, and `.pptx` export); the choice persists per app and
  survives reload.
- **Export** — download the deck as a standalone `.html` presentation or an
  editable `.pptx` in the current look
- Bilingual UI (PL default / EN), keyboard navigation, fullscreen presenting,
  settings persisted in localStorage
- **Experimental illustrated deck** (`experimental.html`) — keeps the edulab
  look, accepts additional user instructions on top of the built-in slide
  prompt, and can generate one landscape illustration per content slide with
  an OpenAI GPT Image model. Generated images appear in the live deck,
  presentation mode, and `.pptx` export.

## Updating AI models

The provider and model catalogue lives in `ai-models.js`. Update model IDs
there; the selector in all three apps uses the same list. On startup,
`shared.js` validates required providers, non-empty unique model IDs, and
HTTPS key URLs. Custom model IDs entered by users remain supported.

## Slide markdown format

```markdown
# Deck title
One intro line.
---
## Slide heading
- bullets, **bold**, `code`, tables, > quotes
```

Slides are separated by a line containing only `---` (ignored inside code
fences). A `.md` file in this format presents directly — no API key needed.

## Development

No build step — `index.html` + `pptx-export.js` are the whole app. Open the
file locally or serve statically. `?preset=1..4` preselects a template,
`?lang=en` forces the UI language.
