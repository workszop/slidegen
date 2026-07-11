# Deck-first rework of edu & quantica — design

Date: 2026-07-11
Status: approved direction (user picked recommendations); spec pending user review

## Goal

Make `edu.html` and `quantica.html` work like the styler (`index.html`): the app
opens straight into a live example deck about the app itself, a left sidebar
holds all controls (document loading, generation, style presets, export), and
editing happens in a panel to the right of the rendered slide. Each app gets
4 brand-locked style presets. The styler itself is unchanged.

## Decisions (user-approved)

1. Deck-first home screen — the separate input view disappears; its controls
   move into a sidebar.
2. 4 brand-locked presets per app — one-click curated palette/font combos
   within each brand; no free color/font pickers.
3. Edit layout — three zones: sidebar | rendered slide | markdown editor
   (editor toggleable).
4. Built on merged main (model selector included).

## Layout

```
┌──────────┐┌──────────────────┐┌────────────┐
│ sidebar  ││                  ││ markdown   │
│ • deck   ││   SLIDE          ││ editor     │
│ • style  ││   (rendered)     ││ (toggled   │
│ • AI     ││                  ││  by Edit)  │
│ • export ││  ‹ 3 / 12 ›      ││            │
└──────────┘└──────────────────┘└────────────┘
```

- **Sidebar** (fixed ≈280px, scrollable), sections top-to-bottom:
  1. *Document* — drop zone (compact), browse button, paste textarea
     (collapsed to a small field, expands on focus).
  2. *Generation* — slide language toggle (PL/EN), slide-count hint,
     Generate button, status line. AI model chip (from the model selector)
     sits with these controls.
  3. *Style* — 4 preset tiles (color dots + name), styled like the styler's
     `preset-grid`.
  4. *Actions* — Edit toggle, Present, Download .md, Download .pptx.
- **Slide stage** (center, flexible): rendered current slide, prev/next
  arrows, slide counter, top-right brand logo (existing behavior).
- **Editor panel** (right, ≈360px): full-deck markdown textarea with the
  existing 300 ms debounce → live re-render; hidden by default, toggled by
  the Edit button. While generating, the panel auto-opens and streams
  markdown (existing throttled behavior).
- **Present mode**: unchanged concept — fullscreen slide with keyboard nav;
  entered via Present button / Ctrl+Enter, exits back to the workspace.
- **Responsive**: below ~1100px the editor overlays the stage; below ~800px
  the sidebar collapses to a top bar with a hamburger-style section reveal.
  (Simple CSS stacking; no JS layout engine.)

## Example deck

- Each app ships an `EXAMPLE_MD` (PL and EN variants, chosen by UI language
  at load) — a 6–8 slide deck *about the app itself*: what it does (document
  → AI → slides), how to load a document, pick a model, restyle, present,
  export. Written in the app's tone (edulab: warsztatowy/edukacyjny;
  Quantica: produktowy).
- Loaded whenever the user has no own deck; replaced the moment generation
  or a direct `.md` load produces one. The old `?demo` param becomes
  redundant and is removed; `?lang`, `?slide`, `#present` keep working.
- The user's own deck persists for the session only (as today — no new
  storage), except the *preset choice*, which persists per app in
  localStorage (`eduapp_preset_edu` / `eduapp_preset_quantica`).

## Presets

Data-driven, same shape for both apps; each preset defines slide-surface
tokens only (the app chrome keeps its fixed brand styling):

```js
const PRESETS = [
  { id, name: {pl, en}, bg, fg, accent, headingFont, bodyFont },
  // × 4 per app
];
```

- **edu (edulab Editorial Color system):** four combos drawn from existing
  edulab tokens — e.g. *Papier* (warm paper bg / ink fg / marigold accent),
  *Atrament* (ink bg / paper fg / marigold), *Morski* (paper bg / teal
  accent), *Kontrast* (white bg / near-black fg / ink accent). Fonts stay
  the app's existing heading/body pair (Raleway + current body font).
- **quantica:** four combos from Quantica Lab tokens — e.g. *Jasny* (light
  bg / viva-magenta accent), *Ciemny* (dark bg / magenta), *Magenta*
  (magenta-washed), *Mono* (near-monochrome). Fonts stay Poppins + current
  body font.
- Exact token values are read from each app's existing CSS variables at
  implementation time — no new colors invented outside the brand systems.
- Applying a preset sets CSS variables on the deck container; the renderer
  needs no changes. `exportDeckToPptx` already accepts a theme object —
  export passes the active preset's colors/fonts so PPTX matches the screen.

## Architecture / code changes

- **`app.js` (shared by both apps)** is restructured: the three-view
  state machine (`input | edit | present`) becomes `workspace | present`
  with an `editorOpen` boolean. The injected template is rewritten to the
  sidebar/stage/editor skeleton. All existing logic is reused: source
  intake (`readSourceFile`), generation (`streamSlides` + AI chip), slide
  rendering, keyboard nav, i18n, PPTX export.
- **Per-app config (`BRAND` object in edu.html/quantica.html)** gains
  `presets: PRESETS_*` and `exampleMd: {pl, en}` so app.js stays generic.
- **CSS** in edu.html/quantica.html: new grid layout + sidebar/preset-tile
  styles per brand; the old `view-input`/`edit-grid` styles are removed.
- **shared.js / index.html untouched** (styler keeps its own richer panel).
- Pure helpers unchanged; no new shared.js surface expected.

## Error handling

Unchanged semantics: generation errors show in the existing error panel;
no-key errors name the provider (model-selector behavior). Empty paste /
bad file types keep current messages, now surfaced next to the sidebar's
document section.

## Testing

- `node --test` pure suite must stay green (no pure changes expected).
- Scripted browser checks (reuse the CDP harness): example deck renders on
  load in both apps + no console errors; preset click restyles the slide
  and persists across reload; Edit toggles the right panel and edits
  re-render live; generation flow still works end-to-end (one provider
  suffices); Present enters/exits; `?lang`/`?slide`/`#present` behave.
- Visual screenshots of both apps in all 4 presets each.
