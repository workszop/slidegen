# slidegen — Studio stylów prezentacji

Slide generator from txt, markdown or pdf — a zero-build presentation style
studio in the **edulab** look, plus two deck-first workspaces (edulab and
Quantica Lab) that turn any document into a branded slide deck with your
choice of AI provider.

**Live apps:**

- Style studio: https://workszop.github.io/slidegen/
- Document → slides (edulab): https://workszop.github.io/slidegen/edu.html
- Document → slides (Quantica Lab): https://workszop.github.io/slidegen/quantica.html

## Features

- **4 templates** — Papier, Atrament, Żurnal, Pastel; every derived tone
  (quotes, hairlines, code blocks) recalculates automatically from your colors
- **Any Google Font** — separate heading/body choosers previewing each font in
  its own typeface; type any name from fonts.google.com
- **Logo upload** — appears top-right on every slide (default: the edulab
  rocking horse, auto-inverting on dark backgrounds)
- **Deck-first workspace (edu.html / quantica.html)** — each app opens
  straight into an example deck about itself, no upload required first. A
  sidebar holds everything: **Document** (drop/paste a `.txt`, `.md`, or
  `.pdf`), **Generate** (AI model chip + slide count/language), **Style**
  (four brand-locked presets), and **Actions** (edit, present, download). The
  stage in the middle shows the live deck with prev/next navigation and a
  slide counter; an editor panel opens to the right of the slide — toggle it
  manually or let it auto-open as slides stream in during generation.
- **Document → slides via your choice of AI** — pick the provider and model
  (Gemini, OpenAI, or Claude) from the model chip in the **Generate** section;
  your API key is stored only in your browser and sent only to the selected
  provider; slides stream in live, replacing the example deck.
- **4 brand style presets per app** — one click restyles the whole deck
  (stage, present mode, and `.pptx` export); the choice persists per app and
  survives reload.
- **Export** — download the deck as an editable `.pptx` in the current look
- Bilingual UI (PL default / EN), keyboard navigation, fullscreen presenting,
  settings persisted in localStorage

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
