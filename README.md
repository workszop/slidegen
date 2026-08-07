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
- Standalone HTML and editable PowerPoint export, both carrying the selected
  style preset.
- Optional OpenAI illustrations in the experimental workspace.
- Keyboard navigation, progress indicators, and bilingual UI.

API keys keep the existing browser-local storage behavior. They are sent only
to the selected provider.

## Slide Markdown

Slides are separated by a line containing only `---`. A separator inside a
closed code fence is ignored, in both backtick and tilde form, so a deck can
teach fenced syntax without splitting itself. An unterminated fence is treated
as ordinary text rather than as an opener, so one stray fence cannot swallow
the rest of the document into a single slide.

A `---` directly under a line of prose is read as a slide separator when the
next content is a Markdown heading, and as a setext heading underline
otherwise. That keeps decks written in this format working while leaving
ordinary Markdown, where `---` underlines the paragraph above it, intact.

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
- real PowerPoint title and picture placeholders;
- native numbered and bulleted lists;
- editable tables, quote callouts, and code text boxes;
- speaker notes, object names, alt text, and presentation metadata.

Colors use PowerPoint scheme roles such as Text, Background, and Accent rather
than fixed per-object colors, and heading and body font families inherit from
the PowerPoint theme. This keeps the initial web preset while allowing a custom
PowerPoint theme to recolor and re-font the deck later through Slide Master or
Design Themes. The explicit monospaced code font and raster assets are
intentional exceptions.

Two limits are worth knowing before you rely on a theme swap. Slide titles bind
to the layout's title placeholder, but body copy, lists, quotes, and tables are
laid out as positioned shapes rather than filling the body placeholder, so
Outline view shows only titles and Reset Layout does not move that content.
Font sizes are also written onto each run, so a different theme changes colors
and typefaces but leaves the type scale as exported.

Every text run is sanitized of XML-illegal control characters, and shape IDs
are made unique per slide, so text pasted from a PDF or a spreadsheet and decks
that mix a table with other content both produce a package that PowerPoint and
Google Slides open without a repair prompt.

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

There is no production build step. A standalone HTML download inlines the deck
stylesheets and the active style preset; workbench-only rules such as the
sidebar, editor panel, and model dialog are filtered out so an exported deck
carries only what it renders.

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

Generation reports how the model stopped instead of failing silently. A deck
cut short by the output limit is kept and flagged as possibly incomplete, and a
provider that declines the document is reported as a refusal rather than as an
empty response.

## Updating AI models

The provider and model catalogue lives in `ai-models.js`. Update model IDs
there. On startup, `shared.js` validates required providers, unique model IDs,
and HTTPS key URLs. Custom model IDs remain supported.

The first model listed for a provider is the one a new visitor gets; the
current default is `gemini-3.6-flash`. A model already saved in the browser
keeps working and is not migrated, so changing the order here only affects
people who have not picked a model themselves.

Two entries mark per-model API differences, and in both the rule is that a
model left out of the list is sent nothing. That way an unfamiliar or custom ID
can never receive a parameter its endpoint rejects:

- `samplingSupported` (Gemini) lists the models that still honour
  `generationConfig` sampling. Gemini 3.6 deprecates and ignores
  `temperature`, `top_p`, and `top_k`, and Google documents that later
  generations will return a 400 for them.
- `thinkingOptional` (Claude) lists the models whose API accepts
  `thinking: {type: "disabled"}`. Slide generation is a formatting task, so
  those models are asked not to think, which keeps the whole output budget for
  slide Markdown and avoids a silent pause before the first streamed text. The
  parameter has a different shape on older models.
