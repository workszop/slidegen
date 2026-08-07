# doc2slide

A zero-build browser app that turns Markdown, text, or PDF documents into
editable slide decks. It includes a style studio and three deck-first
workspaces for edulab, Quantica Lab, and experimental AI illustrations.

## Live apps

- Style studio: https://workszop.github.io/slidegen/
- edulab: https://workszop.github.io/slidegen/edu.html
- Quantica Lab: https://workszop.github.io/slidegen/quantica.html
- Experimental edulab: https://workszop.github.io/slidegen/experimental.html

## Features

- Four editable style presets in each app.
- Google Fonts and optional logo upload.
- Responsive, full-viewport workbench and presentation mode.
- Gemini, OpenAI, and Claude slide generation with streamed preview.
- PL, EN, and automatic source-language output.
- Standalone HTML and editable PowerPoint export.
- Optional OpenAI illustrations in the experimental workspace.
- Keyboard navigation, progress indicators, and bilingual UI.

API keys keep the existing browser-local storage behavior. They are sent only
to the selected provider.

## Slide Markdown

Slides are separated by a line containing only `---`. Separators inside fenced
code blocks are ignored.

```markdown
# Deck title
A short introduction.

---

## Slide heading

- A bullet with **bold** and `code`
- A [link](https://example.com)

<!-- notes:
Explain the source and the main conclusion.
-->
```

Supported semantic content includes headings, paragraphs, inline formatting,
ordered and nested lists, blockquotes, code blocks, tables, links, images, and
speaker notes. A Markdown file already using this format can be presented
without an API key.

## PowerPoint export

The exporter maps Markdown to editable, native PowerPoint content:

- title, title-and-body, two-column, title-and-table, title-and-image, and
  section layouts;
- real PowerPoint title, body, table, and image placeholders;
- native numbered and bulleted lists;
- editable tables, quote callouts, and code text boxes;
- speaker notes, object names, alt text, and presentation metadata.

Colors use PowerPoint scheme roles such as Text, Background, and Accent rather
than fixed per-object colors. Heading and body typography inherit from the
PowerPoint theme. This keeps the initial web preset while allowing a custom
PowerPoint theme to restyle the deck later through Slide Master or Design
Themes. The explicit monospaced code font and raster assets are intentional
exceptions.

Long content is retained. The exporter uses continuation slides and content
preflight instead of silently dropping blocks; unusually dense blocks may
still be reduced to fit.

## Architecture

- `index.html` is the style studio.
- `edu.html`, `quantica.html`, and `experimental.html` are thin brand shells.
- `app.js` contains the shared deck-first controller.
- `shared.js` contains provider, streaming, file, and shared UI helpers.
- `deck-model.js` is the semantic Markdown model used by HTML and PowerPoint.
- `deck-base.css` contains the shared deck layout.
- `theme-*.css` contains brand and experimental visual tokens.
- `pptx-export.js` contains the PowerPoint renderer and theme post-processing.

There is no production build step. Local CSS is inlined when downloading a
standalone HTML deck.

## Development

Requirements: a current Node.js release for checks and a browser for the app.

```bash
npm install
npm run check
npm test
python3 -m http.server 8000
```

Then open `http://localhost:8000/`. The apps also work from `file://`, except
for browser capabilities that require an HTTP origin.

Text uploads are limited to 2 MB and PDF uploads to 19 MB. AI POST requests are
not retried automatically because the provider may already have accepted and
billed the original request.

## Updating AI models

The provider and model catalogue lives in `ai-models.js`. Update model IDs
there. On startup, `shared.js` validates required providers, unique model IDs,
and HTTPS key URLs. Custom model IDs remain supported.
