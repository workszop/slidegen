# Quantica app in edulab chrome, quantica slides

**Date:** 2026-07-11
**Scope:** `quantica.html` only (style layer + fonts link; markup and `APP_BRAND` unchanged)

## Goal

The quantica app's interface adopts the edulab style — as implemented by the
in-repo reference `edu.html` (warm paper, marigold primary, teal tag chip,
Raleway UI + DM Mono labels) — while two quantica islands remain:

1. **Generated slides keep the quantica look**: Poppins headings, Geist Mono
   code, pink accents, magenta blockquotes, the four pink presets, and the
   PPTX export theme (which reads the rendered slide, so it follows).
2. **The quantica hexagon logo stays** in the chrome bar and on slide corners
   (`APP_BRAND.logo`, untouched).

This supersedes the earlier rose-tinted chrome restyle; interface pink is
gone — pink lives only in the slides.

## Non-goals

- No change to `APP_BRAND` (logo, presets, example decks, storage keys).
- No change to edu.html, styler, app.js, or shared.js.
- No change to slide geometry, present mode behavior, editing 16:9 frame,
  or the resizer.

## Design

Replace `quantica.html`'s `<style>` block with `edu.html`'s style layer
(tokens, base, chrome, buttons, inputs, workspace, present shell, full-bleed
workbench, media queries, editing 16:9 rules, `.editor-close`), verbatim,
with these deviations:

- **Header comment** names the file's role: edulab chrome, quantica slides.
- **`:root` additions** after the edulab tokens — the quantica slide
  identity, used only by `.slide` rules:
  `--quantica-pink: #C41E54`, `--deep-berry: #8A004C`,
  `--magenta-tint: #FFE6F1`, `--violet-primary: #7030A0`,
  `--font-slide: "Poppins", …`, `--font-slide-mono: "Geist Mono", …`.
- **Slide rules stay quantica's** (both present `.slide` and `.deck .slide`
  inherit): headings on `var(--font-slide)`, code/pre on
  `var(--font-slide-mono)`, eyebrow/link/title-h1 pink, blockquote magenta
  tint + deep berry, title eyebrow violet. Old quantica token references
  remap to edulab equivalents: `--fg-1→--ink`, `--bg-1→--paper`,
  `--fg-3→--ink-3`, `--border-1→--line`, `--border-2→--line-2`,
  `--fg-brand/--border-brand→--quantica-pink`, tracking/radius/spacing
  literals or edulab tokens.
- **Deck/present accents**: `--slide-accent` fallbacks stay
  `var(--quantica-pink)` (slide-adjacent, preset-driven anyway).
- **Fonts link** loads all four families: Raleway, DM Mono, Poppins,
  Geist Mono.
- Shared-component aliases (`--accent`/`--border`/`--bg`) come with the
  edulab tokens → AI dialog and resize handle render edulab.

## Error handling

None — presentation only.

## Testing

- `node --test tests/pure.test.mjs` still passes (no JS change).
- Browser: quantica chrome visually matches edu.html (paper, marigold
  buttons, teal chips); quantica logo in chrome; slides identical to before
  (Poppins, pink presets) in preview and present; editing 16:9 + resizer +
  ✕ still work; PPTX theme probe returns Poppins/Geist Mono and preset
  colors.
