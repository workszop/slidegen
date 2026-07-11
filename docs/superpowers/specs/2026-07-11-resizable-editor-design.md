# Resizable editor panel + fixed-aspect slide scaling

**Date:** 2026-07-11
**Scope:** all three apps — styler (`index.html`), edu + quantica (`app.js`)

## Goal

1. The markdown editor panel's width is user-resizable by dragging its left edge.
2. While the editor is open, the slide preview renders as a fixed **16:9** canvas
   (matching `pptx-export.js` `LAYOUT_16x9`) that scales to fit the remaining
   width — top-anchored, no need to fill viewport height. With the editor
   closed, today's full-bleed fluid rendering is unchanged. Present mode is
   unchanged.
3. The editor panel's ✕ close button becomes a compact icon button instead of a
   full-size `.btn btn-ghost` pill.

## Non-goals

- No change to full-bleed (editor-closed) slide geometry or typography.
- No change to present mode or PPTX export.
- No resizing on the mobile breakpoint (≤768px), where the editor is a fixed
  overlay.

## Design

### 1. Resizer (shared, JS)

New helper in `shared.js`, mounted by both codebases:

```js
mountPanelResizer({ panel, handle, storageKey, min = 280, maxFraction = 0.6 })
```

- `handle` is a 6px-wide vertical strip absolutely positioned on the panel's
  left edge (`cursor: col-resize`), created by the helper.
- `pointerdown` on the handle captures the pointer; `pointermove` sets
  `--editor-w` (px) on the panel; width is clamped to
  `[min, maxFraction × window.innerWidth]`.
- Panel CSS becomes `width: var(--editor-w, min(440px, 34vw))` — no stored
  value means today's default.
- Double-click on the handle clears the stored value and the CSS var (reset to
  default).
- On `pointerup`, the final width persists to `localStorage` under a per-app
  key (`styler.editorW`, `edu.editorW`, `quantica.editorW` — matching each
  app's existing localStorage key prefix convention).
- During drag, a `body` class disables text selection and sets a global
  `col-resize` cursor.
- At the ≤768px breakpoint the handle is hidden via CSS and the stored width is
  ignored (the media-query rule keeps its fixed `width: min(440px, 92vw)`,
  marked `!important` if needed to beat the inline var).

Pure, testable part: the clamp function
(`clampPanelWidth(x, min, maxFraction, viewportW)`) lives in the
`pure-helpers` section of `shared.js` and gets cases in `tests/pure.test.mjs`.

### 2. Fixed-aspect scaling while editing (CSS only)

- The deck area (`.deck` in styler, `.stage`/`.deck` in edu/quantica) gets
  `container-type: size`.
- The workbench root gets an `editing` class, toggled by the existing
  `setEditorOpen` / `setEditorDrawerOpen` functions.
- Under `.editing`, the slide is laid out as a 16:9 frame that fits the
  container: `width: min(100cqw − existing horizontal padding, 177.78cqh)`,
  `aspect-ratio: 16 / 9`, top-anchored like today, with the deck background
  extending behind it as letterbox.
- The 16:9 frame is itself `container-type: size`, and under `.editing` the
  slide's font-size formula switches from viewport units (`1.35vw + 0.8vh`) to
  the equivalent container units of that frame (`1.35cqw + 0.8cqh`), so type
  scales proportionally as the divider drags.
  The slide keeps `overflow: auto` as a safety valve, same as today.
- No JS measurement, no ResizeObserver. Container query units are supported in
  all evergreen browsers (2023+), consistent with the codebase's existing use
  of `color-mix`.

Each app carries its own copy of these CSS rules (styler in `index.html`,
edu/quantica in their respective `<style>` blocks), following the existing
pattern of per-app CSS with shared JS.

### 3. Compact close button

Replace `class="btn btn-ghost"` on `#editorCloseBtn` with a new
`editor-close` class in both templates (`app.js:198`, `index.html:409`):
square 24×24px, 12px glyph, transparent background, subtle border-radius,
hover wash — visually a small icon button in the panel's top-right corner.
`aria-label="close"` stays.

## Error handling

- Corrupt/absent localStorage value → ignore, use default width.
- Stored width outside current clamp range (e.g. window shrank) → re-clamped on
  mount.

## Testing

- `tests/pure.test.mjs`: `clampPanelWidth` cases (below min, above max,
  in-range, garbage input → default).
- In-browser verification (all three apps): drag changes width and slide
  scales live keeping 16:9; double-click resets; width survives reload;
  editor-closed rendering identical to before; mobile overlay unaffected;
  Escape/close behavior still correct; close button visibly compact.
