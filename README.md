# slidegen — Studio stylów prezentacji

Slide generator from txt, markdown or pdf — a zero-build presentation style
studio in the **edulab** look. Design how a slide deck looks in real time:
4 preset templates, any Google Font (with live previews), accent/text/background
color pickers, and logo upload — then load your own document and let Gemini
turn it into slides.

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
- **Document → slides via Gemini** — drop a `.txt`, `.md`, or `.pdf`, paste
  your own [AI Studio key](https://aistudio.google.com/apikey) (stored only in
  your browser, sent only to Google), and slides stream in live
- **Markdown editor drawer** — tweak the deck with a live re-render
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
