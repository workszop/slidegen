# Full-bleed workbench layout for all three apps — design

Date: 2026-07-11
Status: user-directed; spec pending user review

## Goal

All three apps fill the viewport the way the styler does today: chrome bar on
top, a flush left panel, and the deck occupying every remaining pixel — no
centered page shell, no bordered slide card. In all three apps, Edit opens a
markdown panel on the **right** (the styler's bottom drawer moves there too),
and the app keeps filling the viewport while editing.

## Current vs target

| | styler today | edu/quantica today | target (all three) |
|---|---|---|---|
| Shell | full-viewport flex workbench | centered `main.shell` page | full-viewport workbench |
| Deck | fills all remaining space | bordered 16:10 card in page flow | fills all remaining space |
| Slide sizing | `width:min(1500px,92%)`, `font-size:clamp(14px,1.35vw+0.8vh,40px)` | container-query card sizing | styler's rules |
| Editor | bottom drawer (36vh) | right panel | right panel (~`min(440px,34vw)`), full height |
| Nav | footer bar (prev/next · counter · hints) | buttons under the card | footer bar |

## Layout (all three apps)

```
┌ chrome ────────────────────────────────────────────┐
├────────┬────────────────────────────────┬──────────┤
│ panel  │  deck (fills, slide centered,  │ editor   │
│ 280px  │  logo top-right, progress bar) │ (toggle) │
│        ├────────────────────────────────┤          │
│        │ ‹ › · 3/12 · hints (footer)    │          │
└────────┴────────────────────────────────┴──────────┘
```

- `body { height: 100vh; display: flex; flex-direction: column; overflow: hidden }`;
  `.workbench { flex: 1; display: flex; min-height: 0 }`.
- **Panel** (edu/quantica): the existing four sidebar sections restyled as the
  styler's flush panel — `width: 280px`, `border-right`, panel background,
  scrollable; sections keep their controls, section headings styled like the
  styler's `panel h2`.
- **Deck** (edu/quantica): adopt the styler's `.deck` recipe — `flex: 1;
  display: grid; place-items: start center; padding: 14vh 3vw 3vh; overflow:
  hidden`, background `var(--slide-bg, <brand default>)`; top progress bar
  (`deck-bar`, accent-colored, width = slide progress) and top-right brand
  logo, exactly as the styler places them. Slide element uses the styler's
  sizing (`width: min(1500px, 92%)`, `max-height: 100%`, `overflow: auto`,
  viewport-clamped font). The existing preset-variable rules (`--slide-fg`,
  `--slide-accent`, derived muted/surface tokens) keep working — only the
  container changes. Title slide vertically centered (`.slide--title
  { align-self: center }`).
- **Footer** (edu/quantica): styler-style slim bar — prev/next buttons,
  counter, keyboard hints; replaces the current under-card nav.
- **Editor panel** (all three): right-hand column inside the workbench,
  `width: min(440px, 34vw)`, full height, `border-left`, textarea filling it.
  Toggled by the existing Edit control; auto-opens during generation
  (edu/quantica) exactly as today. Styler: the `editor-drawer` element moves
  from the bottom of `stage-wrap` to a sibling right column; its toggle
  button and all editor logic stay unchanged.
- **Present mode**: unchanged in all three apps (styler: `body.presenting`
  hides chrome/panel/editor; edu/quantica keep their `view-present`).
- **Responsive** (all three, matching the styler's breakpoint): below 768px
  the workbench stacks — panel on top full-width, deck `min-height: 55vh`,
  editor overlays the deck when open, hints hidden.

## Code changes

- `app.js`: template restructure (workspace → workbench markup: panel,
  stage-wrap with deck + deck-bar + logo + footer, right editor panel);
  `renderStage` additionally updates the deck progress bar; no state-machine
  changes (`workspace|present`, `editorOpen` stay).
- `edu.html` / `quantica.html`: replace the workspace/stage/card CSS with the
  workbench/deck/footer/editor-panel CSS (brand tokens, styler recipe);
  preset hooks and derived legibility tokens carry over.
- `index.html`: move `editor-drawer` markup to a workbench-level right column
  and swap its drawer CSS for right-panel CSS; everything else untouched.
- `shared.js`, `pptx-export.js`, `tests/` untouched. PPTX theme probing is
  unaffected (reads `#view-present` computed styles in edu/quantica and
  `effective()` config in the styler).

## Testing

- Pure suite unchanged (10/10).
- Scripted browser checks per app at 1500×950: workbench fills the viewport
  (no body scroll, deck height = viewport minus chrome+footer), slide text
  scales with the window, editor opens right and the deck reflows, presets
  still restyle deck + progress bar, generation streaming still auto-opens
  the editor, present mode unchanged, footer nav works.
- 700px-wide check: stacked layout per the styler's breakpoint.
- Styler regression: presets/fonts/colors/PPTX still work with the editor on
  the right.
